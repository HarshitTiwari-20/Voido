'use client';

import React from 'react';
import { Trash2, Film, Music, CornerDownRight } from 'lucide-react';

export interface HistoryItem {
  id: string;
  title: string;
  thumbnail: string;
  formatId: string;
  url: string;
  timestamp: number;
}

interface DownloadHistoryProps {
  history: HistoryItem[];
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onSelectUrl: (url: string) => void;
}

export default function DownloadHistory({
  history,
  onRemoveItem,
  onClearAll,
  onSelectUrl
}: DownloadHistoryProps) {
  if (history.length === 0) {
    return null;
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isAudio = (formatId: string) => {
    return formatId === 'mp3' || formatId === 'm4a';
  };

  return (
    <div className="glass-panel history-section">
      <div className="history-title">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-heading)' }}>
          Download History
        </h3>
        <button
          onClick={onClearAll}
          className="btn btn-secondary"
          style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
        >
          Clear All
        </button>
      </div>

      <div className="history-list">
        {history.map((item) => (
          <div key={item.id} className="history-item">
            <div className="history-info">
              {item.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="history-thumb"
                />
              ) : (
                <div
                  style={{
                    width: '60px',
                    aspectRatio: '16/9',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)'
                  }}
                >
                  {isAudio(item.formatId) ? <Music size={16} /> : <Film size={16} />}
                </div>
              )}

              <div className="history-text">
                <div className="history-name" title={item.title}>
                  {item.title}
                </div>
                <div className="history-date">
                  {isAudio(item.formatId) ? 'Audio' : `Video (${item.formatId})`} • {formatDate(item.timestamp)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => onSelectUrl(item.url)}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', display: 'flex', gap: '0.25rem' }}
                title="Download Again"
              >
                <CornerDownRight size={14} />
                Load
              </button>
              <button
                onClick={() => onRemoveItem(item.id)}
                className="btn-icon"
                title="Remove from history"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
