'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, AlertCircle, RefreshCw, Cpu } from 'lucide-react';
import AnalyzerInput from '@/components/AnalyzerInput';
import VideoDetails from '@/components/VideoDetails';
import ProgressTracker from '@/components/ProgressTracker';
import DownloadHistory, { HistoryItem } from '@/components/DownloadHistory';
import PlaylistDetails from '@/components/PlaylistDetails';
import QueueTracker, { QueueItem } from '@/components/QueueTracker';
import { VideoMetadata, PlaylistMetadata, DownloadJob } from '@/lib/downloader';

export default function Home() {
  const [url, setUrl] = useState('');
  const [proxy, setProxy] = useState('');
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [playlistMetadata, setPlaylistMetadata] = useState<PlaylistMetadata | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<DownloadJob | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [ytdlpStatus, setYtdlpStatus] = useState<{
    status: 'ready' | 'loading' | 'error';
    version?: string;
    message?: string;
  }>({ status: 'loading' });

  // Playlist queue states
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(-1);
  const [cancelQueue, setCancelQueue] = useState(false);

  // Fetch yt-dlp status on mount
  useEffect(() => {
    checkYtdlpStatus();

    const savedHistory = localStorage.getItem('downloader_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  // Sequential queue runner
  useEffect(() => {
    if (currentQueueIndex < 0 || currentQueueIndex >= queue.length || cancelQueue) {
      if (cancelQueue) {
        setCurrentQueueIndex(-1);
        setQueue([]);
        setCancelQueue(false);
      }
      return;
    }

    const activeItem = queue[currentQueueIndex];
    if (activeItem.status !== 'pending') return;

    // Start download for active queue item
    const params = new URLSearchParams({
      url: activeItem.url,
      formatId: activeItem.formatId,
      title: activeItem.title,
      thumbnail: '',
      proxy: proxy
    });

    const eventSource = new EventSource(`/api/download?${params.toString()}`);

    // Update state to 'downloading'
    setQueue(prev => prev.map((item, idx) => 
      idx === currentQueueIndex ? { ...item, status: 'downloading' } : item
    ));

    eventSource.addEventListener('progress', (e: any) => {
      const job = JSON.parse(e.data);
      setQueue(prev => prev.map((item, idx) => 
        idx === currentQueueIndex ? { 
          ...item, 
          status: job.status, 
          progress: job.progress,
          speed: job.speed,
          eta: job.eta
        } : item
      ));
    });

    eventSource.addEventListener('complete', (e: any) => {
      const data = JSON.parse(e.data);
      eventSource.close();

      // Mark current item completed
      setQueue(prev => prev.map((item, idx) => 
        idx === currentQueueIndex ? { ...item, status: 'completed', progress: 100 } : item
      ));

      // Add to history
      const newItem: HistoryItem = {
        id: data.downloadId,
        title: activeItem.title,
        thumbnail: '',
        formatId: activeItem.formatId,
        url: activeItem.url,
        timestamp: Date.now()
      };
      setHistory(prev => {
        const updated = [newItem, ...prev].slice(0, 20);
        localStorage.setItem('downloader_history', JSON.stringify(updated));
        return updated;
      });

      // Trigger actual download in the browser
      window.location.href = `/api/download/file?id=${data.downloadId}`;

      // Move to next item after 1.5 seconds
      setTimeout(() => {
        setCurrentQueueIndex(prev => prev + 1);
      }, 1500);
    });

    eventSource.addEventListener('failed', (e: any) => {
      const data = JSON.parse(e.data);
      eventSource.close();

      // Mark current item failed
      setQueue(prev => prev.map((item, idx) => 
        idx === currentQueueIndex ? { ...item, status: 'failed', error: data.error || 'Failed' } : item
      ));

      // Proceed to the next video after 1.5 seconds (so one failure doesn't break the whole queue)
      setTimeout(() => {
        setCurrentQueueIndex(prev => prev + 1);
      }, 1500);
    });

    eventSource.onerror = () => {
      eventSource.close();
      setQueue(prev => prev.map((item, idx) => 
        idx === currentQueueIndex ? { ...item, status: 'failed', error: 'Connection lost' } : item
      ));

      setTimeout(() => {
        setCurrentQueueIndex(prev => prev + 1);
      }, 1500);
    };

    return () => {
      eventSource.close();
    };
  }, [currentQueueIndex, queue.length, cancelQueue, proxy]);

  const checkYtdlpStatus = async () => {
    setYtdlpStatus({ status: 'loading' });
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (res.ok && data.status === 'ready') {
        setYtdlpStatus({ status: 'ready', version: data.version });
      } else {
        setYtdlpStatus({ status: 'error', message: data.message });
      }
    } catch (err: any) {
      setYtdlpStatus({ status: 'error', message: err.message || 'Failed to connect to backend' });
    }
  };

  const handleUpdateYtdlp = async () => {
    setYtdlpStatus({ status: 'loading' });
    try {
      const res = await fetch('/api/status', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        checkYtdlpStatus();
      } else {
        setYtdlpStatus({ status: 'error', message: data.error });
      }
    } catch (err: any) {
      setYtdlpStatus({ status: 'error', message: err.message });
    }
  };

  const handleAnalyze = async (inputUrl: string, inputProxy: string = '') => {
    setUrl(inputUrl);
    setProxy(inputProxy);
    setIsAnalyzing(true);
    setError(null);
    setMetadata(null);
    setPlaylistMetadata(null);
    setActiveJob(null);
    setQueue([]);
    setCurrentQueueIndex(-1);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl, proxy: inputProxy }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze URL');
      }

      if (data.isPlaylist) {
        setPlaylistMetadata(data);
      } else {
        setMetadata(data);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong while fetching video details.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadStart = (formatId: string) => {
    if (!metadata) return;
    setError(null);

    const params = new URLSearchParams({
      url: metadata.url,
      formatId,
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      proxy: proxy
    });

    const eventSource = new EventSource(`/api/download?${params.toString()}`);

    setActiveJob({
      id: '',
      url: metadata.url,
      formatId,
      progress: 0,
      speed: '0 B/s',
      eta: 'Calculating...',
      status: 'pending',
      title: metadata.title,
      thumbnail: metadata.thumbnail
    });

    eventSource.addEventListener('progress', (e: any) => {
      const job = JSON.parse(e.data) as DownloadJob;
      setActiveJob(job);
    });

    eventSource.addEventListener('complete', (e: any) => {
      const data = JSON.parse(e.data);
      
      const newItem: HistoryItem = {
        id: data.downloadId,
        title: metadata?.title || 'Unknown Video',
        thumbnail: metadata?.thumbnail || '',
        formatId,
        url: metadata?.url || '',
        timestamp: Date.now()
      };

      setHistory(prev => {
        const updated = [newItem, ...prev].slice(0, 20);
        localStorage.setItem('downloader_history', JSON.stringify(updated));
        return updated;
      });

      setActiveJob(prev => prev ? { ...prev, status: 'completed', progress: 100 } : null);
      eventSource.close();

      window.location.href = `/api/download/file?id=${data.downloadId}`;
    });

    eventSource.addEventListener('failed', (e: any) => {
      const data = JSON.parse(e.data);
      setError(data.error || 'Download process failed.');
      setActiveJob(prev => prev ? { ...prev, status: 'failed', error: data.error } : null);
      eventSource.close();
    });

    eventSource.onerror = () => {
      setError('Connection to download stream was lost.');
      setActiveJob(prev => prev ? { ...prev, status: 'failed', error: 'Connection lost' } : null);
      eventSource.close();
    };
  };

  const handleStartBatchDownload = (selectedVideos: { title: string; url: string }[], formatId: string) => {
    setError(null);
    setPlaylistMetadata(null);

    const initialQueue: QueueItem[] = selectedVideos.map((video, idx) => ({
      id: `item-${idx}-${Date.now()}`,
      title: video.title,
      url: video.url,
      formatId,
      status: 'pending',
      progress: 0,
      speed: '0 B/s',
      eta: 'Waiting...'
    }));

    setQueue(initialQueue);
    setCurrentQueueIndex(0);
  };

  const handleRemoveHistoryItem = (id: string) => {
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem('downloader_history', JSON.stringify(updated));
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('downloader_history');
  };

  const resetAll = () => {
    setMetadata(null);
    setPlaylistMetadata(null);
    setActiveJob(null);
    setQueue([]);
    setCurrentQueueIndex(-1);
    setError(null);
  };

  const isQueueRunning = currentQueueIndex >= 0 && currentQueueIndex < queue.length;

  return (
    <div className="app-container">
      <header>
        <h1 className="logo">
          <Sparkles size={24} style={{ color: 'var(--accent-primary)' }} />
          StreamVibe <span style={{ fontWeight: 300, fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Downloader</span>
        </h1>
        <div className="system-status">
          {ytdlpStatus.status === 'ready' && (
            <>
              <span className="status-dot active"></span>
              <span>yt-dlp v{ytdlpStatus.version}</span>
            </>
          )}
          {ytdlpStatus.status === 'loading' && (
            <>
              <span className="status-dot loading"></span>
              <span>Preparing environment...</span>
            </>
          )}
          {ytdlpStatus.status === 'error' && (
            <>
              <span className="status-dot inactive"></span>
              <span style={{ cursor: 'pointer' }} onClick={handleUpdateYtdlp}>Setup error (click to retry)</span>
            </>
          )}
        </div>
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <section className="hero">
          <h1>Download Any Video Instantly</h1>
          <p>Paste a link from YouTube, Twitter, Instagram, Facebook, TikTok, or other 1000+ supported sites to save video & audio in high quality.</p>
        </section>

        {ytdlpStatus.status === 'loading' && (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
            <RefreshCw className="spinner" size={48} style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }} />
            <h3 style={{ marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>Setting up Downloader Engine</h3>
            <p style={{ color: 'var(--text-secondary)' }}>We are fetching the latest backend binaries from GitHub. This only happens once.</p>
          </div>
        )}

        {ytdlpStatus.status === 'error' && (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
            <AlertCircle size={48} style={{ color: 'var(--error)', marginBottom: '1rem' }} />
            <h3 style={{ marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>Engine Initialization Failed</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{ytdlpStatus.message || 'Could not launch yt-dlp engine.'}</p>
            <button onClick={handleUpdateYtdlp} className="btn btn-primary">
              <Cpu size={18} />
              Re-initialize Engine
            </button>
          </div>
        )}

        {ytdlpStatus.status === 'ready' && (
          <>
            {error && (
              <div className="alert-banner error">
                <AlertCircle size={20} style={{ flexShrink: 0 }} />
                <div>{error}</div>
              </div>
            )}

            {!activeJob && !isQueueRunning && (
              <AnalyzerInput onAnalyze={handleAnalyze} isLoading={isAnalyzing} initialProxy={proxy} />
            )}

            {metadata && !activeJob && !isQueueRunning && (
              <VideoDetails metadata={metadata} onDownloadStart={handleDownloadStart} />
            )}

            {playlistMetadata && !activeJob && !isQueueRunning && (
              <PlaylistDetails metadata={playlistMetadata} onStartBatchDownload={handleStartBatchDownload} />
            )}

            {activeJob && (
              <ProgressTracker
                job={activeJob}
                onReset={resetAll}
              />
            )}

            {isQueueRunning && (
              <QueueTracker
                queue={queue}
                currentIndex={currentQueueIndex}
                onCancelQueue={() => setCancelQueue(true)}
              />
            )}

            {!activeJob && !isQueueRunning && !isAnalyzing && (
              <DownloadHistory
                history={history}
                onRemoveItem={handleRemoveHistoryItem}
                onClearAll={handleClearHistory}
                onSelectUrl={(url) => handleAnalyze(url, proxy)}
              />
            )}
          </>
        )}
      </main>

      <footer>
        <p>StreamVibe Downloader • Powered by Next.js & yt-dlp • Free & Open Source</p>
      </footer>
    </div>
  );
}
