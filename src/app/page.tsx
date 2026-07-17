'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, AlertCircle, RefreshCw, Cpu, Video, Clock } from 'lucide-react';
import AnalyzerInput from '@/components/AnalyzerInput';
import VideoDetails from '@/components/VideoDetails';
import ProgressTracker from '@/components/ProgressTracker';
import DownloadHistory, { HistoryItem } from '@/components/DownloadHistory';
import PlaylistDetails from '@/components/PlaylistDetails';
import QueueTracker, { QueueItem } from '@/components/QueueTracker';
import type { VideoMetadata, PlaylistMetadata, DownloadJob } from '@/lib/types';

function loadHistory(): HistoryItem[] {
  try {
    const saved = localStorage.getItem('downloader_history');
    if (!saved) return [];
    const parsed = JSON.parse(saved) as HistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function Home() {
  const [proxy, setProxy] = useState('');
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [playlistMetadata, setPlaylistMetadata] = useState<PlaylistMetadata | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<DownloadJob | null>(null);
  // Always start empty so SSR and first client render match; hydrate after mount
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyReady, setHistoryReady] = useState(false);
  const [activeView, setActiveView] = useState<'downloader' | 'playlist-calc'>('downloader');
  const [ytdlpStatus, setYtdlpStatus] = useState<{
    status: 'ready' | 'loading' | 'error';
    version?: string;
    message?: string;
  }>({ status: 'loading' });

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(-1);
  const [cancelQueue, setCancelQueue] = useState(false);
  const queueRef = useRef(queue);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  // Hydrate localStorage history after mount (avoids SSR/client mismatch)
  useEffect(() => {
    const saved = loadHistory();
    // Defer so we never sync-setState in the effect body per react-hooks lint
    const t = setTimeout(() => {
      setHistory(saved);
      setHistoryReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const checkYtdlpStatus = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setYtdlpStatus({ status: 'loading' });
    }
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (res.ok && data.status === 'ready') {
        setYtdlpStatus({ status: 'ready', version: data.version });
      } else {
        setYtdlpStatus({ status: 'error', message: data.message });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect to backend';
      setYtdlpStatus({ status: 'error', message });
    }
  }, []);

  // Fetch yt-dlp status on mount (async only — no sync setState in effect)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.status === 'ready') {
          setYtdlpStatus({ status: 'ready', version: data.version });
        } else {
          setYtdlpStatus({ status: 'error', message: data.message });
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to connect to backend';
        setYtdlpStatus({ status: 'error', message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sequential queue runner
  useEffect(() => {
    if (cancelQueue) {
      // Defer state reset so we don't setState synchronously in the effect body
      const t = setTimeout(() => {
        setCurrentQueueIndex(-1);
        setQueue([]);
        setCancelQueue(false);
      }, 0);
      return () => clearTimeout(t);
    }

    if (currentQueueIndex < 0 || currentQueueIndex >= queueRef.current.length) {
      return;
    }

    const activeItem = queueRef.current[currentQueueIndex];
    if (!activeItem || activeItem.status !== 'pending') return;

    const params = new URLSearchParams({
      url: activeItem.url,
      formatId: activeItem.formatId,
      title: activeItem.title,
      thumbnail: '',
      proxy: proxy,
    });

    const eventSource = new EventSource(`/api/download?${params.toString()}`);

    // Mark downloading after microtask to avoid sync setState-in-effect lint
    const markTimer = setTimeout(() => {
      setQueue((prev) =>
        prev.map((item, idx) =>
          idx === currentQueueIndex ? { ...item, status: 'downloading' } : item
        )
      );
    }, 0);

    eventSource.addEventListener('progress', (e: MessageEvent<string>) => {
      const job = JSON.parse(e.data) as DownloadJob;
      setQueue((prev) =>
        prev.map((item, idx) =>
          idx === currentQueueIndex
            ? {
                ...item,
                status: job.status,
                progress: job.progress,
                speed: job.speed,
                eta: job.eta,
              }
            : item
        )
      );
    });

    eventSource.addEventListener('complete', (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as { downloadId: string; fileName?: string };
      eventSource.close();

      setQueue((prev) =>
        prev.map((item, idx) =>
          idx === currentQueueIndex ? { ...item, status: 'completed', progress: 100 } : item
        )
      );

      const newItem: HistoryItem = {
        id: data.downloadId,
        title: activeItem.title,
        thumbnail: '',
        formatId: activeItem.formatId,
        url: activeItem.url,
        timestamp: Date.now(),
      };
      setHistory((prev) => {
        const updated = [newItem, ...prev].slice(0, 20);
        localStorage.setItem('downloader_history', JSON.stringify(updated));
        return updated;
      });

      window.location.href = `/api/download/file?id=${data.downloadId}`;

      setTimeout(() => {
        setCurrentQueueIndex((prev) => prev + 1);
      }, 1500);
    });

    eventSource.addEventListener('failed', (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as { error?: string };
      eventSource.close();

      setQueue((prev) =>
        prev.map((item, idx) =>
          idx === currentQueueIndex
            ? { ...item, status: 'failed', error: data.error || 'Failed' }
            : item
        )
      );

      setTimeout(() => {
        setCurrentQueueIndex((prev) => prev + 1);
      }, 1500);
    });

    eventSource.onerror = () => {
      eventSource.close();
      setQueue((prev) =>
        prev.map((item, idx) =>
          idx === currentQueueIndex
            ? { ...item, status: 'failed', error: 'Connection lost' }
            : item
        )
      );

      setTimeout(() => {
        setCurrentQueueIndex((prev) => prev + 1);
      }, 1500);
    };

    return () => {
      clearTimeout(markTimer);
      eventSource.close();
    };
  }, [currentQueueIndex, cancelQueue, proxy]);

  const handleUpdateYtdlp = async () => {
    setYtdlpStatus({ status: 'loading' });
    try {
      const res = await fetch('/api/status', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await checkYtdlpStatus();
      } else {
        setYtdlpStatus({ status: 'error', message: data.error });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed';
      setYtdlpStatus({ status: 'error', message });
    }
  };

  const handleAnalyze = async (inputUrl: string, inputProxy: string = '') => {
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
        setPlaylistMetadata(data as PlaylistMetadata);
      } else {
        setMetadata(data as VideoMetadata);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong while fetching video details.';
      setError(message);
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
      proxy: proxy,
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
      thumbnail: metadata.thumbnail,
    });

    eventSource.addEventListener('progress', (e: MessageEvent<string>) => {
      const job = JSON.parse(e.data) as DownloadJob;
      setActiveJob(job);
    });

    eventSource.addEventListener('complete', (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as { downloadId: string };

      const newItem: HistoryItem = {
        id: data.downloadId,
        title: metadata.title || 'Unknown Video',
        thumbnail: metadata.thumbnail || '',
        formatId,
        url: metadata.url || '',
        timestamp: Date.now(),
      };

      setHistory((prev) => {
        const updated = [newItem, ...prev].slice(0, 20);
        localStorage.setItem('downloader_history', JSON.stringify(updated));
        return updated;
      });

      setActiveJob((prev) => (prev ? { ...prev, status: 'completed', progress: 100 } : null));
      eventSource.close();

      window.location.href = `/api/download/file?id=${data.downloadId}`;
    });

    eventSource.addEventListener('failed', (e: MessageEvent<string>) => {
      const data = JSON.parse(e.data) as { error?: string };
      setError(data.error || 'Download process failed.');
      setActiveJob((prev) =>
        prev ? { ...prev, status: 'failed', error: data.error } : null
      );
      eventSource.close();
    });

    eventSource.onerror = () => {
      setError('Connection to download stream was lost.');
      setActiveJob((prev) =>
        prev ? { ...prev, status: 'failed', error: 'Connection lost' } : null
      );
      eventSource.close();
    };
  };

  const handleStartBatchDownload = (
    selectedVideos: { title: string; url: string }[],
    formatId: string
  ) => {
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
      eta: 'Waiting...',
    }));

    setQueue(initialQueue);
    setCurrentQueueIndex(0);
  };

  const handleRemoveHistoryItem = (id: string) => {
    const updated = history.filter((item) => item.id !== id);
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

  const handleViewChange = (view: 'downloader' | 'playlist-calc') => {
    setActiveView(view);
    resetAll();
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatLengthLong = (seconds: number): string => {
    if (seconds <= 0) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.round(seconds % 60);

    const parts: string[] = [];
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0) parts.push(`${mins}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    return parts.join(' ');
  };

  const isQueueRunning = currentQueueIndex >= 0 && currentQueueIndex < queue.length;

  return (
    <div className="app-layout">
      <aside className="sidebar-left">
        <h1 className="logo" style={{ marginBottom: '1rem' }}>
          <Sparkles size={24} style={{ color: 'var(--accent-primary)' }} />
          Void
        </h1>

        <nav className="sidebar-nav">
          <button
            onClick={() => handleViewChange('downloader')}
            className={`nav-btn ${activeView === 'downloader' ? 'active' : ''}`}
          >
            <Video size={18} />
            Video Downloader
          </button>
          <button
            onClick={() => handleViewChange('playlist-calc')}
            className={`nav-btn ${activeView === 'playlist-calc' ? 'active' : ''}`}
          >
            <Clock size={18} />
            Playlist Calculator
          </button>
        </nav>

        <div className="engine-status-sidebar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-muted)',
                fontWeight: '600',
              }}
            >
              Engine Status
            </span>
            <div
              className="system-status"
              style={{
                border: 'none',
                background: 'rgba(255,255,255,0.02)',
                padding: '0.5rem 0.75rem',
                display: 'flex',
                justifyContent: 'flex-start',
                width: '100%',
              }}
            >
              {ytdlpStatus.status === 'ready' && (
                <>
                  <span className="status-dot active" style={{ marginRight: '0.5rem' }}></span>
                  <span style={{ fontSize: '0.8rem' }}>yt-dlp v{ytdlpStatus.version}</span>
                </>
              )}
              {ytdlpStatus.status === 'loading' && (
                <>
                  <span className="status-dot loading" style={{ marginRight: '0.5rem' }}></span>
                  <span style={{ fontSize: '0.8rem' }}>Initializing...</span>
                </>
              )}
              {ytdlpStatus.status === 'error' && (
                <>
                  <span className="status-dot inactive" style={{ marginRight: '0.5rem' }}></span>
                  <span
                    style={{ fontSize: '0.8rem', cursor: 'pointer' }}
                    onClick={handleUpdateYtdlp}
                  >
                    Setup error (retry)
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <section className="hero" style={{ textAlign: 'left', margin: '0 0 1rem' }}>
          <h1 style={{ fontSize: '2.2rem' }}>
            {activeView === 'downloader' ? 'Download Any Video' : 'Playlist Length Calculator'}
          </h1>
          <p style={{ margin: '0.5rem 0 0', fontSize: '1rem', color: 'var(--text-secondary)' }}>
            {activeView === 'downloader'
              ? 'Paste a link from YouTube, Twitter, Instagram, TikTok, or other sites. Download full video or sound only (MP3/M4A/WAV).'
              : 'Calculate the total duration, watch time at multiple speeds, and select custom video ranges.'}
          </p>
        </section>

        {ytdlpStatus.status === 'loading' && (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
            <RefreshCw
              className="spinner"
              size={48}
              style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }}
            />
            <h3 style={{ marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>
              Setting up Downloader Engine
            </h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              We are fetching the latest backend binaries from GitHub. This only happens once.
            </p>
          </div>
        )}

        {ytdlpStatus.status === 'error' && (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
            <AlertCircle size={48} style={{ color: 'var(--error)', marginBottom: '1rem' }} />
            <h3 style={{ marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>
              Engine Initialization Failed
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              {ytdlpStatus.message || 'Could not launch yt-dlp engine.'}
            </p>
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

            {activeView === 'downloader' && (
              <>
                {!activeJob && !isQueueRunning && !isAnalyzing && (
                  <AnalyzerInput
                    onAnalyze={handleAnalyze}
                    isLoading={isAnalyzing}
                    initialProxy={proxy}
                  />
                )}

                {isAnalyzing && (
                  <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
                    <RefreshCw
                      className="spinner"
                      size={48}
                      style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }}
                    />
                    <h3 style={{ marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>
                      Analyzing Link
                    </h3>
                    <p style={{ color: 'var(--text-secondary)' }}>Extracting stream metadata...</p>
                  </div>
                )}

                {metadata && !activeJob && !isQueueRunning && (
                  <VideoDetails metadata={metadata} onDownloadStart={handleDownloadStart} />
                )}

                {playlistMetadata && !activeJob && !isQueueRunning && (
                  <PlaylistDetails
                    key={playlistMetadata.url}
                    metadata={playlistMetadata}
                    onStartBatchDownload={handleStartBatchDownload}
                  />
                )}

                {activeJob && <ProgressTracker job={activeJob} onReset={resetAll} />}

                {isQueueRunning && (
                  <QueueTracker
                    queue={queue}
                    currentIndex={currentQueueIndex}
                    onCancelQueue={() => setCancelQueue(true)}
                  />
                )}
              </>
            )}

            {activeView === 'playlist-calc' && (
              <>
                {!isAnalyzing && !metadata && !playlistMetadata && (
                  <AnalyzerInput
                    onAnalyze={handleAnalyze}
                    isLoading={isAnalyzing}
                    initialProxy={proxy}
                  />
                )}

                {isAnalyzing && (
                  <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
                    <RefreshCw
                      className="spinner"
                      size={48}
                      style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }}
                    />
                    <h3 style={{ marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>
                      Analyzing Playlist / Video
                    </h3>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      Extracting stream metadata from URL...
                    </p>
                  </div>
                )}

                {playlistMetadata && (
                  <div>
                    <PlaylistDetails
                      key={playlistMetadata.url}
                      metadata={playlistMetadata}
                      onStartBatchDownload={handleStartBatchDownload}
                    />
                    <button
                      onClick={resetAll}
                      className="btn btn-secondary"
                      style={{ marginTop: '1.5rem' }}
                    >
                      Calculate Another
                    </button>
                  </div>
                )}

                {metadata && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div
                      className="glass-panel"
                      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
                    >
                      <div
                        style={{
                          borderBottom: '1px solid var(--card-border)',
                          paddingBottom: '1rem',
                        }}
                      >
                        <div
                          style={{
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            color: '#f59e0b',
                            padding: '0.75rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: '1rem',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <AlertCircle size={18} />
                          <span>This is a single video (not a playlist).</span>
                        </div>
                        <h2
                          style={{
                            fontSize: '1.4rem',
                            marginBottom: '0.5rem',
                            fontFamily: 'var(--font-heading)',
                          }}
                        >
                          {metadata.title}
                        </h2>
                        <div className="video-meta-row">
                          <span>Uploader: {metadata.uploader}</span>
                          <span>Duration: {formatDuration(metadata.duration)}</span>
                        </div>
                      </div>

                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--card-border)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1rem',
                        }}
                      >
                        <h3
                          style={{
                            fontSize: '1rem',
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-heading)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <Clock size={16} style={{ color: 'var(--accent-primary)' }} />
                          Video Watch Time at Playback Speeds
                        </h3>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '0.5rem',
                          }}
                        >
                          {[1.0, 1.25, 1.5, 1.75, 2.0].map((speed) => (
                            <div
                              key={speed}
                              style={{
                                background: 'rgba(0, 0, 0, 0.2)',
                                border: '1px solid var(--card-border)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '0.6rem 0.8rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '0.85rem',
                                  fontWeight: '600',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                {speed.toFixed(2)}x
                              </span>
                              <span
                                style={{ fontSize: '0.85rem', color: 'var(--accent-secondary)' }}
                              >
                                {formatLengthLong(metadata.duration / speed)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div>
                      <button onClick={resetAll} className="btn btn-secondary">
                        Calculate Another
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      <aside className="sidebar-right">
        <div style={{ flex: 1 }}></div>
        {historyReady && history.length > 0 && (
          <div style={{ width: '100%', marginBottom: '1rem' }}>
            <DownloadHistory
              history={history}
              onRemoveItem={handleRemoveHistoryItem}
              onClearAll={handleClearHistory}
              onSelectUrl={(url) => handleAnalyze(url, proxy)}
            />
          </div>
        )}
      </aside>
    </div>
  );
}
