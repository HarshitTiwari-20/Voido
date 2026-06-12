import { NextRequest } from 'next/server';
import { startDownload } from '@/lib/downloader';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const formatId = searchParams.get('formatId');
  const title = searchParams.get('title') || 'video';
  const thumbnail = searchParams.get('thumbnail') || '';
  const proxy = searchParams.get('proxy') || '';

  if (!url || !formatId) {
    return new Response('Missing parameters', { status: 400 });
  }

  let isClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      
      const sendEvent = (event: string, data: any) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          // Stream might have been closed already
        }
      };

      try {
        await startDownload(url, formatId, title, thumbnail, (job) => {
          sendEvent('progress', job);
          
          if (job.status === 'completed') {
            sendEvent('complete', { downloadId: job.id, fileName: job.fileName });
            isClosed = true;
            try {
              controller.close();
            } catch (e) {}
          } else if (job.status === 'failed') {
            sendEvent('failed', { error: job.error });
            isClosed = true;
            try {
              controller.close();
            } catch (e) {}
          }
        }, proxy);
      } catch (error: any) {
        sendEvent('failed', { error: error.message || 'Failed to start download' });
        isClosed = true;
        try {
          controller.close();
        } catch (e) {}
      }
    },
    cancel() {
      isClosed = true;
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
