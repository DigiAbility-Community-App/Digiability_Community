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
import { chatService, isLocalMediaUri } from "@services/chatService";
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

/** What's needed to re-upload an image whose upload failed, by clientMessageId. */
interface PendingUpload {
  localUri: string;
  mimeType?: string | null;
  fileName?: string | null;
}
// Module-level so it survives the chat screen unmounting while an upload is
// in flight. Entries are removed once the image is uploaded or discarded.
const pendingUploads = new Map<string, PendingUpload>();

const UPLOAD_FAILED_REASON = "Your image couldn't be uploaded. Long-press it to retry or remove it.";

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

  // Fire message.send for a bubble already in the store (its content must be
  // the uploaded server path). Shared by the first send and Retry.
  const emitSend = useCallback(
    (message: ChatMessage) => {
      const sent = sendSocketMessage("message.send", {
        conversationId: message.conversationId,
        content: message.content,
        type: message.type,
        clientMessageId: message.clientMessageId,
        metadata: message.metadata,
        senderName,
      });
      if (!sent) {
        useChatStore.getState().failMessage(message.clientMessageId, "You appear to be offline. The message wasn't sent.");
      }
    },
    [senderName]
  );

  // Upload a picked image for an optimistic bubble that is previewing the
  // local file, then swap in the server path and send it. Upload failure
  // marks the bubble failed (so it gets Retry / Remove) rather than leaving
  // a grey box or just showing an Alert.
  const uploadAndSendImage = useCallback(
    async (message: ChatMessage) => {
      const pending = pendingUploads.get(message.clientMessageId);
      if (!pending) return;
      setIsUploading(true);
      try {
        const { ext, mimeType } = resolveUploadFileInfo(
          "image",
          pending.localUri,
          pending.mimeType,
          pending.fileName
        );
        const { url } = await chatService.uploadMedia(
          { uri: pending.localUri, name: `image-${Date.now()}.${ext}`, type: mimeType },
          "image"
        );
        pendingUploads.delete(message.clientMessageId);
        const uploaded: ChatMessage = { ...message, content: url, status: "sending" };
        addMessage(uploaded); // merges into the optimistic bubble by clientMessageId
        emitSend(uploaded);
      } catch (err) {
        console.error("image upload failed", err);
        useChatStore.getState().failMessage(message.clientMessageId, UPLOAD_FAILED_REASON);
      } finally {
        setIsUploading(false);
      }
    },
    [addMessage, emitSend]
  );

  // Send the previously picked image with a screen-reader alt description.
  // The bubble appears immediately, previewing the local file while it
  // uploads, instead of only appearing (as a grey box) once it is on the server.
  const sendPendingImage = useCallback(
    async (altText: string) => {
      const uri = pendingImageUri;
      if (!uri || !senderId) return;
      const { mimeType, fileName } = pendingImageMeta;
      setPendingImageUri(null);
      setPendingImageMeta({});

      const clientMessageId = generateUUID();
      const optimistic: ChatMessage = {
        id: clientMessageId,
        clientMessageId,
        conversationId,
        senderId,
        content: uri,
        type: "IMAGE",
        metadata: JSON.stringify({ altText: altText.trim() }),
        status: "sending",
        createdAt: new Date().toISOString(),
      };
      pendingUploads.set(clientMessageId, { localUri: uri, mimeType, fileName });
      addMessage(optimistic);
      await uploadAndSendImage(optimistic);
    },
    [pendingImageUri, pendingImageMeta, senderId, conversationId, addMessage, uploadAndSendImage]
  );

  /** True when a failed bubble can be retried from this device. */
  const canRetry = useCallback((message: ChatMessage): boolean => {
    if (message.status !== "failed") return false;
    // Still a local file: retry needs the upload details we kept for it.
    if (isLocalMediaUri(message.content)) return pendingUploads.has(message.clientMessageId);
    return true;
  }, []);

  /**
   * Retry a failed message with the same clientMessageId. A rejected message
   * was never persisted, so the server treats the resend as new; an upload
   * failure re-uploads first.
   */
  const retryMessage = useCallback(
    (message: ChatMessage) => {
      if (!canRetry(message)) return;
      const retrying: ChatMessage = { ...message, status: "sending", failureReason: undefined, failureAcknowledged: false };
      addMessage(retrying);
      if (isLocalMediaUri(message.content)) {
        uploadAndSendImage(retrying);
      } else {
        emitSend(retrying);
      }
    },
    [canRetry, addMessage, uploadAndSendImage, emitSend]
  );

  /**
   * Drop a failed message from this device only. It never reached the
   * server, so there is nothing to delete there — sending its clientMessageId
   * to message.delete just came back MESSAGE_NOT_FOUND.
   */
  const discardFailedMessage = useCallback(
    (message: ChatMessage) => {
      pendingUploads.delete(message.clientMessageId);
      removeMessage(message.conversationId, message.clientMessageId);
    },
    [removeMessage]
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
    canRetry,
    retryMessage,
    discardFailedMessage,
  };
}
