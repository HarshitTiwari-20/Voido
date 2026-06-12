import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BIN_DIR = path.join(process.cwd(), 'bin');
const IS_WIN = process.platform === 'win32';
const YTDLP_PATH = path.join(BIN_DIR, IS_WIN ? 'yt-dlp.exe' : 'yt-dlp');

/**
 * Ensures that the bin directory exists.
 */
function ensureBinDir() {
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }
}

/**
 * Returns the path to the yt-dlp executable.
 * Prioritizes the local binary in the bin/ folder, and falls back to a global installation.
 */
export async function getYtdlpPath(): Promise<string> {
  ensureBinDir();

  // 1. Check if local binary exists
  if (fs.existsSync(YTDLP_PATH)) {
    return YTDLP_PATH;
  }

  // 2. Check if yt-dlp is available in the system PATH
  try {
    const { stdout } = await execAsync(IS_WIN ? 'where yt-dlp' : 'which yt-dlp');
    const systemPath = stdout.trim();
    if (systemPath) {
      return systemPath;
    }
  } catch (e) {
    // Not found in system PATH
  }

  // 3. If not found, download it
  await downloadYtdlp();
  return YTDLP_PATH;
}

/**
 * Downloads the latest version of yt-dlp from the official GitHub repository.
 */
export async function downloadYtdlp(): Promise<void> {
  ensureBinDir();
  
  const url = IS_WIN
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

  console.log(`Downloading yt-dlp from ${url}...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download yt-dlp: ${response.statusText}`);
  }

  const fileStream = fs.createWriteStream(YTDLP_PATH);
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error('Failed to read response body for yt-dlp download.');
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fileStream.write(Buffer.from(value));
  }

  fileStream.end();

  // Set executable permissions on non-Windows systems
  if (!IS_WIN) {
    fs.chmodSync(YTDLP_PATH, 0o755);
  }

  console.log('yt-dlp downloaded and configured successfully.');
}

/**
 * Checks for updates for the local yt-dlp binary.
 */
export async function updateYtdlp(): Promise<string> {
  const binaryPath = await getYtdlpPath();
  try {
    const { stdout } = await execAsync(`"${binaryPath}" -U`);
    return stdout;
  } catch (error: any) {
    throw new Error(`Failed to update yt-dlp: ${error.message}`);
  }
}
