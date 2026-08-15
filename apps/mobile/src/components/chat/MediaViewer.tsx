// ─────────────────────────────────────────────────────────────
// MediaViewer — full-screen modal for viewing images & videos.
//
// WhatsApp-style experience:
//   • Images shown full-screen with dark background
//   • Videos auto-play with native controls
//   • Back button (top-left) to return to chat
//   • Android hardware back button handled
//   • Tap dark area outside media to dismiss
// ─────────────────────────────────────────────────────────────

import React, { useCallback, useRef } from "react";
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  StatusBar,
  Dimensions,
  SafeAreaView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Video, ResizeMode } from "expo-av";
import { ArrowLeft, X } from "lucide-react-native";
import { AccessibleText } from "../shared/AccessibleText";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface MediaViewerProps {
  visible: boolean;
  src: string;
  alt?: string;
  isVideo: boolean;
  onClose: () => void;
}

export function MediaViewer({ visible, src, alt, isVideo, onClose }: MediaViewerProps) {
  const videoRef = useRef<Video>(null);
  const insets = useSafeAreaInsets();

  const handleClose = useCallback(() => {
    // Pause video before closing to avoid audio leak
    videoRef.current?.pauseAsync().catch(() => {});
    onClose();
  }, [onClose]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={handleClose}
      supportedOrientations={["portrait", "landscape"]}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.container}>
        {/* Top bar */}
        <View style={[styles.topBarSafe, { paddingTop: Math.max(insets.top, 20) }]}>
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Back to chat"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={22} color="#fff" strokeWidth={2.2} />
              <AccessibleText style={styles.backText}>Back</AccessibleText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={22} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content area — tap backdrop to close */}
        <TouchableOpacity
          style={styles.content}
          activeOpacity={1}
          onPress={handleClose}
          accessibilityLabel="Tap to close viewer"
        >
          {isVideo ? (
            <Video
              ref={videoRef}
              source={{ uri: src }}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay
              isLooping={false}
              accessibilityLabel={alt || "Video"}
            />
          ) : (
            <Image
              source={{ uri: src }}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel={alt || "Full size image"}
            />
          )}
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  topBarSafe: {
    backgroundColor: "rgba(0,0,0,0.6)",
    zIndex: 10,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    paddingLeft: 12,
  },
  backText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: SCREEN_W,
    height: SCREEN_H * 0.8,
  },
  video: {
    width: SCREEN_W,
    height: SCREEN_H * 0.75,
  },
});
