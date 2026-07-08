export interface WidgetTextField {
  type: 1;
  name: string;
  value: string;
}

export interface WidgetImageField {
  type: 3;
  name: string;
  value: { url: string };
}

export type WidgetField = WidgetTextField | WidgetImageField;

export interface WidgetPayload {
  username: string;
  data: {
    dynamic: WidgetField[];
  };
}

export interface CurrentTrack {
  title: string;
  artist: string;
  album: string;
  heroImageUrl: string;
  endTime: string;
}

export interface TopStats {
  hdrArtist4w: string;
  hdrAlbum4w: string;
  hdrSong4w: string;
  hdrArtist6m: string;
  hdrAlbum6m: string;
  hdrSong6m: string;
  topArtist4w: string;
  topAlbum4w: string;
  topSong4w: string;
  topArtist6m: string;
  topAlbum6m: string;
  topSong6m: string;
}

export interface WidgetSnapshot {
  track: CurrentTrack | null;
  tops: TopStats;
  pageLabel?: string;
}
