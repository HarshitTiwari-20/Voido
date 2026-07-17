import { NextRequest, NextResponse } from 'next/server';
import { getVideoMetadata } from '@/lib/downloader';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = typeof body?.url === 'string' ? body.url : '';
    const proxy = typeof body?.proxy === 'string' ? body.proxy : undefined;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const metadata = await getVideoMetadata(url, proxy);
    return NextResponse.json(metadata);
  } catch (error: unknown) {
    console.error('Error in analyze route:', error);
    const message = error instanceof Error ? error.message : 'Failed to analyze URL';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
