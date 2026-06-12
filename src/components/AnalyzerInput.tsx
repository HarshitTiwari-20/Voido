'use client';

import React, { useState } from 'react';
import { Link, Loader2, ArrowRight, Settings } from 'lucide-react';

interface AnalyzerInputProps {
  onAnalyze: (url: string, proxy: string) => void;
  isLoading: boolean;
  initialProxy: string;
}

export default function AnalyzerInput({ onAnalyze, isLoading, initialProxy }: AnalyzerInputProps) {
  const [url, setUrl] = useState('');
  const [proxy, setProxy] = useState(initialProxy);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onAnalyze(url.trim(), proxy.trim());
  };

  const platforms = [
    { name: 'YouTube', domains: ['youtube.com', 'youtu.be'] },
    { name: 'TikTok', domains: ['tiktok.com'] },
    { name: 'Twitter/X', domains: ['twitter.com', 'x.com'] },
    { name: 'Instagram', domains: ['instagram.com'] },
    { name: 'Facebook', domains: ['facebook.com'] },
  ];

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
    } catch (err) {
      // Clipboard access not granted or not supported
    }
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)' }}>Enter Video Link</h2>
        <div className="input-group">
          <span style={{ display: 'flex', alignItems: 'center', paddingLeft: '0.75rem', color: 'var(--text-muted)' }}>
            <Link size={18} />
          </span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste your video link here (YouTube, Twitter, TikTok, FB, etc.)..."
            className="input-field"
            required
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={handlePaste}
            className="btn btn-secondary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            disabled={isLoading}
          >
            Paste
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || !url.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="spinner" size={18} />
                Analyzing
              </>
            ) : (
              <>
                Analyze
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>

        {/* Advanced Options Toggle */}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="btn btn-secondary"
            style={{
              padding: '0.3rem 0.6rem',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)'
            }}
          >
            <Settings size={14} />
            {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options (Proxy)'}
          </button>
        </div>

        {/* Collapsible Proxy Input */}
        {showAdvanced && (
          <div
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid var(--card-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
              Proxy URL (Optional)
            </label>
            <input
              type="text"
              value={proxy}
              onChange={(e) => setProxy(e.target.value)}
              placeholder="e.g. http://127.0.0.1:7890 or socks5://127.0.0.1:1080"
              className="input-field"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.5rem 0.75rem'
              }}
              disabled={isLoading}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Use if the website is blocked by your ISP, country, or has scraping rate limits.
            </span>
          </div>
        )}
      </form>

      <div className="platform-badges" style={{ marginTop: '0.5rem' }}>
        {platforms.map((p) => {
          // Highlight badge if URL matches platform domains
          const isActive = p.domains.some(domain => url.toLowerCase().includes(domain));
          return (
            <span
              key={p.name}
              className={`platform-badge ${isActive ? 'active' : ''}`}
            >
              {p.name}
            </span>
          );
        })}
        <span className="platform-badge">& 1000+ more</span>
      </div>
    </div>
  );
}
