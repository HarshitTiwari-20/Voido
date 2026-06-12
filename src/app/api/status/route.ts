import { NextResponse } from 'next/server';
import { getYtdlpPath, downloadYtdlp } from '@/lib/yt-dlp';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ytdlpPath = await getYtdlpPath();
    const { stdout } = await execAsync(`"${ytdlpPath}" --version`);
    return NextResponse.json({
      status: 'ready',
      path: ytdlpPath,
      version: stdout.trim()
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message || 'yt-dlp is not working or not installed'
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    await downloadYtdlp();
    return NextResponse.json({ success: true, message: 'yt-dlp updated/downloaded successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
