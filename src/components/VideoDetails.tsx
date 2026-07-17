'use client';

import React, { useState } from 'react';
import type { VideoMetadata } from '@/lib/types';
import { Download, Music, Video, User, Clock, Headphones } from 'lucide-react';

interface VideoDetailsProps {
  metadata: VideoMetadata;
  onDownloadStart: (formatId: string) => void;
}

export default function VideoDetails({ metadata, onDownloadStart }: VideoDetailsProps) {
  const [activeTab, setActiveTab] = useState<'video' | 'audio'>('video');

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

  const videoFormats = metadata.formats.filter((f) => f.type === 'combined');
  const audioFormats = metadata.formats.filter((f) => f.type === 'audio');

  return (
    <div className="glass-panel video-card">
      <div className="video-thumbnail-container">
        {metadata.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={metadata.thumbnail}
            alt={metadata.title}
            className="video-thumbnail"
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            No Thumbnail Available
          </div>
        )}
        <span className="duration-tag">{formatDuration(metadata.duration)}</span>
      </div>

      <div className="video-details-info">
        <h3 className="video-title">{metadata.title}</h3>

        <div className="video-meta-row">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <User size={14} />
            {metadata.uploader}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <Clock size={14} />
            {formatDuration(metadata.duration)}
          </span>
        </div>

        {/* Quick audio-only action */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '1rem',
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(236, 72, 153, 0.08)',
            border: '1px solid rgba(236, 72, 153, 0.25)',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
            <Headphones size={18} style={{ color: 'var(--accent-secondary)', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Sound only</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Extract audio without video (MP3)
              </div>
            </div>
          </div>
          <button
            onClick={() => onDownloadStart('mp3')}
            className="btn btn-primary"
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.85rem',
              background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
              boxShadow: '0 4px 14px rgba(236, 72, 153, 0.4)',
              flexShrink: 0,
            }}
          >
            <Music size={14} />
            Download Audio
          </button>
        </div>

        {metadata.cookiesUsed === false && (
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--warning)',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.6rem 0.75rem',
              marginBottom: '1rem',
            }}
          >
            No browser cookies detected. YouTube may limit quality or block some downloads.
            Log into YouTube in Chrome/Brave, or place a <code>cookies.txt</code> file in the project root.
          </div>
        )}

        <div className="tabs-container">
          <div className="tabs-header">
            <button
              onClick={() => setActiveTab('video')}
              className={`tab-btn ${activeTab === 'video' ? 'active' : ''}`}
            >
              <Video size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Video Options
            </button>
            <button
              onClick={() => setActiveTab('audio')}
              className={`tab-btn ${activeTab === 'audio' ? 'active' : ''}`}
            >
              <Music size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Audio Only
            </button>
          </div>

          <div className="formats-list">
            {activeTab === 'video' ? (
              videoFormats.length > 0 ? (
                videoFormats.map((format) => (
                  <div key={format.formatId} className="format-item">
                    <div className="format-info">
                      <div className="format-label">
                        <Video size={16} style={{ color: 'var(--accent-primary)' }} />
                        {format.qualityLabel}
                      </div>
                      <div className="format-sublabel">
                        Format: MP4 (.mp4) • Video + Audio Merged
                      </div>
                    </div>
                    <button
                      onClick={() => onDownloadStart(format.formatId)}
                      className="btn btn-primary"
                      style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                    >
                      <Download size={14} />
                      Download
                    </button>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                  No video options found.
                </div>
              )
            ) : audioFormats.length > 0 ? (
              audioFormats.map((format) => (
                <div key={format.formatId} className="format-item">
                  <div className="format-info">
                    <div className="format-label">
                      <Music size={16} style={{ color: 'var(--accent-secondary)' }} />
                      {format.qualityLabel}
                    </div>
                    <div className="format-sublabel">
                      Format: {format.ext.toUpperCase()} • sound only (no video)
                    </div>
                  </div>
                  <button
                    onClick={() => onDownloadStart(format.formatId)}
                    className="btn btn-primary"
                    style={{
                      padding: '0.4rem 1rem',
                      fontSize: '0.85rem',
                      background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                      boxShadow: '0 4px 14px rgba(236, 72, 153, 0.4)',
                    }}
                  >
                    <Download size={14} />
                    Download Sound
                  </button>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                No audio options found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
