/**
 * Shared types safe for both client and server imports.
 * Keep Node-only code out of this file so client components can import freely.
 */

export interface VideoFormat {
  formatId: string;
  ext: string;
  resolution: string;
  filesize: number | null;
  fps: number | null;
  qualityLabel: string;
  type: 'video' | 'audio' | 'combined';
}

export interface PlaylistEntry {
  id: string;
  title: string;
  url: string;
  duration?: number;
  uploader?: string;
}

export interface PlaylistMetadata {
  isPlaylist: true;
  url: string;
  title: string;
  uploader?: string;
  entries: PlaylistEntry[];
}

export interface VideoMetadata {
  isPlaylist: false;
  url: string;
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  description: string;
  formats: VideoFormat[];
  cookiesUsed?: boolean;
}

export interface DownloadJob {
  id: string;
  url: string;
  formatId: string;
  progress: number;
  speed: string;
  eta: string;
  status: 'pending' | 'downloading' | 'merging' | 'completed' | 'failed';
  error?: string;
  fileName?: string;
  filePath?: string;
  title: string;
  thumbnail?: string;
}
