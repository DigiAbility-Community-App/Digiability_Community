// ─────────────────────────────────────────────────────────────
// MessageMedia — renders IMAGE and AUDIO chat messages.
//  • IMAGE: thumbnail with the sender's alt text as the a11y label
//           (and a visible caption for everyone).
//  • AUDIO: a play/pause voice-note bubble backed by expo-av.
// TEXT messages are rendered by the parent screen as before.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Audio } from "expo-av";
import { ChatMessage } from "@store/chatStore";
import { resolveMediaUrl } from "@services/chatService";

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

export function MessageMedia({ message, isMine }: { message: ChatMessage; isMine: boolean }) {
  const meta = parseMeta(message.metadata);

  if (message.type === "IMAGE") {
    const altText: string = meta.altText || "Shared image";
    return (
      <View>
        <Image
          source={{ uri: resolveMediaUrl(message.content) }}
          style={styles.image}
          resizeMode="cover"
          accessible
          accessibilityLabel={altText}
        />
        {meta.altText ? (
          <Text style={[styles.caption, isMine ? styles.captionMine : undefined]} numberOfLines={3}>
            {meta.altText}
          </Text>
        ) : null}
      </View>
    );
  }

  if (message.type === "AUDIO") {
    return <AudioBubble uri={resolveMediaUrl(message.content)} durationMs={meta.durationMs} isMine={isMine} />;
  }

  return null;
}

function AudioBubble({ uri, durationMs, isMine }: { uri: string; durationMs?: number; isMine: boolean }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return () => {
      // Unload sound when the bubble unmounts.
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
    width: 220,
    height: 220,
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
