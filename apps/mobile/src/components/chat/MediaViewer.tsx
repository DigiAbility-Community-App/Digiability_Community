// ─────────────────────────────────────────────────────────────
// MediaViewer — full-screen modal for viewing images & videos.
//
// Image zoom: Uses react-native-image-viewing which provides
//   • Proper 2-finger pinch-to-zoom (in and out, clamped at 1x min)
//   • Pan/drag while zoomed - stays within image bounds
//   • Double-tap to zoom
//   • Image always centered in its original frame
//
// Download: Saves directly to device Gallery/Photos via expo-media-library.
//   Green tick ONLY shows when save genuinely succeeds.
// Share: Opens system share sheet.
// ─────────────────────────────────────────────────────────────

import React, { useCallback, useRef, useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Modal,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Video, ResizeMode } from "expo-av";
import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import ImageViewing from "react-native-image-viewing";
import {
  ArrowLeft,
  X,
  Download,
  Share2,
  Check,
} from "lucide-react-native";
import { AccessibleText } from "../shared/AccessibleText";
import { CHAT_BASE_URL } from "../../services/chatService";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Defense-in-depth: only ever download from this app's own chat-svc origin.
// The server already rejects non-upload media content at send time
// (messageSendSchema), but a modified/older client could still slip an
// external URL through, and this is the last line of defense before
// anything gets written to the user's device storage.
function originOf(url: string): string {
  const match = url.match(/^https?:\/\/[^/]+/i);
  return match ? match[0].toLowerCase() : "";
}
function isAllowedMediaOrigin(url: string): boolean {
  const urlOrigin = originOf(url);
  return !!urlOrigin && urlOrigin === originOf(CHAT_BASE_URL);
}

// A generous cap so a malicious/misbehaving URL can't fill up device
// storage or flood the photo library with an oversized file.
const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

interface MediaViewerProps {
  visible: boolean;
  src: string;
  alt?: string;
  isVideo: boolean;
  onClose: () => void;
  title?: string;
}

export function MediaViewer({
  visible,
  src,
  alt,
  isVideo,
  onClose,
  title = "Shared image",
}: MediaViewerProps) {
  const videoRef = useRef<Video>(null);
  const insets = useSafeAreaInsets();

  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  // Track whether user has reached end-of-video so next play restarts from beginning
  const videoEndedRef = useRef(false);

  // Auto-start video when modal becomes visible (without using shouldPlay=true which fights native controls)
  useEffect(() => {
    if (visible && isVideo) {
      videoEndedRef.current = false;
      const timer = setTimeout(() => {
        videoRef.current?.playAsync().catch(() => {});
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible, isVideo]);

  // Handle end-of-video: pause in place (do NOT seek — that causes resume-from-start bug)
  // When user taps play after video ends, we seek to 0 THEN play (see handleVideoPress)
  const handlePlaybackStatusUpdate = useCallback((status: any) => {
    if (status?.didJustFinish && !status?.isLooping) {
      videoEndedRef.current = true;
      // Just pause — keep position at end so native controls show correctly
      videoRef.current?.pauseAsync().catch(() => {});
    }
  }, []);

  const handleClose = useCallback(() => {
    videoRef.current?.stopAsync().catch(() => {});
    onClose();
  }, [onClose]);

  // ── Helper to save media to local cache file ──
  const prepareLocalFile = async (): Promise<string> => {
    let fileUri = src;

    // Remote HTTP/HTTPS URL — download to cache first
    if (src.startsWith("http://") || src.startsWith("https://")) {
      if (!isAllowedMediaOrigin(src)) {
        throw new Error("This media's source isn't recognized, so it can't be downloaded.");
      }
      const ext = isVideo
        ? "mp4"
        : src.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
      const validExts = ["jpg", "jpeg", "png", "gif", "webp", "mp4", "mov", "webm"];
      const safeExt = validExts.includes(ext) ? ext : (isVideo ? "mp4" : "jpg");
      const filename = `digiability-${Date.now()}.${safeExt}`;
      const destFile = new File(Paths.cache, filename);
      // downloadAsync was removed from the main expo-file-system export in
      // SDK 54 (throws at runtime) — File.downloadFileAsync is its replacement.
      const downloadedFile = await File.downloadFileAsync(src, destFile, { idempotent: true });
      fileUri = downloadedFile.uri;

      const savedFile = new File(fileUri);
      if (savedFile.exists && (savedFile.size ?? 0) > MAX_DOWNLOAD_BYTES) {
        savedFile.delete();
        throw new Error("This file is too large to download.");
      }
    }
    // Base64 / data URL
    else if (src.startsWith("data:")) {
      const extMatch = src.match(/^data:image\/(\w+);base64,/);
      const ext = extMatch?.[1] ?? "jpg";
      const filename = `digiability-${Date.now()}.${ext}`;
      const destFile = new File(Paths.cache, filename);
      destFile.write(src.replace(/^data:image\/\w+;base64,/, ""));
      fileUri = destFile.uri;
    }

    return fileUri;
  };

  // ── Download & Save Directly to Phone Gallery / Photos ──
  const handleDownload = async () => {
    if (!src || downloading) return;
    setDownloading(true);
    setDownloadSuccess(false);

    try {
      const localUri = await prepareLocalFile();

      // Request photo/video write permission only (not AUDIO to avoid AndroidManifest error)
      const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync(true, ["photo", "video"]);
      if (status !== "granted") {
        setDownloadSuccess(false);
        if (canAskAgain === false) {
          // Permanently denied ("don't ask again" on Android, or a
          // previously-declined prompt on iOS) — the OS won't show the
          // request dialog again, so the only way forward is Settings.
          Alert.alert(
            "Permission Required",
            "Photo/media access is turned off for Digiability. Enable it in Settings to save images to your phone Gallery.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ]
          );
        } else {
          Alert.alert(
            "Permission Required",
            "Please allow photo/media access so Digiability can save images to your phone Gallery.",
            [{ text: "OK" }]
          );
        }
        return;
      }

      // Save to device Gallery — green tick ONLY if this succeeds
      await MediaLibrary.saveToLibraryAsync(localUri);

      setDownloadSuccess(true);
      Alert.alert(
        "Saved to Gallery ✓",
        "The media has been saved to your device's Photos / Gallery.",
        [{ text: "OK" }]
      );
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (error: any) {
      console.error("Save to gallery error:", error);
      setDownloadSuccess(false);
      Alert.alert(
        "Save Failed",
        error?.message || "Could not save media to device. Please try again."
      );
    } finally {
      setDownloading(false);
    }
  };

  // ── Share via external apps (WhatsApp, Drive, etc.) ──
  const handleShare = async () => {
    try {
      const localUri = await prepareLocalFile();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri, {
          mimeType: isVideo ? "video/mp4" : "image/jpeg",
          dialogTitle: isVideo ? "Share Video" : "Share Image",
        });
      } else {
        Alert.alert("Share", "Sharing is not available on this device.");
      }
    } catch (error: any) {
      Alert.alert("Share Failed", error?.message || "Could not open share menu.");
    }
  };

  if (!visible) return null;

  // ── VIDEO: Custom full-screen modal ──
  if (isVideo) {
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
          <View style={[styles.topBarSafe, { paddingTop: Math.max(insets.top, 16) }]}>
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.backBtn} onPress={handleClose} accessibilityRole="button" accessibilityLabel="Back" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <ArrowLeft size={22} color="#fff" strokeWidth={2.2} />
                <AccessibleText numberOfLines={1} style={styles.headerTitle}>{alt || title}</AccessibleText>
              </TouchableOpacity>
              <View style={styles.actionsRow}>
                <TouchableOpacity style={[styles.iconBtn, downloadSuccess && styles.iconBtnSuccess]} onPress={handleDownload} disabled={downloading} accessibilityRole="button" accessibilityLabel="Save to Gallery" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  {downloading ? <ActivityIndicator size="small" color="#fff" /> : downloadSuccess ? <Check size={20} color="#4ADE80" strokeWidth={2.5} /> : <Download size={20} color="#fff" strokeWidth={2} />}
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Share2 size={20} color="#fff" strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeBtn} onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={20} color="#fff" strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          {/* Video player */}
          <View style={styles.content}>
            <Video
              ref={videoRef}
              source={{ uri: src }}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay={false}
              isLooping={false}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
              accessibilityLabel={alt || "Video"}
            />
          </View>
        </View>
      </Modal>
    );
  }

  // ── IMAGE: react-native-image-viewing handles pinch-to-zoom, pan, centering natively ──
  // The library hides the Android status bar while the viewer is open
  // (StatusBarManager calls StatusBar.setHidden for overFullScreen, which is
  // Android-only), but insets.top still reports the inset for it — so padding
  // by insets.top there pushed the bar well below the top edge. iOS keeps the
  // status bar visible and still needs the real inset.
  const imageHeaderTopPadding = Platform.OS === "android" ? 12 : Math.max(insets.top, 16);

  // Defined once rather than inline: passing an arrow to HeaderComponent makes
  // it a new component type on every render, so React remounts the header and
  // the download spinner / success tick lose their state mid-download.
  const ImageViewerHeader = useCallback(() => (
    <View style={[styles.topBarSafe, { paddingTop: imageHeaderTopPadding }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={handleClose} accessibilityRole="button" accessibilityLabel="Back" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={22} color="#fff" strokeWidth={2.2} />
          <AccessibleText numberOfLines={1} style={styles.headerTitle}>{alt || title}</AccessibleText>
        </TouchableOpacity>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.iconBtn, downloadSuccess && styles.iconBtnSuccess]} onPress={handleDownload} disabled={downloading} accessibilityRole="button" accessibilityLabel="Save to Gallery" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {downloading ? <ActivityIndicator size="small" color="#fff" /> : downloadSuccess ? <Check size={20} color="#4ADE80" strokeWidth={2.5} /> : <Download size={20} color="#fff" strokeWidth={2} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Share2 size={20} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={20} color="#fff" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ), [imageHeaderTopPadding, alt, title, downloading, downloadSuccess, handleClose, handleDownload, handleShare]);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <ImageViewing
        images={[{ uri: src }]}
        imageIndex={0}
        visible={visible}
        onRequestClose={handleClose}
        animationType="fade"
        backgroundColor="#000"
        swipeToCloseEnabled={false}
        doubleTapToZoomEnabled={true}
        // Without this, the library's own Android modal adds a
        // StatusBar.currentHeight top offset AND our own topBarSafe below
        // adds insets.top on top of that — double-compensating and pushing
        // the header bar down. overFullScreen makes the modal true top:0
        // full-screen (and hides the status bar while open, standard for a
        // photo viewer), leaving insets.top as the only offset applied.
        presentationStyle="overFullScreen"
        // Custom header with download + share
        HeaderComponent={ImageViewerHeader}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  topBarSafe: {
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    zIndex: 10,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconBtnSuccess: {
    backgroundColor: "rgba(74, 222, 128, 0.2)",
    borderColor: "#4ADE80",
    borderWidth: 1,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  video: {
    width: SCREEN_W,
    height: SCREEN_H * 0.75,
  },
});
