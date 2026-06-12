'use client';

import React from 'react';
import { DownloadJob } from '@/lib/downloader';
import { Loader2, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface ProgressTrackerProps {
  job: DownloadJob;
  onReset: () => void;
}

export default function ProgressTracker({ job, onReset }: ProgressTrackerProps) {
  const getStatusText = (status: DownloadJob['status']) => {
    switch (status) {
      case 'pending':
        return 'Starting download...';
      case 'downloading':
        return 'Downloading stream...';
      case 'merging':
        return 'Merging video and audio using FFmpeg...';
      case 'completed':
        return 'Download completed successfully!';
      case 'failed':
        return 'Download failed';
      default:
        return 'Processing...';
    }
  };

  const getStatusColor = (status: DownloadJob['status']) => {
    switch (status) {
      case 'completed':
        return 'var(--success)';
      case 'failed':
        return 'var(--error)';
      default:
        return 'var(--accent-primary)';
    }
  };

  return (
    <div className="glass-panel progress-container" style={{ gap: '1.5rem' }}>
      <div style={{ alignSelf: 'flex-start', textAlign: 'left', width: '100%' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem', fontFamily: 'var(--font-heading)' }}>
          Downloading Video
        </h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
          {job.title}
        </p>
      </div>

      <div className="progress-stage" style={{ color: getStatusColor(job.status) }}>
        {job.status === 'completed' && <CheckCircle size={22} />}
        {job.status === 'failed' && <AlertTriangle size={22} />}
        {(job.status === 'downloading' || job.status === 'pending') && (
          <Loader2 className="spinner" size={22} />
        )}
        {job.status === 'merging' && (
          <RefreshCw className="spinner" size={22} />
        )}
        <span>{getStatusText(job.status)}</span>
      </div>

      {job.status !== 'failed' && (
        <div style={{ width: '100%' }}>
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill"
              style={{ width: `${job.progress}%` }}
            />
          </div>
          <div className="progress-stats" style={{ marginTop: '0.5rem' }}>
            <span>{Math.round(job.progress)}% Completed</span>
            {job.status === 'downloading' && (
              <span>
                Speed: {job.speed} | ETA: {job.eta}
              </span>
            )}
          </div>
        </div>
      )}

      {job.status === 'failed' && (
        <div
          className="alert-banner error"
          style={{ width: '100%', margin: 0, textAlign: 'left' }}
        >
          <strong>Error:</strong> {job.error || 'An unknown error occurred during download.'}
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', width: '100%', justifyContent: 'flex-end' }}>
        {(job.status === 'completed' || job.status === 'failed') && (
          <button onClick={onReset} className="btn btn-secondary">
            Go Back
          </button>
        )}
      </div>
    </div>
  );
}
