// ─────────────────────────────────────────────────────────────
// MessageMedia — renders IMAGE, VIDEO, and AUDIO chat messages.
//
//  • IMAGE: larger thumbnail (300px), tappable to open full-screen viewer
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
import { Play } from "lucide-react-native";
import { ChatMessage } from "@store/chatStore";
import { resolveMediaUrl } from "@services/chatService";

const SCREEN_WIDTH = Dimensions.get("window").width;
// Image thumbnail should be large but bounded — roughly 70% of screen width
const IMAGE_SIZE = Math.min(300, SCREEN_WIDTH * 0.7);

function parseMeta(metadata?: string): Record<string, any> {
  if (!metadata) return {};
  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
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
}

export function MessageMedia({ message, isMine, onOpenViewer }: MessageMediaProps) {
  const meta = parseMeta(message.metadata);
  const mediaSrc = resolveMediaUrl(message.content);

  // ── IMAGE or VIDEO ──
  if (message.type === "IMAGE" || message.type === "VIDEO") {
    const video = message.type === "VIDEO" || isVideoContent(message);
    const altText: string = meta.altText || (video ? "Shared video" : "Shared image");

    const handlePress = () => {
      onOpenViewer?.(mediaSrc, altText, video);
    };

    if (video) {
      // Video: show static thumbnail with play icon overlay
      return (
        <View>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityLabel="Play video"
            accessibilityHint="Opens video in full-screen player"
            style={styles.videoThumbWrap}
          >
            {/* Use Image for the poster — server may return a thumbnail, or we show a dark placeholder */}
            <Image
              source={{ uri: mediaSrc }}
              style={styles.image}
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

    // Regular image: tappable thumbnail
    return (
      <View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={altText}
          accessibilityHint="Tap to view full-screen"
        >
          <Image
            source={{ uri: mediaSrc }}
            style={styles.image}
            resizeMode="cover"
            accessible
            accessibilityLabel={altText}
          />
        </TouchableOpacity>
        {meta.altText ? (
          <Text style={[styles.caption, isMine ? styles.captionMine : undefined]} numberOfLines={3}>
            {meta.altText}
          </Text>
        ) : null}
      </View>
    );
  }

  // ── AUDIO ──
  if (message.type === "AUDIO") {
    return <AudioBubble uri={mediaSrc} durationMs={meta.durationMs} isMine={isMine} />;
  }

  return null;
}

function AudioBubble({ uri, durationMs, isMine }: { uri: string; durationMs?: number; isMine: boolean }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, []);

  const toggle = async () => {
    try {
      if (isPlaying) {
        await soundRef.current?.pauseAsync();
        setIsPlaying(false);
        return;
      }
      if (soundRef.current) {
        await soundRef.current.replayAsync();
        setIsPlaying(true);
        return;
      }
      setIsLoading(true);
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      soundRef.current = sound;
      setIsPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
          sound.setPositionAsync(0).catch(() => {});
        }
      });
    } catch (err) {
      console.error("audio playback failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  const tint = isMine ? "#fff" : "#7c3aed";
  return (
    <TouchableOpacity
      style={styles.audioRow}
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? "Pause voice message" : "Play voice message"}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <Text style={[styles.audioIcon, { color: tint }]}>{isPlaying ? "⏸" : "▶"}</Text>
      )}
      <View style={styles.audioWave}>
        <View style={[styles.audioBar, { backgroundColor: tint, height: 8 }]} />
        <View style={[styles.audioBar, { backgroundColor: tint, height: 16 }]} />
        <View style={[styles.audioBar, { backgroundColor: tint, height: 12 }]} />
        <View style={[styles.audioBar, { backgroundColor: tint, height: 20 }]} />
        <View style={[styles.audioBar, { backgroundColor: tint, height: 10 }]} />
      </View>
      <Text style={[styles.audioDuration, { color: tint }]}>{formatDuration(durationMs)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 12,
    backgroundColor: "#eee",
  },
  caption: {
    marginTop: 6,
    fontSize: 13,
    color: "#333",
  },
  captionMine: {
    color: "#f3e8ff",
  },

  // ── Video thumbnail overlay ──
  videoThumbWrap: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
  },
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
    minWidth: 160,
    paddingVertical: 2,
  },
  audioIcon: {
    fontSize: 20,
    width: 24,
    textAlign: "center",
  },
  audioWave: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flex: 1,
  },
  audioBar: {
    width: 3,
    borderRadius: 2,
    opacity: 0.8,
  },
  audioDuration: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
});
