import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getYtdlpPath } from './yt-dlp';

export interface VideoFormat {
  formatId: string;
  ext: string;
  resolution: string;
  filesize: number | null;
  fps: number | null;
  qualityLabel: string;
  type: 'video' | 'audio' | 'combined';
}

export interface VideoMetadata {
  url: string;
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  description: string;
  formats: VideoFormat[];
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

const TEMP_DIR = path.join(process.cwd(), 'temp-downloads');

// Ensure temp directory exists
function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

// Store download jobs globally to survive Hot Module Replacement (HMR) in development
const globalForDownloads = globalThis as unknown as {
  activeDownloads: Map<string, DownloadJob>;
};

export const activeDownloads = globalForDownloads.activeDownloads || new Map<string, DownloadJob>();

if (process.env.NODE_ENV !== 'production') {
  globalForDownloads.activeDownloads = activeDownloads;
}

/**
 * Clean up files older than 1 hour in the temp directory
 */
export function startCleanupTask() {
  setInterval(() => {
    try {
      if (!fs.existsSync(TEMP_DIR)) return;
      const files = fs.readdirSync(TEMP_DIR);
      const oneHourAgo = Date.now() - 60 * 60 * 1000;

      files.forEach((file) => {
        const filePath = path.join(TEMP_DIR, file);
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs < oneHourAgo) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up old temp file: ${file}`);
        }
      });
    } catch (e) {
      console.error('Error during temp file cleanup:', e);
    }
  }, 10 * 60 * 1000); // run every 10 minutes
}

// Start the cleanup task immediately
startCleanupTask();

/**
 * Extracts metadata for a given URL using yt-dlp.
 */
export async function getVideoMetadata(url: string, proxy?: string): Promise<VideoMetadata> {
  const ytdlpPath = await getYtdlpPath();

  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '-4', // Force IPv4 to avoid slow DNS/IPv6 lookups
    ];
    if (proxy) {
      args.push('--proxy', proxy);
    }
    args.push(url);

    const child = spawn(ytdlpPath, args);
    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Failed to extract metadata. Code: ${code}. Error: ${stderrData || 'Unknown error'}`));
      }

      try {
        const parsed = JSON.parse(stdoutData);
        
        // Curate and group formats
        const rawFormats = parsed.formats || [];
        const formats: VideoFormat[] = [];

        // Build standard options
        // We look through formats to check what resolutions are available
        const heights = new Set<number>();
        rawFormats.forEach((f: any) => {
          if (f.height) heights.add(f.height);
        });

        // Add pre-set profiles if they match the source availability
        // 1. Audio presets
        formats.push({
          formatId: 'mp3',
          ext: 'mp3',
          resolution: 'Audio only',
          filesize: null,
          fps: null,
          qualityLabel: 'MP3 Audio (High Quality)',
          type: 'audio'
        });
        formats.push({
          formatId: 'm4a',
          ext: 'm4a',
          resolution: 'Audio only',
          filesize: null,
          fps: null,
          qualityLabel: 'M4A Audio (Original Quality)',
          type: 'audio'
        });

        // 2. Video presets based on availability
        const availableResolutions = [
          { label: '360p', val: 360 },
          { label: '480p', val: 480 },
          { label: '720p (HD)', val: 720 },
          { label: '1080p (Full HD)', val: 1080 },
          { label: '1440p (2K)', val: 1440 },
          { label: '2160p (4K)', val: 2160 },
        ];

        // Find matches or provide the best default
        availableResolutions.forEach((res) => {
          // If we have heights close to the standard or if it's generally supported
          const hasHeight = Array.from(heights).some(h => Math.abs(h - res.val) < 20);
          if (hasHeight) {
            formats.push({
              formatId: `${res.val}p`,
              ext: 'mp4',
              resolution: res.label,
              filesize: null,
              fps: null,
              qualityLabel: res.label,
              type: 'combined'
            });
          }
        });

        // Always add a 'best' option
        formats.push({
          formatId: 'best',
          ext: 'mp4',
          resolution: 'Auto/Best',
          filesize: null,
          fps: null,
          qualityLabel: 'Best Quality (Auto)',
          type: 'combined'
        });

        // Filter and return metadata
        resolve({
          url,
          title: parsed.title || 'Unknown Title',
          thumbnail: parsed.thumbnail || parsed.thumbnails?.[0]?.url || '',
          duration: parsed.duration || 0,
          uploader: parsed.uploader || 'Unknown Uploader',
          description: parsed.description || '',
          formats: formats.reverse() // Best first
        });
      } catch (err: any) {
        reject(new Error(`Failed to parse metadata JSON: ${err.message}`));
      }
    });
  });
}

/**
 * Starts a download job and updates its progress.
 */
export async function startDownload(
  url: string,
  formatId: string,
  title: string,
  thumbnail: string,
  onProgress: (job: DownloadJob) => void,
  proxy?: string
): Promise<string> {
  ensureTempDir();
  const ytdlpPath = await getYtdlpPath();
  const downloadId = crypto.randomUUID();

  const job: DownloadJob = {
    id: downloadId,
    url,
    formatId,
    progress: 0,
    speed: '0 B/s',
    eta: 'unknown',
    status: 'pending',
    title,
    thumbnail
  };

  activeDownloads.set(downloadId, job);
  onProgress(job);

  // Set command line arguments based on selected formatId
  let formatArgs: string[] = [];
  let outputTemplate = path.join(TEMP_DIR, `${downloadId}.%(ext)s`);

  if (formatId === 'mp3') {
    formatArgs = ['-f', 'bestaudio', '-x', '--audio-format', 'mp3', '--audio-quality', '0'];
  } else if (formatId === 'm4a') {
    formatArgs = ['-f', 'bestaudio[ext=m4a]/bestaudio', '-x', '--audio-format', 'm4a'];
  } else {
    // Resolution-based format selectors
    let filter = 'bestvideo+bestaudio/best';
    if (formatId.endsWith('p')) {
      const height = parseInt(formatId);
      if (!isNaN(height)) {
        filter = `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
      }
    }
    formatArgs = ['-f', filter, '--merge-output-format', 'mp4'];
  }

  const args = [
    url,
    '--newline',
    '--progress',
    '-4', // Force IPv4 to avoid slow DNS/IPv6 lookups
    '--no-warnings',
    ...formatArgs,
    '-o', outputTemplate,
    '--no-playlist'
  ];

  if (proxy) {
    args.push('--proxy', proxy);
  }

  // Try to use system ffmpeg if available
  if (fs.existsSync('/usr/bin/ffmpeg')) {
    args.push('--ffmpeg-location', '/usr/bin/ffmpeg');
  }

  const child = spawn(ytdlpPath, args);

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.includes('[download]') && line.includes('%')) {
        // Parse progress e.g., "[download]  12.3% of ~10.45MiB at  3.45MiB/s ETA 00:02"
        const matches = line.match(/\[download\]\s+([0-9.]+)%\s+of\s+~?([^\s]+)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)/);
        if (matches) {
          const progress = parseFloat(matches[1]);
          const speed = matches[3];
          const eta = matches[4];
          
          job.status = 'downloading';
          job.progress = progress;
          job.speed = speed;
          job.eta = eta;
          activeDownloads.set(downloadId, job);
          onProgress(job);
        }
      } else if (line.includes('[Merger]') || line.includes('[ffmpeg]')) {
        job.status = 'merging';
        job.progress = 99;
        job.speed = '0 B/s';
        job.eta = '00:00';
        activeDownloads.set(downloadId, job);
        onProgress(job);
      }
    }
  });

  child.stderr.on('data', (data) => {
    console.error(`yt-dlp stderr [${downloadId}]:`, data.toString());
  });

  child.on('close', (code) => {
    if (code !== 0) {
      job.status = 'failed';
      job.error = `yt-dlp process exited with non-zero code ${code}`;
      activeDownloads.set(downloadId, job);
      onProgress(job);
      return;
    }

    // Locate the output file in temp directory
    try {
      const files = fs.readdirSync(TEMP_DIR);
      const matchedFile = files.find(file => file.startsWith(downloadId));

      if (matchedFile) {
        job.status = 'completed';
        job.progress = 100;
        job.speed = '0 B/s';
        job.eta = '00:00';
        job.fileName = `${title.replace(/[\/\\?%*:|"<>]/g, '_')}.${matchedFile.split('.').pop()}`;
        job.filePath = path.join(TEMP_DIR, matchedFile);
        
        activeDownloads.set(downloadId, job);
        onProgress(job);
      } else {
        throw new Error('Downloaded file not found in temp directory.');
      }
    } catch (err: any) {
      job.status = 'failed';
      job.error = err.message || 'Failed to locate downloaded file';
      activeDownloads.set(downloadId, job);
      onProgress(job);
    }
  });

  return downloadId;
}
