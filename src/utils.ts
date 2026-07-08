export const DEFAULT_TEXT_MAX = 100;
export const IMAGE_URL_MAX = 512;

export const HERO_IMAGE_WIDTH = 480;
export const HERO_IMAGE_HEIGHT = 360;

export type AlbumImageSet = {
  highRes?: string | null;
  medium?: string | null;
  small?: string | null;
};

function nonEmpty(url: string | null | undefined): string | undefined {
  const trimmed = url?.trim();
  return trimmed ? trimmed : undefined;
}

export function shortenAlbumSourceUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";

  const spotify =
    trimmed.match(/^spotify:([a-zA-Z0-9]+)$/) ??
    trimmed.match(/i\.scdn\.co\/image\/([a-zA-Z0-9]+)/);
  if (spotify?.[1]) {
    return `https://i.scdn.co/image/${spotify[1]}`;
  }

  return trimmed;
}

export function fitAlbumCoverUrl(url: string): string {
  const source = shortenAlbumSourceUrl(url);
  if (!source) return "";

  const appleSized = source.replace(
    /\/\d+x\d+([a-z]*)\.(jpg|jpeg|png|webp)(\?.*)?$/i,
    `/${HERO_IMAGE_WIDTH}x${HERO_IMAGE_HEIGHT}$1.$2$3`,
  );
  if (appleSized !== source) return appleSized;

  if (source.includes("wsrv.nl") || source.includes("images.weserv.nl")) {
    return source;
  }

  const proxied =
    `https://wsrv.nl/?url=${encodeURIComponent(source)}` +
    `&w=${HERO_IMAGE_WIDTH}&h=${HERO_IMAGE_HEIGHT}&fit=cover&a=center&output=webp`;

  if (proxied.length <= IMAGE_URL_MAX) return proxied;

  const minimal =
    `https://wsrv.nl/?url=${encodeURIComponent(source)}` +
    `&w=${HERO_IMAGE_WIDTH}&h=${HERO_IMAGE_HEIGHT}&fit=cover`;
  return minimal.length <= IMAGE_URL_MAX ? minimal : source;
}

export function pickSourceArtUrl(images: AlbumImageSet): string {
  return (
    nonEmpty(images.highRes) ??
    nonEmpty(images.medium) ??
    nonEmpty(images.small) ??
    ""
  );
}

export function truncate(value: string, max = DEFAULT_TEXT_MAX): string {
  const text = value.trim();
  if (text.length <= max) return text;
  if (max <= 1) return text.slice(0, max);
  return `${text.slice(0, max - 1)}…`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

export function joinArtists(artists: Array<{ name?: string } | undefined>): string {
  return artists
    .map((artist) => artist?.name?.trim())
    .filter((name): name is string => Boolean(name))
    .join(", ");
}

type LogLevel = "info" | "warn" | "error" | "debug";

function formatLine(level: LogLevel, message: string, meta?: unknown): string {
  const timestamp = new Date().toISOString();
  if (meta === undefined) {
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }
  return `[${timestamp}] [${level.toUpperCase()}] ${message} ${safeMeta(meta)}`;
}

function safeMeta(meta: unknown): string {
  try {
    return JSON.stringify(meta);
  } catch {
    return "[unserializable]";
  }
}

export const logger = {
  info(message: string, meta?: unknown): void {
    console.log(formatLine("info", message, meta));
  },
  warn(message: string, meta?: unknown): void {
    console.warn(formatLine("warn", message, meta));
  },
  error(message: string, meta?: unknown): void {
    console.error(formatLine("error", message, meta));
  },
  debug(message: string, meta?: unknown): void {
    if (process.env.DEBUG === "1" || process.env.DEBUG === "true") {
      console.debug(formatLine("debug", message, meta));
    }
  },
};

export function discordRateLimitMs(
  error: { response?: { data?: unknown; headers?: Record<string, unknown> } },
  fallbackMs = 5_000,
): number {
  const data = error.response?.data;
  if (data && typeof data === "object" && data !== null && "retry_after" in data) {
    const seconds = Number((data as { retry_after?: unknown }).retry_after);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.ceil(seconds * 1_000) + 250;
    }
  }

  const headers = error.response?.headers;
  const retryAfter = headers?.["retry-after"] ?? headers?.["Retry-After"];
  if (typeof retryAfter === "string" || typeof retryAfter === "number") {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.ceil(seconds * 1_000) + 250;
    }
  }

  return fallbackMs;
}

export function retryAfterMs(
  headers: Record<string, unknown> | undefined,
  fallbackMs: number,
): number {
  if (!headers) return fallbackMs;

  const retryAfter = headers["retry-after"] ?? headers["Retry-After"];
  if (typeof retryAfter === "string" || typeof retryAfter === "number") {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.max(fallbackMs, seconds * 1000);
    }
  }

  const resetAfter =
    headers["x-ratelimit-reset-after"] ?? headers["X-RateLimit-Reset-After"];
  if (typeof resetAfter === "string" || typeof resetAfter === "number") {
    const seconds = Number(resetAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.max(fallbackMs, seconds * 1000);
    }
  }

  return fallbackMs;
}
