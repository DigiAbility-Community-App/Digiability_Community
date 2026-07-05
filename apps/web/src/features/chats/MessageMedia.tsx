import React from 'react';
import type { ChatMessage } from '../../store/chatStore';
import { resolveMediaUrl } from '../../services/chatService';

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

// Renders IMAGE and AUDIO chat messages on the web client.
export const MessageMedia: React.FC<{ message: ChatMessage; isMine: boolean }> = ({ message }) => {
  const meta = parseMeta(message.metadata);

  if (message.type === 'IMAGE') {
    const altText: string = meta.altText || 'Shared image';
    return (
      <div className="message-image-wrap">
        <img className="message-image" src={resolveMediaUrl(message.content)} alt={altText} loading="lazy" />
        {meta.altText ? <div className="message-image-caption">{meta.altText}</div> : null}
      </div>
    );
  }

  if (message.type === 'AUDIO') {
    const duration = formatDuration(meta.durationMs);
    return (
      <div className="message-audio">
        <audio controls preload="metadata" src={resolveMediaUrl(message.content)} aria-label="Voice message" />
        {duration ? <span className="message-audio-duration">{duration}</span> : null}
      </div>
    );
  }

  return null;
};
