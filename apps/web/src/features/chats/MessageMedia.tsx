import React, { useEffect, useCallback } from 'react';
import { Play, ArrowLeft, X } from 'lucide-react';
import type { ChatMessage } from '../../store/chatStore';
import { resolveMediaUrl } from '../../services/chatService';

/* ── Helpers ────────────────────────────────────────────── */

function parseMeta(metadata?: string): Record<string, any> {
  if (!metadata) return {};
  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
}

function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return '';
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Detect if a media message is actually a video based on metadata or URL. */
function isVideoContent(message: ChatMessage): boolean {
  const meta = parseMeta(message.metadata);
  const mime: string = meta.mimeType || '';
  if (mime.startsWith('video/')) return true;
  // Fallback: check file extension in the content URL
  const url = message.content.split('?')[0].toLowerCase();
  return /\.(mp4|webm|mov|avi|mkv|m4v|ogg|ogv)$/.test(url);
}

/* ── Full-Screen Media Viewer ───────────────────────────── */

interface MediaViewerProps {
  src: string;
  alt?: string;
  isVideo: boolean;
  onClose: () => void;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ src, alt, isVideo, onClose }) => {
  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    // Prevent background scrolling
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prev;
    };
  }, [handleKeyDown]);

  // Click on the dark backdrop (not the media itself) to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="media-viewer-overlay" onClick={handleBackdropClick} role="dialog" aria-label="Media viewer">
      {/* Top bar */}
      <div className="media-viewer-topbar">
        <button className="media-viewer-back" onClick={onClose} aria-label="Back to chat" title="Back to chat">
          <ArrowLeft size={22} />
          <span>Back</span>
        </button>
        <button className="media-viewer-close" onClick={onClose} aria-label="Close" title="Close">
          <X size={22} />
        </button>
      </div>

      {/* Content */}
      <div className="media-viewer-content">
        {isVideo ? (
          <video
            className="media-viewer-video"
            src={src}
            controls
            autoPlay
            playsInline
            controlsList="nodownload"
            aria-label={alt || 'Video'}
          />
        ) : (
          <img
            className="media-viewer-image"
            src={src}
            alt={alt || 'Full size image'}
            draggable={false}
          />
        )}
      </div>
    </div>
  );
};

/* ── Inline Media Bubble ────────────────────────────────── */

interface MessageMediaProps {
  message: ChatMessage;
  isMine: boolean;
  onOpenViewer?: (src: string, alt: string, isVideo: boolean) => void;
}

// Renders IMAGE, VIDEO, and AUDIO chat messages on the web client.
export const MessageMedia: React.FC<MessageMediaProps> = ({ message, isMine, onOpenViewer }) => {
  const meta = parseMeta(message.metadata);
  const mediaSrc = resolveMediaUrl(message.content);

  // ── IMAGE or VIDEO (both use type "IMAGE" from backend) ──
  if (message.type === 'IMAGE' || message.type === 'VIDEO') {
    const video = message.type === 'VIDEO' || isVideoContent(message);
    const altText: string = meta.altText || (video ? 'Shared video' : 'Shared image');

    const handleClick = () => {
      onOpenViewer?.(mediaSrc, altText, video);
    };

    if (video) {
      // Video: show first frame as poster / thumbnail with a play icon overlay
      return (
        <div className="message-image-wrap">
          <div className="message-video-thumb" onClick={handleClick} role="button" tabIndex={0}
            aria-label="Play video"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}>
            <video
              className="message-image"
              src={mediaSrc}
              preload="metadata"
              muted
              playsInline
              aria-hidden="true"
              // Show the first frame by seeking a tiny bit
              onLoadedData={(e) => {
                const vid = e.currentTarget;
                if (vid.duration && vid.currentTime === 0) vid.currentTime = 0.1;
              }}
            />
            <div className="message-video-play-overlay">
              <div className="message-video-play-btn">
                <Play size={28} fill="white" />
              </div>
            </div>
            {meta.durationMs && (
              <span className="message-video-duration">{formatDuration(meta.durationMs)}</span>
            )}
          </div>
          {meta.altText ? <div className="message-image-caption">{meta.altText}</div> : null}
        </div>
      );
    }

    // Regular image: clickable thumbnail
    return (
      <div className="message-image-wrap">
        <img
          className="message-image"
          src={mediaSrc}
          alt={altText}
          loading="lazy"
          onClick={handleClick}
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
          onError={(e) => {
            // Fallback for broken images — show a placeholder
            const img = e.currentTarget;
            img.style.minHeight = '80px';
            img.style.display = 'flex';
            img.alt = 'Image failed to load';
          }}
        />
        {meta.altText ? <div className="message-image-caption">{meta.altText}</div> : null}
      </div>
    );
  }

  // ── AUDIO ──
  if (message.type === 'AUDIO') {
    const duration = formatDuration(meta.durationMs);
    return (
      <div className="message-audio">
        <audio controls preload="metadata" src={mediaSrc} aria-label="Voice message" />
        {duration ? <span className="message-audio-duration">{duration}</span> : null}
      </div>
    );
  }

  return null;
};
