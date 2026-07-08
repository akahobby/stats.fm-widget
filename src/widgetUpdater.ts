import axios, { AxiosError } from "axios";
import { config } from "./config";
import type {
  CurrentTrack,
  WidgetField,
  WidgetPayload,
  WidgetSnapshot,
} from "./types";
import { recordWidgetUpdate } from "./runtimeStatus";
import {
  DEFAULT_TEXT_MAX,
  IMAGE_URL_MAX,
  discordRateLimitMs,
  fitAlbumCoverUrl,
  logger,
  sleep,
  stableStringify,
  truncate,
} from "./utils";

const DISCORD_USER_AGENT =
  "DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)";

function widgetEndpoint(): string {
  return `https://discord.com/api/v9/applications/${config.discordAppId}/users/${config.discordUserId}/identities/0/profile`;
}

function textField(name: string, value: string, max = DEFAULT_TEXT_MAX): WidgetField {
  return { type: 1, name, value: truncate(value, max) };
}

function imageField(name: string, url: string): WidgetField {
  const safe = url.length <= IMAGE_URL_MAX ? url : url.slice(0, IMAGE_URL_MAX);
  return { type: 3, name, value: { url: safe } };
}

function idleTrack(): CurrentTrack {
  return {
    title: "Not playing anything.",
    artist: "-",
    album: "-",
    heroImageUrl: "",
    endTime: "",
  };
}

function isIdleTrack(track: CurrentTrack): boolean {
  return track.title === "Not playing anything.";
}

export function buildWidgetPayload(snapshot: WidgetSnapshot): WidgetPayload {
  const track = snapshot.track ?? idleTrack();
  const tops = snapshot.tops;

  const subtitle = isIdleTrack(track)
    ? "-"
    : `${track.artist} • ${track.album}`;

  const dynamic: WidgetField[] = [
    textField("title", track.title),
    textField("artist", track.artist),
    textField("album", track.album),
    textField("subtitle", subtitle),
  ];

  const heroUrl = fitAlbumCoverUrl(track.heroImageUrl);
  if (heroUrl.length > 0) {
    dynamic.push(imageField("hero_image", heroUrl));
  }

  dynamic.push(
    textField("hdr_artist_4w", tops.hdrArtist4w),
    textField("hdr_album_4w", tops.hdrAlbum4w),
    textField("hdr_song_4w", tops.hdrSong4w),
    textField("hdr_artist_6m", tops.hdrArtist6m),
    textField("hdr_album_6m", tops.hdrAlbum6m),
    textField("hdr_song_6m", tops.hdrSong6m),
    textField("top_artist_4w", tops.topArtist4w),
    textField("top_album_4w", tops.topAlbum4w),
    textField("top_song_4w", tops.topSong4w),
    textField("top_artist_6m", tops.topArtist6m),
    textField("top_album_6m", tops.topAlbum6m),
    textField("top_song_6m", tops.topSong6m),
  );

  if (snapshot.pageLabel?.trim()) {
    dynamic.push(textField("stats_page", snapshot.pageLabel));
    dynamic.push(textField("page", snapshot.pageLabel));
  }

  return {
    username: config.statsmUsername,
    data: { dynamic },
  };
}

export class WidgetUpdater {
  private lastPayloadJson: string | null = null;
  private patchBlockedUntil = 0;

  async update(snapshot: WidgetSnapshot): Promise<boolean> {
    const payload = buildWidgetPayload(snapshot);
    const serialized = stableStringify(payload);

    if (this.lastPayloadJson === serialized) {
      logger.info("widget unchanged");
      recordWidgetUpdate(true);
      return false;
    }

    if (Date.now() < this.patchBlockedUntil) {
      const waitMs = this.patchBlockedUntil - Date.now();
      logger.info("widget PATCH deferred", { waitMs });
      return false;
    }

    const ok = await this.patch(payload);
    recordWidgetUpdate(ok);
    if (ok) {
      this.lastPayloadJson = serialized;
    }
    return ok;
  }

  private async patch(payload: WidgetPayload, isRetry = false): Promise<boolean> {
    const url = widgetEndpoint();
    const titleField = payload.data.dynamic.find((field) => field.name === "title");
    const title =
      titleField && titleField.type === 1 ? titleField.value : undefined;

    logger.info("widget PATCH", {
      url,
      username: payload.username,
      title,
    });

    try {
      const response = await axios.patch(url, payload, {
        timeout: 15_000,
        headers: {
          Authorization: `Bot ${config.discordBotToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": DISCORD_USER_AGENT,
        },
        validateStatus: (status) =>
          (status >= 200 && status < 300) || status === 204,
      });

      if (response.status === 204 || response.data == null || response.data === "") {
        logger.info("widget updated", {
          status: response.status,
        });
        return true;
      }

      logger.info("widget updated", { status: response.status });
      return true;
    } catch (error) {
      return this.handlePatchError(error, url, payload, isRetry);
    }
  }

  private async handlePatchError(
    error: unknown,
    url: string,
    payload: WidgetPayload,
    isRetry: boolean,
  ): Promise<boolean> {
    if (!axios.isAxiosError(error)) {
      logger.error("Discord widget PATCH failed", {
        url,
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    }

    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const body = summarizeDiscordBody(axiosError.response?.data);

    if (status === 401 || status === 403) {
      logger.error(
        "widget PATCH unauthorized",
        { status, url, body },
      );
      return false;
    }

    if (status === 429) {
      const waitMs = discordRateLimitMs(axiosError);
      this.patchBlockedUntil = Date.now() + waitMs;
      logger.warn("Discord rate limited on widget PATCH; backing off", {
        status,
        url,
        waitMs,
        body,
        willRetry: !isRetry,
      });
      await sleep(waitMs);
      if (!isRetry) {
        return this.patch(payload, true);
      }
      return false;
    }

    logger.error("Discord widget PATCH failed", {
      status,
      url,
      message: axiosError.message,
      body,
    });
    return false;
  }
}

function summarizeDiscordBody(data: unknown): string | undefined {
  if (data == null || data === "") return undefined;
  try {
    const text = typeof data === "string" ? data : JSON.stringify(data);
    return text.slice(0, 500);
  } catch {
    return "[unserializable]";
  }
}
