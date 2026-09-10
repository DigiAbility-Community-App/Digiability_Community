// ─────────────────────────────────────────────────────────────
// MessageMedia — renders IMAGE, VIDEO, and AUDIO chat messages.
//
//  • IMAGE: fixed-size thumbnail (fills 65% of screen width, fixed height
//           ratio), tappable to open full-screen viewer with zoom & download
//  • VIDEO: thumbnail with play icon overlay, tappable to open viewer
//  • AUDIO: play/pause voice-note bubble backed by expo-av
//
// TEXT messages are rendered by the parent screen as before.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Audio } from "expo-av";
import { Play, Pause } from "lucide-react-native";
import { ChatMessage } from "@store/chatStore";
import { resolveMediaUrl } from "@services/chatService";

const SCREEN_WIDTH = Dimensions.get("window").width;
// Fixed width for all image/video thumbnails — 65% screen width on any device
const MEDIA_WIDTH = Math.round(SCREEN_WIDTH * 0.65);
// Fixed 4:3 aspect ratio height
const MEDIA_HEIGHT = Math.round(MEDIA_WIDTH * 0.75);

function parseMeta(metadata?: string): Record<string, any> {
  if (!metadata) return {};
  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
}

/**
 * True when a media message carries caption text rendered below the image.
 * Chat screens use this to keep the timestamp out of the caption's way.
 */
export function hasCaption(message: ChatMessage): boolean {
  return Boolean(parseMeta(message.metadata).altText);
}

function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return "0:00";
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Detect if a media message is actually a video based on metadata or URL. */
function isVideoContent(message: ChatMessage): boolean {
  const meta = parseMeta(message.metadata);
  const mime: string = meta.mimeType || "";
  if (mime.startsWith("video/")) return true;
  // Fallback: check file extension in the content URL
  const url = message.content.split("?")[0].toLowerCase();
  return /\.(mp4|webm|mov|avi|mkv|m4v|ogg|ogv)$/.test(url);
}

interface MessageMediaProps {
  message: ChatMessage;
  isMine: boolean;
  onOpenViewer?: (src: string, alt: string, isVideo: boolean) => void;
  onLongPress?: () => void;
}

export function MessageMedia({ message, isMine, onOpenViewer, onLongPress }: MessageMediaProps) {
  const meta = parseMeta(message.metadata);
  const mediaSrc = resolveMediaUrl(message.content);

  // A media message with no source can't render anything useful. The fixed
  // MEDIA_WIDTH x MEDIA_HEIGHT styles below have hardcoded #111/#DDD
  // backgrounds, so an empty URI painted a grey rectangle instead — which is
  // exactly what a deleted image looked like once its content was blanked.
  // Deleted messages are filtered out upstream now; this is the backstop so a
  // blank source can never render as a phantom image again.
  if (!mediaSrc) return null;

  // ── IMAGE or VIDEO ──
  if (message.type === "IMAGE" || message.type === "VIDEO") {
    const video = message.type === "VIDEO" || isVideoContent(message);
    const altText: string = meta.altText || (video ? "Shared video" : "Shared image");

    const handlePress = () => {
      onOpenViewer?.(mediaSrc, altText, video);
    };

    if (video) {
      return (
        <View>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handlePress}
            onLongPress={onLongPress}
            accessibilityRole="button"
            accessibilityLabel="Play video"
            accessibilityHint="Opens video in full-screen player"
            style={styles.mediaTouchable}
          >
            <Image
              source={{ uri: mediaSrc }}
              style={styles.mediaImage}
              resizeMode="cover"
              accessible={false}
            />
            {/* Dark overlay + play button */}
            <View style={styles.videoOverlay}>
              <View style={styles.playBtn}>
                <Play size={28} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
              </View>
            </View>
            {/* Duration badge */}
            {meta.durationMs ? (
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{formatDuration(meta.durationMs)}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          {meta.altText ? (
            <Text style={[styles.caption, isMine ? styles.captionMine : undefined]} numberOfLines={3}>
              {meta.altText}
            </Text>
          ) : null}
        </View>
      );
    }

    // Regular image: fixed-size, edge-to-edge in bubble
    return (
      <View>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handlePress}
          onLongPress={onLongPress}
          accessibilityRole="button"
          accessibilityLabel={altText}
          accessibilityHint="Tap to view full-screen"
          style={styles.mediaTouchable}
        >
          <Image
            source={{ uri: mediaSrc }}
            style={styles.mediaImage}
            resizeMode="cover"
            accessible
            accessibilityLabel={altText}
          />
        </TouchableOpacity>
        {meta.altText ? (
          <Text style={[styles.caption, isMine ? styles.captionMine : undefined]}>
            {meta.altText}
          </Text>
        ) : null}
      </View>
    );
  }

  // ── AUDIO ──
  if (message.type === "AUDIO") {
    return <AudioBubble uri={mediaSrc} durationMs={meta.durationMs} isMine={isMine} onLongPress={onLongPress} />;
  }

  return null;
}

function AudioBubble({
  uri,
  durationMs,
  isMine,
  onLongPress,
}: {
  uri: string;
  durationMs?: number;
  isMine: boolean;
  onLongPress?: () => void;
}) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, []);

  const didFinishRef = useRef(false); // track if audio reached end

  const toggle = async () => {
    try {
      // ── PAUSE ──
      if (isPlaying) {
        await soundRef.current?.pauseAsync();
        setIsPlaying(false);
        return;
      }

      // ── RESUME (audio loaded, not at end yet) ──
      if (soundRef.current && !didFinishRef.current) {
        await soundRef.current.playAsync(); // resume from exact pause position
        setIsPlaying(true);
        return;
      }

      // ── REPLAY or FIRST PLAY (audio not loaded OR reached end) ──
      if (soundRef.current) {
        // Already loaded but finished → rewind then play
        await soundRef.current.setPositionAsync(0);
        await soundRef.current.playAsync();
        didFinishRef.current = false;
        setProgress(0);
        setIsPlaying(true);
        return;
      }

      // First time: load and play
      setIsLoading(true);
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      soundRef.current = sound;
      didFinishRef.current = false;
      setIsPlaying(true);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.durationMillis) {
            setProgress(status.positionMillis / status.durationMillis);
          }
          if (status.didJustFinish) {
            // Audio ended — mark as finished, reset UI, but keep position at 0 for replay
            didFinishRef.current = true;
            setIsPlaying(false);
            setProgress(0);
          }
        }
      });
    } catch (err) {
      console.error("audio playback failed", err);
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  const tint = isMine ? "#fff" : "#7c3aed";
  const trackBg = isMine ? "rgba(255,255,255,0.3)" : "rgba(112,4,220,0.15)";

  return (
    <TouchableOpacity
      style={styles.audioRow}
      onPress={toggle}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? "Pause voice message" : "Play voice message"}
    >
      {/* Play/Pause button */}
      <View style={[styles.audioPlayBtn, { backgroundColor: tint + "30" }]}>
        {isLoading ? (
          <ActivityIndicator size="small" color={tint} />
        ) : isPlaying ? (
          <Pause size={18} color={tint} fill={tint} />
        ) : (
          <Play size={18} color={tint} fill={tint} style={{ marginLeft: 1 }} />
        )}
      </View>

      {/* Waveform bars + progress track */}
      <View style={styles.audioTrackArea}>
        <View style={[styles.audioTrack, { backgroundColor: trackBg }]}>
          <View
            style={[
              styles.audioProgress,
              { backgroundColor: tint, width: `${Math.round(progress * 100)}%` },
            ]}
          />
        </View>
        {/* Waveform bars for decoration */}
        <View style={styles.audioWave}>
          {[8, 14, 10, 20, 12, 18, 8, 16, 10, 14, 8].map((h, i) => (
            <View
              key={i}
              style={[
                styles.audioBar,
                {
                  height: h,
                  backgroundColor: tint,
                  opacity: progress > i / 11 ? 1 : 0.4,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <Text style={[styles.audioDuration, { color: tint }]}>
        {formatDuration(durationMs)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // ── Image / Video thumbnail — no border-radius; parent bubble clips ──
  mediaTouchable: {
    width: MEDIA_WIDTH,
    height: MEDIA_HEIGHT,
    backgroundColor: "#111",
  },
  mediaImage: {
    width: MEDIA_WIDTH,
    height: MEDIA_HEIGHT,
    backgroundColor: "#DDD",
  },

  caption: {
    marginTop: 6,
    // The bubble zeroes its padding for media, so the caption has to supply
    // its own — without this the text ran edge-to-edge. The bottom padding
    // also keeps the last line clear of the timestamp pill.
    paddingHorizontal: 10,
    paddingBottom: 4,
    maxWidth: MEDIA_WIDTH,
    fontSize: 13,
    lineHeight: 18,
    color: "#333",
  },
  captionMine: {
    color: "#f3e8ff",
  },

  // ── Video thumbnail overlay ──
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  durationBadge: {
    position: "absolute",
    bottom: 8,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },

  // ── Audio ──
  audioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: SCREEN_WIDTH * 0.5,
    maxWidth: SCREEN_WIDTH * 0.65,
    paddingVertical: 4,
  },
  audioPlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  audioTrackArea: {
    flex: 1,
    gap: 4,
  },
  audioTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  audioProgress: {
    height: 4,
    borderRadius: 2,
  },
  audioWave: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 24,
  },
  audioBar: {
    width: 3,
    borderRadius: 2,
  },
  audioDuration: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    minWidth: 36,
    textAlign: "right",
  },
});
