import type { TopStats } from "./types";

export type RotationData = {
  topArtist4w: string;
  topAlbum4w: string;
  topSong4w: string;
  topArtist6m: string;
  topAlbum6m: string;
  topSong6m: string;
  minutesToday: string;
  minutesWeek: string;
  minutesMonth: string;
  totalStreams: string;
  uniqueArtists: string;
  uniqueTracks: string;
  newestArtist: string;
  newestAlbum: string;
  newestTrack: string;
  artistsMonth: string;
  albumsMonth: string;
  tracksMonth: string;
  lifetimeMinutes: string;
  lifetimeStreams: string;
  averageDaily: string;
  topGenre: string;
  librarySize: string;
  accountAge: string;
};

export type StatPage = {
  id: string;
  title: string;
  build: (data: RotationData) => TopStats;
};

function cards(
  headers: [string, string, string, string, string, string],
  values: [string, string, string, string, string, string],
): TopStats {
  return {
    hdrArtist4w: headers[0],
    hdrAlbum4w: headers[1],
    hdrSong4w: headers[2],
    hdrArtist6m: headers[3],
    hdrAlbum6m: headers[4],
    hdrSong6m: headers[5],
    topArtist4w: values[0],
    topAlbum4w: values[1],
    topSong4w: values[2],
    topArtist6m: values[3],
    topAlbum6m: values[4],
    topSong6m: values[5],
  };
}

export const STAT_PAGES: StatPage[] = [
  {
    id: "top-music",
    title: "Top Music",
    build: (d) =>
      cards(
        [
          "Top Artist(4w)",
          "Top Album(4w)",
          "Top Song(4w)",
          "Top Artist(6m)",
          "Top Album(6m)",
          "Top Song(6m)",
        ],
        [
          d.topArtist4w,
          d.topAlbum4w,
          d.topSong4w,
          d.topArtist6m,
          d.topAlbum6m,
          d.topSong6m,
        ],
      ),
  },
  {
    id: "listening",
    title: "Listening Stats",
    build: (d) =>
      cards(
        ["Today", "This Week", "This Month", "Total Streams", "Unique Artists", "Unique Tracks"],
        [
          d.minutesToday,
          d.minutesWeek,
          d.minutesMonth,
          d.totalStreams,
          d.uniqueArtists,
          d.uniqueTracks,
        ],
      ),
  },
  {
    id: "discovery",
    title: "Discovery",
    build: (d) =>
      cards(
        [
          "Last Artist",
          "Last Album",
          "Last Song",
          "Artists Month",
          "Albums Month",
          "Songs Month",
        ],
        [
          d.newestArtist,
          d.newestAlbum,
          d.newestTrack,
          d.artistsMonth,
          d.albumsMonth,
          d.tracksMonth,
        ],
      ),
  },
  {
    id: "lifetime",
    title: "Lifetime",
    build: (d) =>
      cards(
        [
          "Lifetime Minutes",
          "Lifetime Streams",
          "Average Daily",
          "Top Genre",
          "Library Size",
          "Account Age",
        ],
        [
          d.lifetimeMinutes,
          d.lifetimeStreams,
          d.averageDaily,
          d.topGenre,
          d.librarySize,
          d.accountAge,
        ],
      ),
  },
];

export function emptyRotationData(): RotationData {
  const dash = "-";
  return {
    topArtist4w: dash,
    topAlbum4w: dash,
    topSong4w: dash,
    topArtist6m: dash,
    topAlbum6m: dash,
    topSong6m: dash,
    minutesToday: dash,
    minutesWeek: dash,
    minutesMonth: dash,
    totalStreams: dash,
    uniqueArtists: dash,
    uniqueTracks: dash,
    newestArtist: dash,
    newestAlbum: dash,
    newestTrack: dash,
    artistsMonth: dash,
    albumsMonth: dash,
    tracksMonth: dash,
    lifetimeMinutes: dash,
    lifetimeStreams: dash,
    averageDaily: dash,
    topGenre: dash,
    librarySize: dash,
    accountAge: dash,
  };
}

export function buildRotatedTopStats(
  data: RotationData,
  pageIndex: number,
  rotatingEnabled: boolean,
): { tops: TopStats; pageIndex: number; pageLabel: string } {
  if (!rotatingEnabled) {
    return {
      tops: STAT_PAGES[0].build(data),
      pageIndex: 0,
      pageLabel: STAT_PAGES[0]?.title ?? "Top Music",
    };
  }

  const count = STAT_PAGES.length;
  const index = ((pageIndex % count) + count) % count;
  const page = STAT_PAGES[index];

  return {
    tops: page.build(data),
    pageIndex: index,
    pageLabel: `${index + 1}/${count} · ${page.title}`,
  };
}

export function formatMinutesFromMs(ms: number | undefined | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "-";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins.toLocaleString("en-US")} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0
    ? `${hours.toLocaleString("en-US")}h`
    : `${hours.toLocaleString("en-US")}h ${rem}m`;
}

export function formatCount(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return Math.round(n).toLocaleString("en-US");
}

export function formatAccountAge(createdAt: string | undefined | null): string {
  if (!createdAt) return "-";
  const start = Date.parse(createdAt);
  if (Number.isNaN(start)) return "-";
  const days = Math.max(0, Math.floor((Date.now() - start) / 86_400_000));
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  return months > 0 ? `${years}y ${months}mo` : `${years}y`;
}

export function averageDailyMinutes(
  lifetimeMs: number | undefined | null,
  createdAt: string | undefined | null,
): string {
  if (lifetimeMs == null || !createdAt) return "-";
  const start = Date.parse(createdAt);
  if (Number.isNaN(start)) return "-";
  const days = Math.max(1, Math.floor((Date.now() - start) / 86_400_000));
  const mins = Math.round(lifetimeMs / 60_000 / days);
  return `${mins.toLocaleString("en-US")} min/day`;
}
