import { NextResponse } from 'next/server';
import { getYtdlpPath, downloadYtdlp, updateYtdlp } from '@/lib/yt-dlp';
import { getCookieArgs, getCookiesSource, getDefaultProxy } from '@/lib/downloader';
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
    const cookiesSource = getCookiesSource();
    const cookiesConfigured = cookieArgs.length > 0;
    const proxyConfigured = Boolean(getDefaultProxy());

    return NextResponse.json({
      status: 'ready',
      path: ytdlpPath,
      version: stdout.trim(),
      cookiesMode: cookiesSource,
      cookiesConfigured,
      proxyConfigured,
      // Hint for cloud deploys without cookies
      warning: !cookiesConfigured
        ? 'No YouTube cookies configured. YouTube will block most requests on cloud hosts (Render). Set YOUTUBE_COOKIES_B64.'
        : undefined,
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
