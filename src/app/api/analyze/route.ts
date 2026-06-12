import { NextRequest, NextResponse } from 'next/server';
import { getVideoMetadata } from '@/lib/downloader';

export async function POST(req: NextRequest) {
  try {
    const { url, proxy } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }
    const metadata = await getVideoMetadata(url, proxy);
    return NextResponse.json(metadata);
  } catch (error: any) {
    console.error('Error in analyze route:', error);
    return NextResponse.json({ error: error.message || 'Failed to analyze URL' }, { status: 500 });
  }
}
