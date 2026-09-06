// ─────────────────────────────────────────────────────────────
// useChatMedia
//
// Encapsulates media messaging for a conversation:
//   • Voice notes  — record (expo-av) → upload → send AUDIO message
//   • Images       — pick (expo-image-picker) → alt-text → send IMAGE
//
// Optimistically inserts the message into the store, then sends the
// real message.send WS event once the file is uploaded and we have a URL.
// ─────────────────────────────────────────────────────────────

import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { chatService } from "@services/chatService";
import { sendSocketMessage } from "@services/socketService";
import { useChatStore, ChatMessage } from "@store/chatStore";
import { useAuthStore } from "@store/authStore";
import { generateUUID } from "../utils/uuid";

// Resolve the file extension + MIME type to use for an upload.
//
// expo-image-picker assets can come back with a `content://` URI on
// Android (Google Photos, cloud-synced albums, etc.) that has no
// recognizable file extension in the path at all — parsing the URI alone
// then yields a garbled `ext` and an invalid upload MIME type. Prefer the
// asset's own reported `mimeType`/`fileName` fields, which are populated
// regardless of URI scheme, and only fall back to URI-parsing when those
// aren't available (e.g. for plain file:// URIs, which parse fine anyway).
function resolveUploadFileInfo(
  kind: "image" | "video",
  uri: string,
  assetMimeType?: string | null,
  assetFileName?: string | null
): { ext: string; mimeType: string } {
  const fallbackExt = kind === "video" ? "mp4" : "jpg";

  if (assetMimeType) {
    const extFromMime = assetMimeType.split("/").pop()?.toLowerCase();
    if (extFromMime) {
      return { ext: extFromMime === "jpeg" ? "jpg" : extFromMime, mimeType: assetMimeType };
    }
  }
  if (assetFileName && assetFileName.includes(".")) {
    const ext = assetFileName.split(".").pop()!.toLowerCase();
    return { ext, mimeType: `${kind}/${ext === "jpg" ? "jpeg" : ext}` };
  }
  const ext = uri.split(".").pop()?.toLowerCase() || fallbackExt;
  return { ext, mimeType: `${kind}/${ext === "jpg" ? "jpeg" : ext}` };
}

export function useChatMedia(conversationId: string, senderId: string | undefined) {
  const addMessage = useChatStore((s) => s.addMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const senderName = useAuthStore((s) => s.user?.name);

  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  // Sibling state to pendingImageUri: the picker's own reported mimeType/
  // fileName for that same asset, kept separate so pendingImageUri can stay
  // a plain string for existing consumers (AltTextModal's `imageUri` prop).
  const [pendingImageMeta, setPendingImageMeta] = useState<{
    mimeType?: string | null;
    fileName?: string | null;
  }>({});

  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordStartRef = useRef<number>(0);

  // Insert an optimistic media message and fire the real send.
  const sendMedia = useCallback(
    (type: "IMAGE" | "AUDIO" | "VIDEO", url: string, metadata: Record<string, unknown>) => {
      if (!senderId) return;
      const clientMessageId = generateUUID();
      const metaStr = JSON.stringify(metadata);
      const optimistic: ChatMessage = {
        id: clientMessageId,
        clientMessageId,
        conversationId,
        senderId,
        content: url,
        type,
        metadata: metaStr,
        status: "sent",
        createdAt: new Date().toISOString(),
      };
      addMessage(optimistic);
      const sent = sendSocketMessage("message.send", {
        conversationId,
        content: url,
        type,
        clientMessageId,
        metadata: metaStr,
        senderName,
      });
      if (!sent) {
        // Never leave the optimistic bubble looking delivered when nothing
        // left the device — the failed status drives the themed dialog.
        useChatStore.getState().failMessage(clientMessageId, "You appear to be offline. The message wasn't sent.");
      }
    },
    [conversationId, senderId, addMessage, senderName]
  );

  // ── Voice recording ──────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Microphone needed", "Please allow microphone access to record a voice note.");
        return;
      }
      // Reset audio mode first to clear any stale session from a previous recording
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      recordStartRef.current = Date.now();
      setIsRecording(true);
    } catch (err) {
      console.error("startRecording failed", err);
      Alert.alert("Recording failed", "Could not start recording. Please try again.");
    }
  }, []);

  const teardownRecording = useCallback(async (): Promise<string | null> => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    setIsRecording(false);
    if (!recording) return null;
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      return recording.getURI();
    } catch (err) {
      console.error("stopRecording failed", err);
      return null;
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    await teardownRecording();
  }, [teardownRecording]);

  const stopAndSendRecording = useCallback(async () => {
    const durationMs = Date.now() - recordStartRef.current;
    const uri = await teardownRecording();
    if (!uri) return;
    if (durationMs < 500) return; // ignore accidental taps
    setIsUploading(true);
    try {
      // expo-av's HIGH_QUALITY preset records .m4a on Android but .caf on
      // iOS — name/type the part after the actual file so the stored
      // extension matches the content.
      const ext = uri.split(".").pop()?.toLowerCase() || "m4a";
      const mime = ext === "caf" ? "audio/x-caf" : ext === "m4a" ? "audio/m4a" : `audio/${ext}`;
      const { url } = await chatService.uploadMedia(
        { uri, name: `voice-${Date.now()}.${ext}`, type: mime },
        "audio"
      );
      sendMedia("AUDIO", url, { durationMs });
    } catch (err) {
      console.error("voice upload failed", err);
      Alert.alert("Send failed", "Could not send your voice note.");
    } finally {
      setIsUploading(false);
    }
  }, [teardownRecording, sendMedia]);

  // ── Media picking ────────────────────────────────────────
  const pickMedia = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Photos needed", "Please allow photo access to share media.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const asset = result.assets[0];
        const uri = asset.uri;
        const isVideo = asset.type === 'video';

        if (isVideo) {
          // Immediately send video (no alt text needed)
          setIsUploading(true);
          try {
            const { ext, mimeType } = resolveUploadFileInfo(
              "video",
              uri,
              asset.mimeType,
              asset.fileName
            );
            const { url } = await chatService.uploadMedia(
              { uri, name: `video-${Date.now()}.${ext}`, type: mimeType },
              "video"
            );
            sendMedia("VIDEO", url, { mimeType });
          } catch (err) {
            console.error("video upload failed", err);
            Alert.alert("Send failed", "Could not send your video.");
          } finally {
            setIsUploading(false);
          }
        } else {
          setPendingImageUri(uri);
          setPendingImageMeta({ mimeType: asset.mimeType, fileName: asset.fileName });
        }
      }
    } catch (err) {
      console.error("pickMedia failed", err);
    }
  }, [sendMedia]);

  const cancelPendingImage = useCallback(() => {
    setPendingImageUri(null);
    setPendingImageMeta({});
  }, []);

  // Send the previously picked image with a screen-reader alt description.
  const sendPendingImage = useCallback(
    async (altText: string) => {
      const uri = pendingImageUri;
      if (!uri) return;
      const { mimeType: assetMimeType, fileName: assetFileName } = pendingImageMeta;
      setPendingImageUri(null);
      setPendingImageMeta({});
      setIsUploading(true);
      try {
        const { ext, mimeType } = resolveUploadFileInfo("image", uri, assetMimeType, assetFileName);
        const { url } = await chatService.uploadMedia(
          { uri, name: `image-${Date.now()}.${ext}`, type: mimeType },
          "image"
        );
        sendMedia("IMAGE", url, { altText: altText.trim() });
      } catch (err) {
        console.error("image upload failed", err);
        Alert.alert("Send failed", "Could not send your image.");
      } finally {
        setIsUploading(false);
      }
    },
    [pendingImageUri, pendingImageMeta, sendMedia]
  );

  return {
    isRecording,
    isUploading,
    startRecording,
    cancelRecording,
    stopAndSendRecording,
    pendingImageUri,
    pickMedia,
    cancelPendingImage,
    sendPendingImage,
    removeMessage,
  };
}
