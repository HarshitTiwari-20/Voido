import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { activeDownloads } from '@/lib/downloader';

export const dynamic = 'force-dynamic';

function contentTypeForFile(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp3':
      return 'audio/mpeg';
    case '.m4a':
      return 'audio/mp4';
    case '.wav':
      return 'audio/wav';
    case '.webm':
      return 'video/webm';
    case '.mp4':
      return 'video/mp4';
    case '.mkv':
      return 'video/x-matroska';
    default:
      return 'application/octet-stream';
  }
}

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
  const fileName = job.fileName || 'download';
  const fileStream = fs.createReadStream(job.filePath);
  const webStream = Readable.toWeb(fileStream) as ReadableStream;

  // Clean up after the stream finishes (success or cancel)
  const cleanup = () => {
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
    }, 1000);
  };

  fileStream.on('end', cleanup);
  fileStream.on('close', () => {
    // If aborted mid-stream, still clean up
    if (!fileStream.readableEnded) cleanup();
  });

  const safeFileName = encodeURIComponent(fileName)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A');
  const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, '_');

  return new Response(webStream, {
    headers: {
      'Content-Type': contentTypeForFile(job.filePath),
      'Content-Disposition': `attachment; filename="${asciiFallback}"; filename*=UTF-8''${safeFileName}`,
      'Content-Length': fileStats.size.toString(),
    },
  });
}
