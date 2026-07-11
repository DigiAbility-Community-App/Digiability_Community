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
import { generateUUID } from "../utils/uuid";

export function useChatMedia(conversationId: string, senderId: string | undefined) {
  const addMessage = useChatStore((s) => s.addMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);

  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordStartRef = useRef<number>(0);

  // Insert an optimistic media message and fire the real send.
  const sendMedia = useCallback(
    (type: "IMAGE" | "AUDIO", url: string, metadata: Record<string, unknown>) => {
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
      sendSocketMessage("message.send", {
        conversationId,
        content: url,
        type,
        clientMessageId,
        metadata: metaStr,
      });
    },
    [conversationId, senderId, addMessage]
  );

  // ── Voice recording ──────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Microphone needed", "Please allow microphone access to record a voice note.");
        return;
      }
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

  // ── Image picking ────────────────────────────────────────
  const pickImage = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Photos needed", "Please allow photo access to share an image.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setPendingImageUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error("pickImage failed", err);
    }
  }, []);

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
    pickImage,
    cancelPendingImage,
    sendPendingImage,
    removeMessage,
  };
}
