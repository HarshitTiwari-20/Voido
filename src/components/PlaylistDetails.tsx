'use client';

import React, { useState, useEffect } from 'react';
import { PlaylistMetadata } from '@/lib/downloader';
import { Download, List, CheckSquare, Square, Music, Video, User, Clock, Sliders, ChevronRight } from 'lucide-react';

interface PlaylistDetailsProps {
  metadata: PlaylistMetadata;
  onStartBatchDownload: (selectedUrls: { title: string; url: string }[], formatId: string) => void;
}

export default function PlaylistDetails({ metadata, onStartBatchDownload }: PlaylistDetailsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(metadata.entries.map((e) => e.id))
  );
  const [formatId, setFormatId] = useState<string>('720p');
  
  // Timeframe / Range Selector States (1-based index)
  const [startInput, setStartInput] = useState<string>('1');
  const [endInput, setEndInput] = useState<string>(metadata.entries.length.toString());

  // Keep inputs updated if metadata entries length changes
  useEffect(() => {
    setStartInput('1');
    setEndInput(metadata.entries.length.toString());
    setSelectedIds(new Set(metadata.entries.map((e) => e.id)));
  }, [metadata]);

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

  const applyRangeSelection = (startVal: string, endVal: string) => {
    const startNum = parseInt(startVal, 10);
    const endNum = parseInt(endVal, 10);
    
    if (isNaN(startNum) || isNaN(endNum)) return;
    
    const maxEntries = metadata.entries.length;
    const s = Math.max(1, Math.min(startNum, maxEntries));
    const e = Math.max(1, Math.min(endNum, maxEntries));
    
    const startIdx = Math.min(s, e) - 1;
    const endIdx = Math.max(s, e);
    
    const rangeEntries = metadata.entries.slice(startIdx, endIdx);
    setSelectedIds(new Set(rangeEntries.map(item => item.id)));
    
    setStartInput(Math.min(s, e).toString());
    setEndInput(Math.max(s, e).toString());
  };

  const handlePresetSelect = (type: 'first10' | 'last10' | 'none' | 'all') => {
    const max = metadata.entries.length;
    if (type === 'all') {
      applyRangeSelection('1', max.toString());
    } else if (type === 'none') {
      setSelectedIds(new Set());
      setStartInput('1');
      setEndInput('1');
    } else if (type === 'first10') {
      applyRangeSelection('1', Math.min(10, max).toString());
    } else if (type === 'last10') {
      applyRangeSelection(Math.max(1, max - 9).toString(), max.toString());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.size === 0) return;

    const selectedUrls = metadata.entries
      .filter((e) => selectedIds.has(e.id))
      .map((e) => ({ title: e.title, url: e.url }));

    onStartBatchDownload(selectedUrls, formatId);
  };

  // Duration Formatting Helpers
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

  const formatLengthLong = (seconds: number): string => {
    if (seconds <= 0) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.round(seconds % 60);

    const parts = [];
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0) parts.push(`${mins}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    return parts.join(' ');
  };

  // Calculate stats for checked items
  const selectedEntries = metadata.entries.filter((e) => selectedIds.has(e.id));
  const totalDurationSeconds = selectedEntries.reduce((acc, entry) => acc + (entry.duration || 0), 0);

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Info */}
      <div style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
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
            <span>{metadata.entries.length} Videos in Playlist</span>
          </div>
        </div>
      </div>

      {/* Playlist Length Counter Dashboard */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={16} style={{ color: 'var(--accent-primary)' }} />
            Playlist Watch Time Dashboard
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Selected: <strong>{selectedIds.size}</strong> / {metadata.entries.length} videos
          </span>
        </div>

        {/* Dashboard Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '1.25rem' }}>
          {/* Main Counter Card */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.05) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            gap: '0.25rem'
          }}>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
              Total Watch Time
            </span>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: 'var(--font-heading)' }}>
              {formatLengthLong(totalDurationSeconds)}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              at standard 1.0x playback speed
            </span>
          </div>

          {/* Speed Calculator Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-secondary)' }}>
              Playback Speed Comparison:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {[1.25, 1.5, 1.75, 2.0].map((speed) => (
                <div key={speed} style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.6rem 0.8rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>{speed.toFixed(2)}x</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--accent-secondary)' }}>
                    {formatLengthLong(totalDurationSeconds / speed)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Timeframe Selector Section */}
        <div style={{
          marginTop: '0.5rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Sliders size={14} style={{ color: 'var(--accent-primary)' }} />
              Filter by Range/Timeframe:
            </span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button type="button" onClick={() => handlePresetSelect('all')} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px' }}>All</button>
              <button type="button" onClick={() => handlePresetSelect('first10')} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px' }}>First 10</button>
              <button type="button" onClick={() => handlePresetSelect('last10')} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px' }}>Last 10</button>
              <button type="button" onClick={() => handlePresetSelect('none')} className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px' }}>Clear</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>From video #</span>
              <input
                type="number"
                min="1"
                max={metadata.entries.length}
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
                style={{
                  width: '60px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--card-border)',
                  color: 'var(--text-primary)',
                  borderRadius: '4px',
                  padding: '0.25rem 0.4rem',
                  fontSize: '0.85rem',
                  textAlign: 'center',
                  outline: 'none'
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>To video #</span>
              <input
                type="number"
                min="1"
                max={metadata.entries.length}
                value={endInput}
                onChange={(e) => setEndInput(e.target.value)}
                style={{
                  width: '60px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--card-border)',
                  color: 'var(--text-primary)',
                  borderRadius: '4px',
                  padding: '0.25rem 0.4rem',
                  fontSize: '0.85rem',
                  textAlign: 'center',
                  outline: 'none'
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => applyRangeSelection(startInput, endInput)}
              className="btn btn-secondary"
              style={{
                padding: '0.3rem 0.75rem',
                fontSize: '0.8rem',
                background: 'rgba(139, 92, 246, 0.15)',
                borderColor: 'rgba(139, 92, 246, 0.3)',
                color: 'var(--text-primary)'
              }}
            >
              Apply Filter
            </button>
          </div>
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
