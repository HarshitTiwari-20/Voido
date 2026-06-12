import { NextRequest } from 'next/server';
import fs from 'fs';
import { activeDownloads } from '@/lib/downloader';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Missing id parameter', { status: 400 });
  }

  const job = activeDownloads.get(id);
  if (!job || job.status !== 'completed' || !job.filePath || !fs.existsSync(job.filePath)) {
    return new Response('File not found or download not complete', { status: 404 });
  }

  const fileStats = fs.statSync(job.filePath);
  // Fallback to name if not set
  const fileName = job.fileName || 'download';
  
  // Create a Node.js ReadStream
  const fileStream = fs.createReadStream(job.filePath);

  // Convert the Node.js ReadStream to a Web ReadableStream
  const webStream = new ReadableStream({
    start(controller) {
      fileStream.on('data', (chunk) => {
        controller.enqueue(chunk);
      });
      fileStream.on('end', () => {
        controller.close();
        // Clean up the file after it is successfully sent
        setTimeout(() => {
          try {
            if (job.filePath && fs.existsSync(job.filePath)) {
              fs.unlinkSync(job.filePath);
              console.log(`Successfully deleted temp file: ${job.filePath}`);
            }
            activeDownloads.delete(id);
          } catch (e) {
            console.error('Failed to delete temp file after transfer:', e);
          }
        }, 1000); // 1s buffer delay
      });
      fileStream.on('error', (err) => {
        controller.error(err);
      });
    },
    cancel() {
      fileStream.destroy();
      // Clean up the file if the transfer is cancelled
      try {
        if (job.filePath && fs.existsSync(job.filePath)) {
          fs.unlinkSync(job.filePath);
          console.log(`Deleted cancelled temp file: ${job.filePath}`);
        }
        activeDownloads.delete(id);
      } catch (e) {
        console.error('Failed to delete temp file on cancel:', e);
      }
    }
  });

  // Safe header generation for UTF-8 filenames
  const safeFileName = encodeURIComponent(fileName).replace(/['()]/g, escape).replace(/\*/g, '%2A');

  return new Response(webStream, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${safeFileName}`,
      'Content-Length': fileStats.size.toString(),
    },
  });
}
