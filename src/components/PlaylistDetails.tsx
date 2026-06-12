'use client';

import React, { useState } from 'react';
import { PlaylistMetadata } from '@/lib/downloader';
import { Download, List, CheckSquare, Square, Music, Video, User } from 'lucide-react';

interface PlaylistDetailsProps {
  metadata: PlaylistMetadata;
  onStartBatchDownload: (selectedUrls: { title: string; url: string }[], formatId: string) => void;
}

export default function PlaylistDetails({ metadata, onStartBatchDownload }: PlaylistDetailsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(metadata.entries.map((e) => e.id))
  );
  const [formatId, setFormatId] = useState<string>('720p');

  const handleToggleSelectAll = () => {
    if (selectedIds.size === metadata.entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(metadata.entries.map((e) => e.id)));
    }
  };

  const handleToggleItem = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.size === 0) return;

    const selectedUrls = metadata.entries
      .filter((e) => selectedIds.has(e.id))
      .map((e) => ({ title: e.title, url: e.url }));

    onStartBatchDownload(selectedUrls, formatId);
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '--:--';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <List size={22} style={{ color: 'var(--accent-primary)' }} />
          {metadata.title}
        </h2>
        <div className="video-meta-row">
          {metadata.uploader && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <User size={14} />
              {metadata.uploader}
            </span>
          )}
          <span>{metadata.entries.length} Videos found</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Controls Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.15)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {selectedIds.size === metadata.entries.length ? (
              <>
                <CheckSquare size={16} style={{ color: 'var(--accent-primary)' }} />
                Deselect All
              </>
            ) : (
              <>
                <Square size={16} />
                Select All
              </>
            )}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label htmlFor="playlist-format" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
              Download Format:
            </label>
            <select
              id="playlist-format"
              value={formatId}
              onChange={(e) => setFormatId(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.3)',
                color: 'var(--text-primary)',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.4rem 0.75rem',
                fontSize: '0.85rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <optgroup label="Video (MP4)">
                <option value="best">Best Quality (Auto)</option>
                <option value="1080p">1080p (Full HD)</option>
                <option value="720p">720p (HD)</option>
                <option value="480p">480p (SD)</option>
                <option value="360p">360p (SD)</option>
              </optgroup>
              <optgroup label="Audio Only">
                <option value="mp3">MP3 (High Quality)</option>
                <option value="m4a">M4A (Original Quality)</option>
              </optgroup>
            </select>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={selectedIds.size === 0}
              style={{ padding: '0.4rem 1.2rem', fontSize: '0.85rem' }}
            >
              <Download size={14} />
              Download Selected ({selectedIds.size})
            </button>
          </div>
        </div>

        {/* Playlist Videos Checklist */}
        <div
          className="formats-list"
          style={{
            maxHeight: '400px',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-md)',
            padding: '0.5rem',
            background: 'rgba(0,0,0,0.1)'
          }}
        >
          {metadata.entries.map((entry, index) => {
            const isChecked = selectedIds.has(entry.id);
            return (
              <div
                key={entry.id}
                onClick={() => handleToggleItem(entry.id)}
                className="format-item"
                style={{
                  cursor: 'pointer',
                  border: isChecked ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid var(--card-border)',
                  background: isChecked ? 'rgba(139, 92, 246, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                  marginBottom: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                  <div style={{ color: isChecked ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                    {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', width: '20px', textAlign: 'right' }}>
                    {index + 1}.
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        color: isChecked ? 'var(--text-primary)' : 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                      title={entry.title}
                    >
                      {entry.title}
                    </span>
                    {entry.uploader && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {entry.uploader}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {formatDuration(entry.duration)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </form>
    </div>
  );
}
