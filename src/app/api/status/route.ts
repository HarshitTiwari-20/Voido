import { NextResponse } from 'next/server';
import { getYtdlpPath, downloadYtdlp, updateYtdlp } from '@/lib/yt-dlp';
import { getCookieArgs } from '@/lib/downloader';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function GET() {
  try {
    const ytdlpPath = await getYtdlpPath();
    const { stdout } = await execAsync(`"${ytdlpPath}" --version`);
    const cookieArgs = getCookieArgs();
    const cookiesMode =
      cookieArgs[0] === '--cookies'
        ? 'file'
        : cookieArgs[0] === '--cookies-from-browser'
          ? `browser:${cookieArgs[1]}`
          : 'none';

    return NextResponse.json({
      status: 'ready',
      path: ytdlpPath,
      version: stdout.trim(),
      cookiesMode,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: 'error',
        message: errorMessage(error, 'yt-dlp is not working or not installed'),
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    await downloadYtdlp();
    try {
      await updateYtdlp();
    } catch {
      // downloadYtdlp already fetched latest; update is optional
    }
    return NextResponse.json({
      success: true,
      message: 'yt-dlp updated/downloaded successfully',
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: errorMessage(error, 'Failed to update yt-dlp') },
      { status: 500 }
    );
  }
}
