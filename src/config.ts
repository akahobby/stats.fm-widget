import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const optionalUrl = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : undefined;
  })
  .pipe(z.string().url().optional());

const configSchema = z.object({
  DISCORD_APP_ID: z.string().min(1, "DISCORD_APP_ID is required"),
  DISCORD_USER_ID: z.string().min(1, "DISCORD_USER_ID is required"),
  DISCORD_BOT_TOKEN: z.string().min(1, "DISCORD_BOT_TOKEN is required"),
  STATSM_USERNAME: z.string().min(1, "STATSM_USERNAME is required"),
  STATSM_PROFILE_URL: z
    .string()
    .url()
    .min(1, "STATSM_PROFILE_URL is required"),
  POLL_SECONDS: z.coerce.number().int().positive().default(5),
  TOPS_POLL_SECONDS: z.coerce.number().int().positive().default(60),
  ROTATING_STATS: z
    .string()
    .optional()
    .transform((value) => value === "true" || value === "1"),
  ROTATION_INTERVAL_SECONDS: z.coerce.number().int().positive().default(30),
  COMMANDS_GLOBAL: z
    .string()
    .optional()
    .transform((value) => value === "true" || value === "1"),
  COMMANDS_GUILD_ID: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim() ?? "";
      return trimmed.length > 0 ? trimmed : undefined;
    }),
  STATSM_RECENT_URL: optionalUrl,
  STATSM_TOP_ARTISTS_4W_URL: optionalUrl,
  STATSM_TOP_ALBUMS_4W_URL: optionalUrl,
  STATSM_TOP_TRACKS_4W_URL: optionalUrl,
  STATSM_TOP_ARTISTS_6M_URL: optionalUrl,
  STATSM_TOP_ALBUMS_6M_URL: optionalUrl,
  STATSM_TOP_TRACKS_6M_URL: optionalUrl,
});

export type AppConfig = {
  discordAppId: string;
  discordUserId: string;
  discordBotToken: string;
  statsmUsername: string;
  statsmProfileUrl: string;
  pollSeconds: number;
  topsPollSeconds: number;
  rotatingStats: boolean;
  rotationIntervalSeconds: number;
  commandsGlobal: boolean;
  commandsGuildId?: string;
  statsmUrls: {
    recent: string;
    topArtists4w: string;
    topAlbums4w: string;
    topTracks4w: string;
    topArtists6m: string;
    topAlbums6m: string;
    topTracks6m: string;
  };
};

function defaultStatsmUrls(username: string) {
  const base = `https://api.stats.fm/api/v1/users/${encodeURIComponent(username)}`;
  return {
    recent: `${base}/streams/recent`,
    topArtists4w: `${base}/top/artists?range=weeks&limit=1`,
    topAlbums4w: `${base}/top/albums?range=weeks&limit=1`,
    topTracks4w: `${base}/top/tracks?range=weeks&limit=1`,
    topArtists6m: `${base}/top/artists?range=months&limit=1`,
    topAlbums6m: `${base}/top/albums?range=months&limit=1`,
    topTracks6m: `${base}/top/tracks?range=months&limit=1`,
  };
}

function loadConfig(): AppConfig {
  const parsed = configSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid configuration: ${details}`);
  }

  const env = parsed.data;
  const defaults = defaultStatsmUrls(env.STATSM_USERNAME);

  return {
    discordAppId: env.DISCORD_APP_ID,
    discordUserId: env.DISCORD_USER_ID,
    discordBotToken: env.DISCORD_BOT_TOKEN,
    statsmUsername: env.STATSM_USERNAME,
    statsmProfileUrl: env.STATSM_PROFILE_URL,
    pollSeconds: env.POLL_SECONDS,
    topsPollSeconds: env.TOPS_POLL_SECONDS,
    rotatingStats: Boolean(env.ROTATING_STATS),
    rotationIntervalSeconds: env.ROTATION_INTERVAL_SECONDS,
    commandsGlobal: Boolean(env.COMMANDS_GLOBAL),
    commandsGuildId: env.COMMANDS_GUILD_ID,
    statsmUrls: {
      recent: env.STATSM_RECENT_URL ?? defaults.recent,
      topArtists4w: env.STATSM_TOP_ARTISTS_4W_URL ?? defaults.topArtists4w,
      topAlbums4w: env.STATSM_TOP_ALBUMS_4W_URL ?? defaults.topAlbums4w,
      topTracks4w: env.STATSM_TOP_TRACKS_4W_URL ?? defaults.topTracks4w,
      topArtists6m: env.STATSM_TOP_ARTISTS_6M_URL ?? defaults.topArtists6m,
      topAlbums6m: env.STATSM_TOP_ALBUMS_6M_URL ?? defaults.topAlbums6m,
      topTracks6m: env.STATSM_TOP_TRACKS_6M_URL ?? defaults.topTracks6m,
    },
  };
}

export const config = loadConfig();
