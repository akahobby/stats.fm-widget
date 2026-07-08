import {
  Activity,
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  Guild,
  Presence,
} from "discord.js";
import { config } from "./config";
import type { CurrentTrack } from "./types";
import { logger, pickSourceArtUrl } from "./utils";

export type PresenceLookup =
  | { status: "playing"; track: CurrentTrack }
  | { status: "idle" }
  | { status: "unavailable"; reason: string };

export function createDiscordClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildMembers,
    ],
  });

  client.once(Events.ClientReady, (readyClient) => {
    logger.info("Discord bot is online", {
      tag: readyClient.user.tag,
      id: readyClient.user.id,
      guilds: readyClient.guilds.cache.size,
    });

    if (readyClient.guilds.cache.size === 0) {
      logger.warn(
        "Bot is in 0 servers. Invite it to a shared server and enable Presence + Server Members intents.",
      );
    }
  });

  client.on(Events.Error, (error) => {
    logger.error("Discord client error", { message: error.message });
  });

  client.on(Events.Warn, (message) => {
    logger.warn("Discord client warning", { message });
  });

  return client;
}

export async function loginDiscord(client: Client): Promise<void> {
  logger.info("Logging into Discord");
  await client.login(config.discordBotToken);
}

export function currentTrackFromPresence(
  presence: Presence | null | undefined,
): CurrentTrack | null {
  if (!presence) return null;
  return trackFromPresence(presence);
}

export async function fetchDiscordSpotifyTrack(
  client: Client,
): Promise<PresenceLookup> {
  if (!client.isReady()) {
    return { status: "unavailable", reason: "Discord client not ready" };
  }

  if (client.guilds.cache.size === 0) {
    return {
      status: "unavailable",
      reason: "Bot is in 0 servers",
    };
  }

  let foundInAnyGuild = false;
  let idleSample: { guildId: string; presence: Presence } | null = null;

  for (const guild of client.guilds.cache.values()) {
    try {
      const member = await guild.members.fetch({
        user: config.discordUserId,
        withPresences: true,
      });

      foundInAnyGuild = true;

      const presence = resolveGuildPresence(guild, member.presence);
      if (!presence) {
        logger.debug("Member found but presence is null in guild", {
          guildId: guild.id,
        });
        continue;
      }

      const track = trackFromPresence(presence);
      if (track) {
        logger.info("Current track from Discord Spotify presence", {
          title: track.title,
          artist: track.artist,
          guildId: guild.id,
        });
        return { status: "playing", track };
      }

      if (
        !idleSample ||
        presence.activities.length > idleSample.presence.activities.length
      ) {
        idleSample = { guildId: guild.id, presence };
      }
    } catch (error) {
      logger.debug("User not in guild or presence fetch failed", {
        guildId: guild.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (idleSample) {
    logNoSpotifyActivity(idleSample.guildId, idleSample.presence);
    return { status: "idle" };
  }

  if (foundInAnyGuild) {
    logger.warn("Member found but presence is null in all shared guilds", {
      guildCount: client.guilds.cache.size,
    });
    return {
      status: "unavailable",
      reason: "Presence is null (enable Presence Intent)",
    };
  }

  return {
    status: "unavailable",
    reason: "DISCORD_USER_ID not found in any shared server",
  };
}

function resolveGuildPresence(
  guild: Guild,
  memberPresence: Presence | null,
): Presence | null {
  return (
    guild.presences.cache.get(config.discordUserId) ?? memberPresence ?? null
  );
}

type ActivitySummary = {
  type: string;
  name: string;
};

function summarizeActivities(presence: Presence): ActivitySummary[] {
  return presence.activities
    .filter((activity) => activity.type !== ActivityType.Custom)
    .map((activity) => ({
      type: activityTypeLabel(activity.type),
      name: activity.name,
    }));
}

function activityTypeLabel(type: ActivityType): string {
  switch (type) {
    case ActivityType.Playing:
      return "Playing";
    case ActivityType.Streaming:
      return "Streaming";
    case ActivityType.Listening:
      return "Listening";
    case ActivityType.Watching:
      return "Watching";
    case ActivityType.Custom:
      return "Custom";
    case ActivityType.Competing:
      return "Competing";
    default:
      return String(type);
  }
}

function logNoSpotifyActivity(guildId: string, presence: Presence): void {
  const activities = summarizeActivities(presence);

  logger.info("no spotify activity", {
    guildId,
    activityCount: activities.length,
    activities,
  });
}

function trackFromPresence(presence: Presence): CurrentTrack | null {
  const activity =
    presence.activities.find(isSpotifyActivity) ??
    presence.activities.find(
      (entry) => entry.type === ActivityType.Listening && Boolean(entry.details),
    );

  if (!activity) return null;
  return trackFromActivity(activity);
}

function isSpotifyActivity(activity: Activity): boolean {
  return (
    activity.type === ActivityType.Listening &&
    activity.name.toLowerCase() === "spotify"
  );
}

function trackFromActivity(activity: Activity): CurrentTrack | null {
  const title = activity.details?.trim();
  if (!title) return null;

  const artist = activity.state?.trim() || "-";
  const album = activity.assets?.largeText?.trim() || "-";
  const images = resolveSpotifyArtwork(activity);

  return {
    title,
    artist,
    album,
    heroImageUrl: pickSourceArtUrl(images),
    endTime: new Date().toISOString(),
  };
}

function resolveSpotifyArtwork(activity: Activity): {
  highRes?: string;
  medium?: string;
  small?: string;
} {
  const largeImage = activity.assets?.largeImage;

  if (largeImage?.startsWith("spotify:")) {
    const id = largeImage.slice("spotify:".length);
    return { highRes: `https://i.scdn.co/image/${id}` };
  }

  const highRes = activity.assets?.largeImageURL({ size: 640 }) ?? undefined;
  if (highRes) return { highRes };

  if (
    largeImage &&
    (largeImage.startsWith("http://") || largeImage.startsWith("https://"))
  ) {
    return { highRes: largeImage };
  }

  return {};
}
