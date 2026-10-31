export interface MusicTrack {
  id: number;
  title: string;
  artist: string | null;
  originalFilename: string;
  contentType: string | null;
  fileSizeBytes: number;
  createdAt: string;
}
