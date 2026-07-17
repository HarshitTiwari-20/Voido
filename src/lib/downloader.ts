import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { getYtdlpPath } from './yt-dlp';
import type {
  VideoFormat,
  PlaylistEntry,
  PlaylistMetadata,
  VideoMetadata,
  DownloadJob,
} from './types';

// Re-export types for server-side consumers
export type {
  VideoFormat,
  PlaylistEntry,
  PlaylistMetadata,
  VideoMetadata,
  DownloadJob,
};

/**
 * Resolve cookies for yt-dlp.
 * Priority:
 *  1. YOUTUBE_COOKIES env (Netscape cookie file contents)
 *  2. cookies.txt in project root
 *  3. YOUTUBE_COOKIES_FROM_BROWSER env (e.g. "chrome", "brave", "firefox")
 *  4. Auto-detect Chrome / Brave / Firefox profiles (local desktop)
 */
export function getCookiesPath(): string | null {
  if (process.env.YOUTUBE_COOKIES) {
    try {
      const tempCookiesPath = path.join(os.tmpdir(), 'youtube_cookies.txt');
      let cookiesVal = process.env.YOUTUBE_COOKIES.trim();
      if (
        (cookiesVal.startsWith('"') && cookiesVal.endsWith('"')) ||
        (cookiesVal.startsWith("'") && cookiesVal.endsWith("'"))
      ) {
        cookiesVal = cookiesVal.slice(1, -1);
      }
      const cookiesContent = cookiesVal.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
      fs.writeFileSync(tempCookiesPath, cookiesContent, 'utf8');
      return tempCookiesPath;
    } catch (e) {
      console.error('Failed to write YOUTUBE_COOKIES environment variable to temp file:', e);
    }
  }

  const localCookiesPath = path.join(process.cwd(), 'cookies.txt');
  if (fs.existsSync(localCookiesPath)) {
    return localCookiesPath;
  }

  return null;
}

/**
 * Detect a local browser profile for yt-dlp --cookies-from-browser.
 */
function detectBrowserForCookies(): string | null {
  if (process.env.YOUTUBE_AUTO_COOKIES === '0') {
    return null;
  }

  if (process.env.YOUTUBE_COOKIES_FROM_BROWSER) {
    return process.env.YOUTUBE_COOKIES_FROM_BROWSER.trim();
  }

  const home = os.homedir();
  const candidates: Array<{ browser: string; paths: string[] }> = [
    {
      browser: 'chrome',
      paths: [
        path.join(home, '.config/google-chrome'),
        path.join(home, 'Library/Application Support/Google/Chrome'),
      ],
    },
    {
      browser: 'brave',
      paths: [
        path.join(home, '.config/BraveSoftware/Brave-Browser'),
        path.join(home, 'Library/Application Support/BraveSoftware/Brave-Browser'),
      ],
    },
    {
      browser: 'chromium',
      paths: [
        path.join(home, '.config/chromium'),
        path.join(home, 'Library/Application Support/Chromium'),
      ],
    },
    {
      browser: 'firefox',
      paths: [
        path.join(home, '.mozilla/firefox'),
        path.join(home, 'Library/Application Support/Firefox'),
      ],
    },
  ];

  for (const { browser, paths } of candidates) {
    if (paths.some((p) => fs.existsSync(p))) {
      return browser;
    }
  }

  return null;
}

const BROWSER_COOKIES_CACHE = path.join(os.tmpdir(), 'void-downloader-browser-cookies.txt');
const BROWSER_COOKIES_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
const COOKIE_EXPORT_TIMEOUT_MS = 12_000;

/**
 * Export cookies from a local browser once and reuse the Netscape cookie file.
 * NEVER pass --cookies-from-browser to live download/metadata calls — when Chrome
 * is open it can hang indefinitely on the cookie DB lock.
 */
async function exportBrowserCookies(browser: string): Promise<string | null> {
  try {
    if (fs.existsSync(BROWSER_COOKIES_CACHE)) {
      const age = Date.now() - fs.statSync(BROWSER_COOKIES_CACHE).mtimeMs;
      if (age < BROWSER_COOKIES_MAX_AGE_MS && fs.statSync(BROWSER_COOKIES_CACHE).size > 100) {
        return BROWSER_COOKIES_CACHE;
      }
    }

    const ytdlpPath = await getYtdlpPath();
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        ytdlpPath,
        [
          '--cookies-from-browser',
          browser,
          '--cookies',
          BROWSER_COOKIES_CACHE,
          '--skip-download',
          '--no-warnings',
          '--print',
          'id',
          'https://www.youtube.com/watch?v=jNQXAC9IVRw',
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] }
      );

      let err = '';
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('cookie export timed out'));
      }, COOKIE_EXPORT_TIMEOUT_MS);

      child.stderr.on('data', (d) => {
        err += d.toString();
      });
      child.on('close', () => {
        clearTimeout(timer);
        if (fs.existsSync(BROWSER_COOKIES_CACHE) && fs.statSync(BROWSER_COOKIES_CACHE).size > 100) {
          resolve();
        } else {
          reject(new Error(err || 'cookie export failed'));
        }
      });
      child.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });

    return BROWSER_COOKIES_CACHE;
  } catch (e) {
    console.warn('Failed to export browser cookies:', e);
    return null;
  }
}

let browserCookiesExportInFlight: Promise<string | null> | null = null;

function kickoffBrowserCookieExport(): void {
  if (browserCookiesExportInFlight) return;
  if (getCookiesPath()) return;

  const browser = detectBrowserForCookies();
  if (!browser) return;

  // Skip if cache is already fresh
  if (fs.existsSync(BROWSER_COOKIES_CACHE)) {
    try {
      const age = Date.now() - fs.statSync(BROWSER_COOKIES_CACHE).mtimeMs;
      if (age < BROWSER_COOKIES_MAX_AGE_MS && fs.statSync(BROWSER_COOKIES_CACHE).size > 100) {
        return;
      }
    } catch {
      // ignore
    }
  }

  browserCookiesExportInFlight = exportBrowserCookies(browser).finally(() => {
    setTimeout(() => {
      browserCookiesExportInFlight = null;
    }, BROWSER_COOKIES_MAX_AGE_MS);
  });
}

/**
 * Cookie CLI args. Only uses cookie *files* (never --cookies-from-browser inline)
 * so requests never hang on a locked browser profile.
 */
export function getCookieArgs(): string[] {
  const cookiesPath = getCookiesPath();
  if (cookiesPath) {
    return ['--cookies', cookiesPath];
  }

  // Use cached browser export if available
  if (fs.existsSync(BROWSER_COOKIES_CACHE)) {
    try {
      if (fs.statSync(BROWSER_COOKIES_CACHE).size > 100) {
        return ['--cookies', BROWSER_COOKIES_CACHE];
      }
    } catch {
      // ignore
    }
  }

  // Start a background export for future requests (non-blocking)
  kickoffBrowserCookieExport();
  return [];
}

/**
 * Best-effort: wait briefly for browser cookie export, then proceed either way.
 */
export async function ensureCookiesReady(): Promise<void> {
  if (getCookieArgs().length > 0) return;

  kickoffBrowserCookieExport();
  if (!browserCookiesExportInFlight) return;

  try {
    await Promise.race([
      browserCookiesExportInFlight,
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch {
    // proceed without cookies — android player client will still work
  }
}

/**
 * Shared yt-dlp flags used by both metadata and download.
 * Without cookies, force YouTube player clients that bypass bot checks (quality may be capped).
 * With cookies, use default clients so full DASH quality (720p/1080p/4K) is available.
 */
export function getCommonYtdlpArgs(proxy?: string): string[] {
  const cookieArgs = getCookieArgs();
  const hasCookies = cookieArgs.length > 0;

  const args: string[] = [
    '-4', // Force IPv4 to avoid slow DNS/IPv6 lookups
    '--no-warnings',
    '--js-runtimes',
    `node:${process.execPath}`,
    ...cookieArgs,
  ];

  // Default clients need auth; android/web work unauthenticated but often only ~360p progressive.
  if (!hasCookies) {
    args.push('--extractor-args', 'youtube:player_client=android,web,mweb,tv');
  }

  if (proxy) {
    args.push('--proxy', proxy);
  }

  if (fs.existsSync('/usr/bin/ffmpeg')) {
    args.push('--ffmpeg-location', '/usr/bin/ffmpeg');
  }

  return args;
}

/**
 * Build format args for video quality or audio-only extraction.
 */
export function getFormatArgs(formatId: string): string[] {
  if (formatId === 'mp3' || formatId === 'audio' || formatId === 'audio-mp3') {
    // bestaudio may be missing when only progressive formats exist — fall back to best
    return ['-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '0'];
  }

  if (formatId === 'm4a' || formatId === 'audio-m4a') {
    return [
      '-f',
      'bestaudio[ext=m4a]/bestaudio/best',
      '-x',
      '--audio-format',
      'm4a',
      '--audio-quality',
      '0',
    ];
  }

  if (formatId === 'wav' || formatId === 'audio-wav') {
    return ['-f', 'bestaudio/best', '-x', '--audio-format', 'wav'];
  }

  // Resolution-based video selectors with safe fallbacks
  let filter = 'bestvideo+bestaudio/best';
  if (formatId === 'best') {
    filter = 'bestvideo+bestaudio/best';
  } else if (formatId.endsWith('p')) {
    const height = parseInt(formatId, 10);
    if (!isNaN(height)) {
      // Prefer mp4+m4a merge when possible; always fall back to progressive best
      filter = [
        `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]`,
        `bestvideo[height<=${height}]+bestaudio`,
        `best[height<=${height}]`,
        'best',
      ].join('/');
    }
  }

  return ['-f', filter, '--merge-output-format', 'mp4'];
}

const TEMP_DIR = path.join(process.cwd(), 'temp-downloads');

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

// Store download jobs globally to survive Hot Module Replacement (HMR) in development
const globalForDownloads = globalThis as unknown as {
  activeDownloads: Map<string, DownloadJob>;
};

export const activeDownloads =
  globalForDownloads.activeDownloads || new Map<string, DownloadJob>();

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
  }, 10 * 60 * 1000);
}

startCleanupTask();

function sanitizeFileName(name: string): string {
  return name.replace(/[\/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ').trim() || 'download';
}

function extractErrorMessage(stderr: string, fallback: string): string {
  const text = (stderr || '').trim();
  if (!text) return fallback;

  // Prefer the last ERROR: line from yt-dlp
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const errorLines = lines.filter((l) => /ERROR:/i.test(l));
  if (errorLines.length > 0) {
    let msg = errorLines[errorLines.length - 1].replace(/^ERROR:\s*/i, '');
    // Strip extractor prefix like "[youtube] id: "
    msg = msg.replace(/^\[[^\]]+\]\s*[^\s:]+:\s*/, '');
    if (/sign in to confirm/i.test(msg) || /not a bot/i.test(msg)) {
      return (
        'YouTube blocked this request (bot check). ' +
        'Export cookies to cookies.txt in the project root, or keep Chrome/Brave logged into YouTube. ' +
        'See: https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies'
      );
    }
    return msg;
  }

  // Fallback: last few lines
  return lines.slice(-3).join(' ') || fallback;
}

/**
 * Extracts metadata for a given URL using yt-dlp.
 */
export async function getVideoMetadata(
  url: string,
  proxy?: string
): Promise<VideoMetadata | PlaylistMetadata> {
  await ensureCookiesReady();
  const ytdlpPath = await getYtdlpPath();
  const cookieArgs = getCookieArgs();

  return new Promise((resolve, reject) => {
    const args = [
      '--dump-single-json',
      '--flat-playlist',
      ...getCommonYtdlpArgs(proxy),
      url,
    ];

    const child = spawn(ytdlpPath, args);
    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to start yt-dlp: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(
          new Error(
            extractErrorMessage(
              stderrData,
              `Failed to extract metadata (exit code ${code}).`
            )
          )
        );
      }

      try {
        const parsed = JSON.parse(stdoutData);

        if (parsed._type === 'playlist' || parsed._type === 'multi_video') {
          const rawEntries: Array<Record<string, unknown>> = parsed.entries || [];
          const entries: PlaylistEntry[] = rawEntries
            .map((entry) => {
              let entryUrl = typeof entry.url === 'string' ? entry.url : '';
              const entryId = typeof entry.id === 'string' ? entry.id : undefined;
              if (entryUrl && !entryUrl.startsWith('http')) {
                if (url.includes('youtube.com') || url.includes('youtu.be')) {
                  entryUrl = `https://www.youtube.com/watch?v=${entryId || entryUrl}`;
                }
              }
              if (!entryUrl && entryId) {
                if (url.includes('youtube.com') || url.includes('youtu.be')) {
                  entryUrl = `https://www.youtube.com/watch?v=${entryId}`;
                } else {
                  entryUrl = entryId;
                }
              }
              return {
                id: entryId || crypto.randomUUID(),
                title: typeof entry.title === 'string' ? entry.title : 'Untitled Video',
                url: entryUrl,
                duration: typeof entry.duration === 'number' ? entry.duration : 0,
                uploader:
                  typeof entry.uploader === 'string'
                    ? entry.uploader
                    : typeof entry.author === 'string'
                      ? entry.author
                      : '',
              };
            })
            .filter((e: PlaylistEntry) => e.url);

          return resolve({
            isPlaylist: true,
            url,
            title: parsed.title || 'Playlist',
            uploader: parsed.uploader || parsed.uploader_id || '',
            entries,
          });
        }

        const rawFormats = parsed.formats || [];
        const formats: VideoFormat[] = [];

        const heights = new Set<number>();
        (rawFormats as Array<{ height?: number }>).forEach((f) => {
          if (f.height) heights.add(f.height);
        });

        // Best quality first
        formats.push({
          formatId: 'best',
          ext: 'mp4',
          resolution: 'Auto/Best',
          filesize: null,
          fps: null,
          qualityLabel: 'Best Quality (Auto)',
          type: 'combined',
        });

        // Always offer common presets. yt-dlp format strings use height<=N/best
        // so missing resolutions safely fall back to the best available.
        const availableResolutions = [
          { label: '2160p (4K)', val: 2160 },
          { label: '1440p (2K)', val: 1440 },
          { label: '1080p (Full HD)', val: 1080 },
          { label: '720p (HD)', val: 720 },
          { label: '480p', val: 480 },
          { label: '360p', val: 360 },
        ];

        const maxHeight = heights.size > 0 ? Math.max(...Array.from(heights)) : Infinity;

        availableResolutions.forEach((res) => {
          // Hide presets far above source max (e.g. no 4K option for a 360p clip)
          // Keep at least one tier at/above source so "720p" still works via fallback.
          if (maxHeight !== Infinity && res.val > maxHeight + 200 && res.val > 720) {
            return;
          }
          formats.push({
            formatId: `${res.val}p`,
            ext: 'mp4',
            resolution: res.label,
            filesize: null,
            fps: null,
            qualityLabel: res.label,
            type: 'combined',
          });
        });

        // Audio presets — always available (extraction falls back to progressive best)
        formats.push({
          formatId: 'mp3',
          ext: 'mp3',
          resolution: 'Audio only',
          filesize: null,
          fps: null,
          qualityLabel: 'MP3 Audio (High Quality)',
          type: 'audio',
        });
        formats.push({
          formatId: 'm4a',
          ext: 'm4a',
          resolution: 'Audio only',
          filesize: null,
          fps: null,
          qualityLabel: 'M4A Audio (Original Quality)',
          type: 'audio',
        });
        formats.push({
          formatId: 'wav',
          ext: 'wav',
          resolution: 'Audio only',
          filesize: null,
          fps: null,
          qualityLabel: 'WAV Audio (Uncompressed)',
          type: 'audio',
        });

        resolve({
          isPlaylist: false,
          url,
          title: parsed.title || 'Unknown Title',
          thumbnail: parsed.thumbnail || parsed.thumbnails?.[0]?.url || '',
          duration: parsed.duration || 0,
          uploader: parsed.uploader || 'Unknown Uploader',
          description: parsed.description || '',
          formats,
          cookiesUsed: cookieArgs.length > 0,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        reject(new Error(`Failed to parse metadata JSON: ${message}`));
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
  await ensureCookiesReady();
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
    thumbnail,
  };

  activeDownloads.set(downloadId, job);
  onProgress(job);

  const formatArgs = getFormatArgs(formatId);
  const outputTemplate = path.join(TEMP_DIR, `${downloadId}.%(ext)s`);

  const args = [
    url,
    '--newline',
    '--progress',
    '--no-playlist',
    ...getCommonYtdlpArgs(proxy),
    ...formatArgs,
    '-o',
    outputTemplate,
    '--downloader-args',
    'ffmpeg:-threads 0',
    '--postprocessor-args',
    'ffmpeg:-threads 0',
  ];

  const child = spawn(ytdlpPath, args);
  let stderrData = '';

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.includes('[download]') && line.includes('%')) {
        // e.g. "[download]  12.3% of ~10.45MiB at  3.45MiB/s ETA 00:02"
        const matches = line.match(
          /\[download\]\s+([0-9.]+)%(?:\s+of\s+~?[^\s]+)?(?:\s+at\s+([^\s]+))?(?:\s+ETA\s+([^\s]+))?/
        );
        if (matches) {
          const progress = parseFloat(matches[1]);
          const speed = matches[2] && matches[2] !== 'Unknown' ? matches[2] : job.speed;
          const eta = matches[3] && matches[3] !== 'Unknown' ? matches[3] : job.eta;

          job.status = 'downloading';
          // Multi-format downloads restart progress for audio — keep max for UX
          job.progress = Math.max(job.progress, Math.min(progress, 99));
          job.speed = speed || job.speed;
          job.eta = eta || job.eta;
          activeDownloads.set(downloadId, job);
          onProgress(job);
        }
      } else if (
        line.includes('[Merger]') ||
        line.includes('[ExtractAudio]') ||
        line.includes('[ffmpeg]')
      ) {
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
    const text = data.toString();
    stderrData += text;
    console.error(`yt-dlp stderr [${downloadId}]:`, text);
  });

  child.on('error', (err) => {
    job.status = 'failed';
    job.error = `Failed to start yt-dlp: ${err.message}`;
    activeDownloads.set(downloadId, job);
    onProgress(job);
  });

  child.on('close', (code) => {
    if (code !== 0) {
      job.status = 'failed';
      job.error = extractErrorMessage(
        stderrData,
        `yt-dlp process exited with non-zero code ${code}`
      );
      activeDownloads.set(downloadId, job);
      onProgress(job);
      return;
    }

    try {
      const files = fs.readdirSync(TEMP_DIR);
      // Prefer final files over intermediate .part / format fragments
      const matchedFile = files
        .filter(
          (file) =>
            file.startsWith(downloadId) &&
            !file.endsWith('.part') &&
            !file.includes('.f') // skip intermediate f395.mp4 style fragments if merge left any
        )
        .sort((a, b) => {
          // Prefer shorter names (merged final) over fragment names
          return a.length - b.length;
        })[0];

      // Fallback: any non-.part file with this id
      const fallbackFile =
        matchedFile ||
        files.find((file) => file.startsWith(downloadId) && !file.endsWith('.part'));

      if (fallbackFile) {
        const ext = fallbackFile.split('.').pop() || 'mp4';
        job.status = 'completed';
        job.progress = 100;
        job.speed = '0 B/s';
        job.eta = '00:00';
        job.fileName = `${sanitizeFileName(title)}.${ext}`;
        job.filePath = path.join(TEMP_DIR, fallbackFile);

        activeDownloads.set(downloadId, job);
        onProgress(job);
      } else {
        throw new Error('Downloaded file not found in temp directory.');
      }
    } catch (err: unknown) {
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : 'Failed to locate downloaded file';
      activeDownloads.set(downloadId, job);
      onProgress(job);
    }
  });

  return downloadId;
}
