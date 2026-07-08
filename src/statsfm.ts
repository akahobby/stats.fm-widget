import axios, { AxiosError } from "axios";
import { config } from "./config";
import type { TopStats } from "./types";
import {
  averageDailyMinutes,
  buildRotatedTopStats,
  emptyRotationData,
  formatAccountAge,
  formatCount,
  formatMinutesFromMs,
  type RotationData,
} from "./rotatingStats";
import { joinArtists, logger, retryAfterMs, sleep } from "./utils";

const http = axios.create({
  timeout: 15_000,
  headers: {
    Accept: "application/json",
    "User-Agent": "StatsFmWidget/1.0 (stats.fm Discord profile widget)",
  },
  validateStatus: (status) => (status >= 200 && status < 300) || status === 204,
});

interface StatsFmArtist {
  id?: number;
  name?: string;
  image?: string;
}

interface StatsFmAlbum {
  id?: number;
  name?: string;
  image?: string;
  artists?: StatsFmArtist[];
}

interface StatsFmTrack {
  id?: number;
  name?: string;
  artists?: StatsFmArtist[];
  albums?: StatsFmAlbum[];
}

interface StatsFmStream {
  endTime?: string;
  track?: StatsFmTrack;
  durationMs?: number;
}

interface ItemsResponse<T> {
  items?: T[];
}

async function getJson<T>(url: string, label: string): Promise<T | null> {
  logger.info(`stats.fm request [${label}]`, { url });

  try {
    const response = await http.get<T>(url);

    if (response.status === 204 || response.data == null || response.data === "") {
      logger.warn(`stats.fm returned empty response [${label}]`, {
        status: response.status,
        url,
      });
      return null;
    }

    return response.data;
  } catch (error) {
    await handleHttpError(error, label, url);
    return null;
  }
}

async function handleHttpError(
  error: unknown,
  label: string,
  url: string,
): Promise<void> {
  if (!axios.isAxiosError(error)) {
    logger.error(`stats.fm request failed [${label}]`, {
      url,
      message: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const axiosError = error as AxiosError;
  const status = axiosError.response?.status;
  const headers = axiosError.response?.headers as Record<string, unknown> | undefined;

  if (status === 401 || status === 403) {
    logger.error(`stats.fm access denied [${label}]`, { status, url });
    return;
  }

  if (status === 429) {
    const waitMs = retryAfterMs(headers, 5_000);
    logger.warn(`stats.fm rate limited [${label}], backing off`, {
      status,
      url,
      waitMs,
    });
    await sleep(waitMs);
    return;
  }

  logger.error(`stats.fm request failed [${label}]`, {
    status,
    url,
    message: axiosError.message,
  });
}

function pickFirstItem<T>(payload: ItemsResponse<T> | T[] | null): T | null {
  if (!payload) return null;
  if (Array.isArray(payload)) return payload[0] ?? null;
  if (Array.isArray(payload.items)) return payload.items[0] ?? null;
  return null;
}

async function fetchTopName(
  url: string,
  label: string,
  extract: (item: Record<string, unknown>) => string | undefined,
): Promise<string> {
  const payload = await getJson<ItemsResponse<Record<string, unknown>> | Record<string, unknown>[]>(
    url,
    label,
  );
  const item = pickFirstItem(payload);
  if (!item) return "-";

  const name = extract(item)?.trim();
  return name && name.length > 0 ? name : "-";
}

function artistNameFromItem(item: Record<string, unknown>): string | undefined {
  const artist = item.artist as StatsFmArtist | undefined;
  return artist?.name ?? (item.name as string | undefined);
}

function albumNameFromItem(item: Record<string, unknown>): string | undefined {
  const album = item.album as StatsFmAlbum | undefined;
  return album?.name ?? (item.name as string | undefined);
}

function trackLabelFromItem(item: Record<string, unknown>): string | undefined {
  const track = item.track as StatsFmTrack | undefined;
  const title = track?.name?.trim() || (item.name as string | undefined)?.trim();
  if (!title) return undefined;

  const artist = joinArtists(track?.artists ?? []);
  return artist ? `${title} - ${artist}` : title;
}

export async function fetchTopStats(): Promise<TopStats> {
  const data = await fetchRotationData();
  return buildRotatedTopStats(data, 0, false).tops;
}

interface StreamStatsItems {
  durationMs?: number;
  count?: number;
  cardinality?: {
    tracks?: number;
    artists?: number;
    albums?: number;
  };
}

interface StreamStatsResponse {
  items?: StreamStatsItems;
}

function readStreamStats(payload: StreamStatsResponse | null): StreamStatsItems {
  return payload?.items ?? {};
}

export async function fetchRotationData(): Promise<RotationData> {
  const base = `https://api.stats.fm/api/v1/users/${encodeURIComponent(config.statsmUsername)}`;
  const data = emptyRotationData();

  const [
    topArtist4w,
    topAlbum4w,
    topSong4w,
    topArtist6m,
    topAlbum6m,
    topSong6m,
    todayStats,
    weekStats,
    monthStats,
    lifetimeStats,
    profile,
    recent,
    topGenre,
  ] = await Promise.all([
    fetchTopName(config.statsmUrls.topArtists4w, "top-artists-4w", artistNameFromItem),
    fetchTopName(config.statsmUrls.topAlbums4w, "top-albums-4w", albumNameFromItem),
    fetchTopName(config.statsmUrls.topTracks4w, "top-tracks-4w", trackLabelFromItem),
    fetchTopName(config.statsmUrls.topArtists6m, "top-artists-6m", artistNameFromItem),
    fetchTopName(config.statsmUrls.topAlbums6m, "top-albums-6m", albumNameFromItem),
    fetchTopName(config.statsmUrls.topTracks6m, "top-tracks-6m", trackLabelFromItem),
    getJson<StreamStatsResponse>(`${base}/streams/stats?range=today`, "stats-today"),
    getJson<StreamStatsResponse>(`${base}/streams/stats?range=weeks`, "stats-weeks"),
    getJson<StreamStatsResponse>(`${base}/streams/stats?range=months`, "stats-months"),
    getJson<StreamStatsResponse>(`${base}/streams/stats?range=lifetime`, "stats-lifetime"),
    getJson<{ item?: { createdAt?: string } }>(base, "profile"),
    getJson<ItemsResponse<StatsFmStream> | StatsFmStream[]>(
      config.statsmUrls.recent,
      "recent-discovery",
    ),
    getJson<ItemsResponse<Record<string, unknown>>>(
      `${base}/top/genres?range=lifetime&limit=1`,
      "top-genre",
    ),
  ]);

  data.topArtist4w = topArtist4w;
  data.topAlbum4w = topAlbum4w;
  data.topSong4w = topSong4w;
  data.topArtist6m = topArtist6m;
  data.topAlbum6m = topAlbum6m;
  data.topSong6m = topSong6m;

  const today = readStreamStats(todayStats);
  const week = readStreamStats(weekStats);
  const month = readStreamStats(monthStats);
  const lifetime = readStreamStats(lifetimeStats);

  data.minutesToday = formatMinutesFromMs(today.durationMs);
  data.minutesWeek = formatMinutesFromMs(week.durationMs);
  data.minutesMonth = formatMinutesFromMs(month.durationMs);
  data.totalStreams = formatCount(lifetime.count);
  data.uniqueArtists = formatCount(lifetime.cardinality?.artists);
  data.uniqueTracks = formatCount(lifetime.cardinality?.tracks);

  data.artistsMonth = formatCount(month.cardinality?.artists);
  data.albumsMonth = formatCount(month.cardinality?.albums);
  data.tracksMonth = formatCount(month.cardinality?.tracks);

  const lastStream = pickFirstItem(recent);
  if (lastStream?.track) {
    data.newestArtist = joinArtists(lastStream.track.artists ?? []) || "-";
    data.newestAlbum = lastStream.track.albums?.[0]?.name?.trim() || "-";
    data.newestTrack = lastStream.track.name?.trim() || "-";
  }

  const createdAt = profile?.item?.createdAt;
  data.lifetimeMinutes = formatMinutesFromMs(lifetime.durationMs);
  data.lifetimeStreams = formatCount(lifetime.count);
  data.averageDaily = averageDailyMinutes(lifetime.durationMs, createdAt);
  data.librarySize = formatCount(lifetime.cardinality?.tracks);
  data.accountAge = formatAccountAge(createdAt);

  const genreItem = pickFirstItem(topGenre);
  const genre = genreItem?.genre as { tag?: string } | string | undefined;
  if (typeof genre === "string" && genre.trim()) {
    data.topGenre = genre.trim();
  } else if (genre && typeof genre === "object" && genre.tag?.trim()) {
    data.topGenre = genre.tag.trim();
  }

  return data;
}
