// ─────────────────────────────────────────────────────────────
// MediaViewer — full-screen viewer for images & videos, with Save to Gallery
// and Share. Used by chat (DM/group), forum questions/answers and events.
//
// Image zoom: react-native-zoom-toolkit's ResumableZoom (gesture-handler +
// Reanimated). Pinch zooms around the fingers, double-tap toggles fit/4×,
// panning is clamped to the image edges, and zoom state lives in Reanimated
// shared values on the UI thread — a re-render of this component (presence /
// typing / new-message traffic in the chat behind it) can't reset it.
//
// This replaced react-native-image-viewing (unmaintained since 2020), whose
// Android zoom kept its state in render-scoped variables and reset on every
// re-render, used absolute scale limits (huge photos jumped to ~20×, small
// images shrank), and never saved a gesture that was taken over. Five
// patches over it never held. Don't bring it back — CI's check-transport
// script fails if it reappears.
//
// Rules this file must keep:
//  - No hooks after a conditional return. The forum screen keeps this
//    component mounted and toggles `visible`; a hook added after an early
//    return crashed it ("Rendered more hooks than during the previous render").
//  - The Modal's content is wrapped in its own GestureHandlerRootView. On
//    Android, gesture-handler gestures don't fire inside an RN Modal without it.
//  - Save/share go through prepareLocalMediaFile() only (utils/mediaFile.ts).
// ─────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  StatusBar,
  ActivityIndicator,
  Alert,
  Linking,
  useWindowDimensions,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ResumableZoom, useImageResolution, fitContainer } from "react-native-zoom-toolkit";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Video, ResizeMode } from "expo-av";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { ArrowLeft, X, Download, Share2, Check, ImageOff } from "lucide-react-native";
import { prepareLocalMediaFile, mimeTypeForUri, logMedia } from "../../utils/mediaFile";
import { AccessibleText } from "../shared/AccessibleText";

/** Max zoom relative to the image fitted to the screen (fit = 1×). */
const MAX_ZOOM = 4;
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

interface MediaViewerProps {
  visible: boolean;
  src: string;
  alt?: string;
  isVideo: boolean;
  onClose: () => void;
  title?: string;
}

function MediaViewerImpl({ visible, src, alt, isVideo, onClose, title = "Shared image" }: MediaViewerProps) {
  const insets = useSafeAreaInsets();
  const videoRef = useRef<Video>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Auto-start video when opened (shouldPlay=true fights the native controls).
  useEffect(() => {
    if (!visible || !isVideo) return;
    const timer = setTimeout(() => {
      videoRef.current?.playAsync().catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [visible, isVideo]);

  // Reset per-open UI state so a previous image's tick doesn't carry over.
  useEffect(() => {
    if (!visible) {
      setDownloading(false);
      setDownloadSuccess(false);
      setSharing(false);
    }
  }, [visible]);

  // At end of video just pause in place — seeking there caused resume-from-start bugs.
  const handlePlaybackStatusUpdate = useCallback((status: any) => {
    if (status?.didJustFinish && !status?.isLooping) {
      videoRef.current?.pauseAsync().catch(() => {});
    }
  }, []);

  const handleClose = useCallback(() => {
    videoRef.current?.stopAsync().catch(() => {});
    onClose();
  }, [onClose]);

  // ── Save to Gallery / Photos ──
  const handleDownload = useCallback(async () => {
    if (!src || downloading) return;
    setDownloading(true);
    setDownloadSuccess(false);
    try {
      const localUri = await prepareLocalMediaFile(src, { isVideo });

      // Write-only: no runtime prompt on Android 13+; WRITE_EXTERNAL_STORAGE
      // on Android ≤12; "Add Photos Only" on iOS.
      const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync(true, ["photo", "video"]);
      if (status !== "granted") {
        logMedia("save permission denied", src, { status, canAskAgain });
        Alert.alert(
          "Permission Required",
          canAskAgain === false
            ? "Photo access is turned off for Digiability. Enable it in Settings to save to your Gallery."
            : "Please allow photo access so Digiability can save to your Gallery.",
          canAskAgain === false
            ? [
                { text: "Cancel", style: "cancel" },
                { text: "Open Settings", onPress: () => Linking.openSettings() },
              ]
            : [{ text: "OK" }]
        );
        return;
      }

      await MediaLibrary.saveToLibraryAsync(localUri);
      setDownloadSuccess(true);
      Alert.alert("Saved to Gallery ✓", isVideo ? "The video has been saved to your Gallery." : "The image has been saved to your Gallery.");
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (error: any) {
      logMedia("save failed", src, error);
      Alert.alert("Save Failed", error?.message || "Could not save to your Gallery. Please try again.");
    } finally {
      setDownloading(false);
    }
  }, [src, isVideo, downloading]);

  // ── Share sheet (WhatsApp, Gmail, Drive, …) ──
  const handleShare = useCallback(async () => {
    if (!src || sharing) return;
    setSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Share", "Sharing isn't available on this device.");
        return;
      }
      const localUri = await prepareLocalMediaFile(src, { isVideo });
      await Sharing.shareAsync(localUri, {
        mimeType: mimeTypeForUri(localUri, isVideo),
        dialogTitle: isVideo ? "Share Video" : "Share Image",
      });
    } catch (error: any) {
      logMedia("share failed", src, error);
      Alert.alert("Share Failed", error?.message || "Could not open the share menu.");
    } finally {
      setSharing(false);
    }
  }, [src, isVideo, sharing]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleClose}
      supportedOrientations={["portrait", "landscape"]}
    >
      <GestureHandlerRootView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.content}>
          {isVideo ? (
            <Video
              ref={videoRef}
              source={{ uri: src }}
              style={styles.fill}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay={false}
              isLooping={false}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
              accessibilityLabel={alt || "Video"}
            />
          ) : visible ? (
            <ZoomableImage src={src} alt={alt || title} />
          ) : null}
        </View>

        {/* Header overlays the media so zooming never moves it. */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]} pointerEvents="box-none">
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.backBtn} onPress={handleClose} accessibilityRole="button" accessibilityLabel="Back" hitSlop={HIT_SLOP}>
              <ArrowLeft size={22} color="#fff" strokeWidth={2.2} />
              <AccessibleText numberOfLines={1} style={styles.headerTitle}>{alt || title}</AccessibleText>
            </TouchableOpacity>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.iconBtn, downloadSuccess && styles.iconBtnSuccess]}
                onPress={handleDownload}
                disabled={downloading}
                accessibilityRole="button"
                accessibilityLabel={isVideo ? "Save video to Gallery" : "Save image to Gallery"}
                accessibilityState={{ busy: downloading, disabled: downloading }}
                hitSlop={HIT_SLOP}
              >
                {downloading ? <ActivityIndicator size="small" color="#fff" /> : downloadSuccess ? <Check size={20} color="#4ADE80" strokeWidth={2.5} /> : <Download size={20} color="#fff" strokeWidth={2} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={handleShare}
                disabled={sharing}
                accessibilityRole="button"
                accessibilityLabel={isVideo ? "Share video" : "Share image"}
                accessibilityState={{ busy: sharing, disabled: sharing }}
                hitSlop={HIT_SLOP}
              >
                {sharing ? <ActivityIndicator size="small" color="#fff" /> : <Share2 size={20} color="#fff" strokeWidth={2} />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={HIT_SLOP}>
                <X size={20} color="#fff" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/**
 * The pinch/pan/double-tap surface. A separate component so its hooks only
 * run for images (useImageResolution would try to measure a video URL).
 */
function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const { width, height } = useWindowDimensions();
  const { isFetching, resolution, error } = useImageResolution({ uri: src });

  if (isFetching) {
    return <ActivityIndicator size="large" color="#fff" accessibilityLabel="Loading image" />;
  }
  if (error || !resolution || resolution.width === 0 || resolution.height === 0) {
    return (
      <View style={styles.unavailable} accessible accessibilityLabel={`${alt}. Image unavailable`}>
        <ImageOff size={36} color="#9CA3AF" />
        <AccessibleText style={styles.unavailableText}>Image unavailable</AccessibleText>
      </View>
    );
  }

  // Fit the whole image on screen; ResumableZoom scales from this size.
  const size = fitContainer(resolution.width / resolution.height, { width, height });
  return (
    <ResumableZoom maxScale={MAX_ZOOM} panMode="clamp" pinchMode="clamp">
      <Image
        source={{ uri: src }}
        style={size}
        resizeMode="cover"
        accessible
        accessibilityLabel={alt}
        accessibilityHint="Pinch or double-tap to zoom"
      />
    </ResumableZoom>
  );
}

/**
 * Memoised: chat screens re-render on every presence/typing/message event.
 * Zoom state survives re-renders regardless (it lives in Reanimated shared
 * values); this just avoids pointless work while the viewer is open.
 */
export const MediaViewer = React.memo(MediaViewerImpl);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  fill: {
    width: "100%",
    height: "100%",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    paddingRight: 10,
    minHeight: 44,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconBtnSuccess: {
    backgroundColor: "rgba(74, 222, 128, 0.2)",
    borderColor: "#4ADE80",
    borderWidth: 1,
  },
  unavailable: {
    alignItems: "center",
    gap: 10,
  },
  unavailableText: {
    color: "#D1D5DB",
    fontSize: 15,
    fontWeight: "600",
  },
});
