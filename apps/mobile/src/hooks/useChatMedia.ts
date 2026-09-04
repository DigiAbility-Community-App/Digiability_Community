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

export function useChatMedia(conversationId: string, senderId: string | undefined) {
  const addMessage = useChatStore((s) => s.addMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const senderName = useAuthStore((s) => s.user?.name);

  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);

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
            const ext = uri.split(".").pop()?.toLowerCase() || "mp4";
            const { url } = await chatService.uploadMedia(
              { uri, name: `video-${Date.now()}.${ext}`, type: `video/${ext}` },
              "video"
            );
            sendMedia("VIDEO", url, { mimeType: `video/${ext}` });
          } catch (err) {
            console.error("video upload failed", err);
            Alert.alert("Send failed", "Could not send your video.");
          } finally {
            setIsUploading(false);
          }
        } else {
          setPendingImageUri(uri);
        }
      }
    } catch (err) {
      console.error("pickMedia failed", err);
    }
  }, [sendMedia]);

  const cancelPendingImage = useCallback(() => setPendingImageUri(null), []);

  // Send the previously picked image with a screen-reader alt description.
  const sendPendingImage = useCallback(
    async (altText: string) => {
      const uri = pendingImageUri;
      if (!uri) return;
      setPendingImageUri(null);
      setIsUploading(true);
      try {
        const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
        const { url } = await chatService.uploadMedia(
          { uri, name: `image-${Date.now()}.${ext}`, type: `image/${ext === "jpg" ? "jpeg" : ext}` },
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
    [pendingImageUri, sendMedia]
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
