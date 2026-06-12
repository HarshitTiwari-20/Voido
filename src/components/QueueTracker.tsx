'use client';

import React from 'react';
import { Loader2, CheckCircle, AlertTriangle, Play, Square, XOctagon } from 'lucide-react';

export interface QueueItem {
  id: string; // url or unique index
  title: string;
  url: string;
  formatId: string;
  status: 'pending' | 'downloading' | 'merging' | 'completed' | 'failed';
  progress: number;
  speed: string;
  eta: string;
  error?: string;
}

interface QueueTrackerProps {
  queue: QueueItem[];
  currentIndex: number;
  onCancelQueue: () => void;
}

export default function QueueTracker({ queue, currentIndex, onCancelQueue }: QueueTrackerProps) {
  const completedCount = queue.filter(item => item.status === 'completed').length;
  const failedCount = queue.filter(item => item.status === 'failed').length;
  const totalCount = queue.length;
  
  // Calculate overall percentage based on completed items + fractional progress of active item
  const activeItem = queue[currentIndex];
  const activeProgressContribution = activeItem && activeItem.status === 'downloading' 
    ? (activeItem.progress / 100) 
    : (activeItem && activeItem.status === 'merging' ? 0.99 : 0);
  
  const overallProgress = totalCount > 0 
    ? ((completedCount + activeProgressContribution) / totalCount) * 100 
    : 0;

  const getStatusIcon = (status: QueueItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} style={{ color: 'var(--success)' }} />;
      case 'failed':
        return <AlertTriangle size={16} style={{ color: 'var(--error)' }} />;
      case 'downloading':
        return <Loader2 className="spinner" size={16} style={{ color: 'var(--accent-primary)' }} />;
      case 'merging':
        return <RefreshIcon />;
      default:
        return <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--text-muted)', opacity: 0.5 }} />;
    }
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', marginBottom: '0.25rem' }}>
            Batch Download Progress
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Processing: {completedCount} completed, {failedCount} failed, {totalCount - completedCount - failedCount} remaining
          </p>
        </div>
        <button
          onClick={onCancelQueue}
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: 'var(--error)', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}
        >
          <XOctagon size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
          Stop Queue
        </button>
      </div>

      {/* Global Progress Bar */}
      <div style={{ width: '100%' }}>
        <div className="progress-bar-bg" style={{ height: '12px' }}>
          <div
            className="progress-bar-fill"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          <span>Overall: {Math.round(overallProgress)}% Done</span>
          <span>{completedCount} / {totalCount} Videos</span>
        </div>
      </div>

      {/* Active Video Info */}
      {activeItem && (
        <div
          style={{
            padding: '1rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            borderRadius: 'var(--radius-md)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-primary)', fontWeight: '600' }}>
              Currently Downloading ({currentIndex + 1}/{totalCount})
            </span>
            {activeItem.status === 'downloading' && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Speed: {activeItem.speed} | ETA: {activeItem.eta}
              </span>
            )}
          </div>
          <h4 style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={activeItem.title}>
            {activeItem.title}
          </h4>

          {activeItem.status !== 'failed' && activeItem.status !== 'completed' && (
            <div>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${activeItem.progress}%`, background: 'var(--accent-gradient)' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                <span>{activeItem.status === 'merging' ? 'Merging streams...' : `${Math.round(activeItem.progress)}% completed`}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Queue List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Queue List
        </h4>
        <div
          className="formats-list"
          style={{
            maxHeight: '220px',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-md)',
            padding: '0.5rem',
            background: 'rgba(0,0,0,0.1)'
          }}
        >
          {queue.map((item, idx) => {
            const isActive = idx === currentIndex;
            return (
              <div
                key={item.id}
                className="format-item"
                style={{
                  padding: '0.5rem 0.75rem',
                  border: isActive ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid var(--card-border)',
                  background: isActive ? 'rgba(139, 92, 246, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                  marginBottom: '0.25rem',
                  opacity: item.status === 'completed' ? 0.7 : 1
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', width: '80%' }}>
                  {getStatusIcon(item.status)}
                  <span style={{ fontSize: '0.85rem', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.title}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {item.status === 'completed' && 'Done'}
                  {item.status === 'failed' && 'Failed'}
                  {item.status === 'downloading' && `${Math.round(item.progress)}%`}
                  {item.status === 'merging' && 'Merging...'}
                  {item.status === 'pending' && 'Queued'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Simple rotating loading icon for merger
function RefreshIcon() {
  return (
    <svg className="spinner" style={{ color: 'var(--warning)', width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
    </svg>
  );
}
