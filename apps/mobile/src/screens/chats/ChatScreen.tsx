import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { ChatsStackParamList } from "@navigation/ChatsStack";
import { useAuthStore } from "@store/authStore";
import { useChatStore, ChatMessage } from "@store/chatStore";
import { chatService } from "@services/chatService";
import { sendSocketMessage } from "@services/socketService";
import * as Speech from "expo-speech";
import { generateUUID } from "../../utils/uuid";
import { useChatMedia } from "@hooks/useChatMedia";
import { MessageMedia } from "../../components/chat/MessageMedia";
import { AltTextModal } from "../../components/chat/AltTextModal";
import { ActionSheet, ActionSheetOption } from "../../components/chat/ActionSheet";
import { ConfirmDialog } from "../../components/chat/ConfirmDialog";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Send, ArrowLeft, MoreVertical, Paperclip, Mic, Image as ImageIcon, Smile, Check, CheckCheck, Plus, Square, Phone, Trash2, Volume2, Flag, Ban, CircleCheck, TriangleAlert, User } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";

// ─────────────────────────────────────────────────────────
// 1:1 Chat Screen — Direct Message Thread
//
// Full chat UI with:
// - Message bubbles (sent/received)
// - Delivery/read receipts (✓ ✓✓)
// - Typing indicator
// - Message composer with attachments
// - Date separators
// - User presence status
//
// Uses demo messages for the demo build.
// ─────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<ChatsStackParamList, "Chat">;
  route: RouteProp<ChatsStackParamList, "Chat">;
};

interface Message {
  id: string;
  content: string;
  senderId: string;
  timestamp: string;
  status: "sent" | "delivered" | "read";
  type: "TEXT" | "IMAGE" | "FILE";
  isDateSeparator?: boolean;
}

const CURRENT_USER_ID = "me";

const DEMO_MESSAGES: Message[] = [
  {
    id: "date-1",
    content: "Today",
    senderId: "",
    timestamp: "",
    status: "read",
    type: "TEXT",
    isDateSeparator: true,
  },
  {
    id: "m1",
    content: "Hi Dr. Sharma! I wanted to ask about the new therapy plan you mentioned.",
    senderId: CURRENT_USER_ID,
    timestamp: "10:30 AM",
    status: "read",
    type: "TEXT",
  },
  {
    id: "m2",
    content: "Hello! Yes, I've prepared a customized mobility plan based on your last assessment. Let me share the details.",
    senderId: "other",
    timestamp: "10:32 AM",
    status: "read",
    type: "TEXT",
  },
  {
    id: "m3",
    content: "The plan includes daily stretching exercises, weekly physiotherapy sessions, and some assistive device recommendations.",
    senderId: "other",
    timestamp: "10:33 AM",
    status: "read",
    type: "TEXT",
  },
  {
    id: "m4",
    content: "That sounds comprehensive! How long should each stretching session be?",
    senderId: CURRENT_USER_ID,
    timestamp: "10:35 AM",
    status: "read",
    type: "TEXT",
  },
  {
    id: "m5",
    content: "I recommend 15-20 minutes in the morning. Start gently and increase intensity gradually. I'll send you a video guide as well.",
    senderId: "other",
    timestamp: "10:37 AM",
    status: "read",
    type: "TEXT",
  },
  {
    id: "m6",
    content: "Thank you so much! This is really helpful 🙏",
    senderId: CURRENT_USER_ID,
    timestamp: "10:38 AM",
    status: "delivered",
    type: "TEXT",
  },
  {
    id: "m7",
    content: "Your therapy plan is ready! Check it when you get a chance. I've also added some resources for adaptive equipment.",
    senderId: "other",
    timestamp: "10:40 AM",
    status: "read",
    type: "TEXT",
  },
];

// Format a presence "last seen" ISO timestamp into a short relative string.
function formatLastSeen(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

const ChatScreen = ({ navigation, route }: Props) => {
  const { conversationId, recipientName, recipientAvatar, isOnline } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, highContrast } = useTheme();
  const user = useAuthStore((s) => s.user);
  const storeMessages = useChatStore((s) => s.messages[conversationId] || []);
  const setMessages = useChatStore((s) => s.setMessages);
  const addMessage = useChatStore((s) => s.addMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const typingUserIds = useChatStore((s) => s.typing[conversationId]);
  const conversation = useChatStore((s) => s.conversations[conversationId]);
  const presenceMap = useChatStore((s) => s.presence);
  const clearUnreadCount = useChatStore((s) => s.clearUnreadCount);

  // Opening a chat marks it read: clear the local badge and advance the
  // server read cursor so it stays cleared after a refresh.
  useEffect(() => {
    clearUnreadCount(conversationId);
    const msgs = useChatStore.getState().messages[conversationId] || [];
    const lastFromOther = [...msgs].reverse().find((m) => m.senderId !== user?.id);
    if (lastFromOther?.id) {
      sendSocketMessage("message.read", { messageId: lastFromOther.id, conversationId });
    }
  }, [conversationId, storeMessages.length]);

  const [messageText, setMessageText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Peer presence — resolve the other DM participant, then read live presence.
  const peerId = useMemo(
    () => conversation?.participants?.find((p) => p.userId !== user?.id)?.userId,
    [conversation, user?.id]
  );
  const peerPresence = peerId ? presenceMap[peerId] : undefined;
  const updatePresence = useChatStore((s) => s.updatePresence);

  // Presence isn't pushed over WS — fetch it when the chat opens and refresh
  // periodically so the header shows Online / last-seen.
  useEffect(() => {
    if (!peerId) return;
    let active = true;
    const fetchPresence = async () => {
      const p = await chatService.getPresence(peerId);
      if (active && p) updatePresence(peerId, p.status, p.lastSeen);
    };
    fetchPresence();
    const interval = setInterval(fetchPresence, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [peerId, updatePresence]);

  // Someone (not me) is typing in this conversation.
  const someoneTyping = (typingUserIds || []).some((id) => id !== user?.id);

  // Voice notes + image sharing.
  const media = useChatMedia(conversationId, user?.id);

  // Emit typing.start while the user types; auto-stop after idle.
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingActiveRef = useRef(false);
  const emitTypingStop = useCallback(() => {
    if (isTypingActiveRef.current) {
      isTypingActiveRef.current = false;
      sendSocketMessage("typing.stop", { conversationId });
    }
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
  }, [conversationId]);
  const handleTextChange = useCallback(
    (text: string) => {
      setMessageText(text);
      if (text.length > 0) {
        if (!isTypingActiveRef.current) {
          isTypingActiveRef.current = true;
          sendSocketMessage("typing.start", { conversationId });
        }
        if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
        typingStopTimer.current = setTimeout(emitTypingStop, 2500);
      } else {
        emitTypingStop();
      }
    },
    [conversationId, emitTypingStop]
  );
  useEffect(() => () => emitTypingStop(), [emitTypingStop]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const flatListRef = useRef<FlatList>(null);

  // Deduplicate messages — prefer server-confirmed messages over optimistic ones
  const dedupedMessages = useMemo(() => {
    const seen = new Map<string, ChatMessage>();
    const seenClientIds = new Map<string, string>(); // clientMessageId → best id

    for (const msg of storeMessages) {
      // Track by clientMessageId to collapse optimistic + confirmed copies
      if (msg.clientMessageId) {
        const existingKey = seenClientIds.get(msg.clientMessageId);
        if (existingKey) {
          // Keep the one with the server id (id !== clientMessageId)
          const existing = seen.get(existingKey);
          if (existing && existing.id === existing.clientMessageId && msg.id !== msg.clientMessageId) {
            // Current msg is server-confirmed, replace the optimistic one
            seen.delete(existingKey);
            seen.set(msg.id, msg);
            seenClientIds.set(msg.clientMessageId, msg.id);
          }
          continue; // Skip duplicate
        }
        seenClientIds.set(msg.clientMessageId, msg.id);
      }

      if (!seen.has(msg.id)) {
        seen.set(msg.id, msg);
      }
    }

    return Array.from(seen.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [storeMessages]);

  useEffect(() => {
    const loadMessages = async () => {
      try {
        const data = (await chatService.getMessages(conversationId)) as ChatMessage[];
        // Merge REST history with any messages already in the store
        // (from WebSocket / optimistic sends) to avoid losing them.
        const existing = useChatStore.getState().messages[conversationId] || [];
        const existingIds = new Set(existing.map(m => m.id));
        const existingClientIds = new Set(existing.map(m => m.clientMessageId));
        
        // Add only truly new messages from REST that we don't already have
        const merged: ChatMessage[] = [...existing];
        for (const msg of data) {
          if (!existingIds.has(msg.id) && !existingClientIds.has(msg.clientMessageId)) {
            merged.push(msg);
          }
        }
        
        // Sort by createdAt
        merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setMessages(conversationId, merged);
      } catch (err) {
        console.error("Failed to load messages", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadMessages();
  }, [conversationId]);

  const isSendingRef = React.useRef(false);

  const handleSend = useCallback(() => {
    if (!messageText.trim() || !user) return;
    if (isSendingRef.current) return; // prevent double-tap
    isSendingRef.current = true;

    const content = messageText.trim();
    const clientMessageId = generateUUID();

    const newMsg: ChatMessage = {
      id: clientMessageId,
      clientMessageId,
      conversationId,
      senderId: user.id,
      content,
      type: "TEXT",
      status: "sent",
      createdAt: new Date().toISOString(),
    };

    addMessage(newMsg);
    setMessageText("");
    emitTypingStop();

    sendSocketMessage("message.send", {
      conversationId,
      content,
      type: "TEXT",
      clientMessageId,
      senderName: user?.name,
    });

    // Re-enable after a brief debounce
    setTimeout(() => { isSendingRef.current = false; }, 300);
  }, [messageText, conversationId, user]);

  // Send button doubles as a voice-note mic when the input is empty.
  const onSendOrMic = useCallback(() => {
    if (messageText.trim()) {
      handleSend();
      return;
    }
    if (media.isRecording) media.stopAndSendRecording();
    else media.startRecording();
  }, [messageText, handleSend, media]);

  // ── Block / Report / Delete (stylish modals) ──────────────
  const [messageMenu, setMessageMenu] = useState<ChatMessage | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [reportReasonOpen, setReportReasonOpen] = useState(false);
  // Set when reporting a specific message (long-press → "Report message"),
  // so the report carries messageId context instead of just the user.
  const [reportTargetMessageId, setReportTargetMessageId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message?: string;
    icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
    confirmLabel: string;
    destructive?: boolean;
    hideCancel?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const submitReport = useCallback(
    (reason: string) => {
      if (!peerId) return;
      const messageId = reportTargetMessageId ?? undefined;
      chatService
        .reportUser({ reportedUserId: peerId, conversationId, messageId, reason })
        .then(() =>
          setConfirmState({
            title: "Report submitted",
            message: "Thank you. Our team will review this.",
            icon: CircleCheck,
            confirmLabel: "Done",
            hideCancel: true,
            onConfirm: () => {},
          })
        )
        .catch(() =>
          setConfirmState({
            title: "Couldn't submit",
            message: "Something went wrong. Please try again.",
            icon: TriangleAlert,
            confirmLabel: "OK",
            hideCancel: true,
            onConfirm: () => {},
          })
        )
        .finally(() => setReportTargetMessageId(null));
    },
    [peerId, conversationId, reportTargetMessageId]
  );

  const askBlock = useCallback(() => {
    if (!peerId) return;
    setConfirmState({
      title: `Block ${recipientName}?`,
      message: "They won't be able to message you, and you won't be able to message them.",
      icon: Ban,
      confirmLabel: "Block",
      destructive: true,
      onConfirm: () => {
        chatService
          .blockUser(peerId)
          .then(() =>
            setConfirmState({
              title: "Blocked",
              message: `You have blocked ${recipientName}.`,
              icon: CircleCheck,
              confirmLabel: "Done",
              hideCancel: true,
              onConfirm: () => {},
            })
          )
          .catch(() => {});
      },
    });
  }, [peerId, recipientName]);

  const askDelete = useCallback(
    (item: ChatMessage, deleteFor: "me" | "everyone") => {
      setConfirmState({
        title: deleteFor === "everyone" ? "Delete for everyone?" : "Delete for me?",
        message: "This action can't be undone.",
        icon: Trash2,
        confirmLabel: "Delete",
        destructive: true,
        onConfirm: () => {
          sendSocketMessage("message.delete", { messageId: item.id, conversationId, deleteFor });
          removeMessage(conversationId, item.id);
        },
      });
    },
    [conversationId, removeMessage]
  );

  const handleHeaderMenu = useCallback(() => {
    if (!peerId) return;
    setHeaderMenuOpen(true);
  }, [peerId]);

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case "sending":
        return <AccessibleText variant="caption" style={styles.statusIcon}>...</AccessibleText>;
      case "sent":
        return <Check size={14} color="rgba(255,255,255,0.8)" style={{ marginLeft: 4 }} />;
      case "delivered":
        return <CheckCheck size={14} color="rgba(255,255,255,0.8)" style={{ marginLeft: 4 }} />;
      case "read":
        return <CheckCheck size={14} color="#38bdf8" style={{ marginLeft: 4 }} />;
      default:
        return null;
    }
  };

  // ── Message long-press → stylish action sheet ───────────────
  const handleMessageLongPress = (item: ChatMessage) => {
    if (!item.id || item.status === "sending") return;
    setMessageMenu(item);
  };

  // Options for the message action sheet, derived from the current target.
  const messageMenuOptions: ActionSheetOption[] = (() => {
    if (!messageMenu) return [];
    const item = messageMenu;
    const isMine = item.senderId === user?.id;
    const opts: ActionSheetOption[] = [];
    if (item.type === "TEXT" && item.content?.trim()) {
      opts.push({ label: "Read aloud", icon: Volume2, onPress: () => Speech.speak(item.content) });
    }
    if (!isMine) {
      opts.push({
        label: "Report message",
        icon: Flag,
        destructive: true,
        onPress: () => {
          setReportTargetMessageId(item.id);
          setReportReasonOpen(true);
        },
      });
    }
    opts.push({ label: "Delete for me", icon: Trash2, destructive: true, onPress: () => askDelete(item, "me") });
    if (isMine) {
      opts.push({ label: "Delete for everyone", icon: Trash2, destructive: true, onPress: () => askDelete(item, "everyone") });
    }
    return opts;
  })();

  const renderMessage = ({ item }: { item: ChatMessage | Message }) => {
    // Date separator logic kept for demo types
    if ((item as Message).isDateSeparator) {
      return (
        <View style={styles.dateSeparator}>
          <View style={[styles.dateLine, { backgroundColor: dateLineColor }]} />
          <AccessibleText
            variant="caption"
            style={[styles.dateText, { color: colors.primary, backgroundColor: colors.surface }, cardBorder]}
          >
            {(item as Message).content}
          </AccessibleText>
          <View style={[styles.dateLine, { backgroundColor: dateLineColor }]} />
        </View>
      );
    }

    const isMine = item.senderId === user?.id || item.senderId === CURRENT_USER_ID;
    const timeString = 'createdAt' in item 
      ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : (item as Message).timestamp;

    return (
      <View
        style={[
          styles.messageBubbleContainer,
          isMine ? styles.myBubbleContainer : styles.theirBubbleContainer,
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => handleMessageLongPress(item as ChatMessage)}
          delayLongPress={300}
          accessibilityRole="button"
          accessibilityLabel={isMine ? "Your message" : `Message from ${recipientName}`}
          accessibilityHint="Double tap and hold for message options"
          style={[
            styles.messageBubble,
            isMine ? styles.myBubble : styles.theirBubble,
            isMine
              ? { backgroundColor: colors.primary }
              : { backgroundColor: colors.card, shadowColor: colors.primary },
            !isMine && cardBorder,
          ]}
        >
          {item.type === "IMAGE" || item.type === "AUDIO" ? (
            <MessageMedia message={item as ChatMessage} isMine={isMine} />
          ) : (
            <AccessibleText
              variant="body"
              style={[
                styles.messageText,
                { color: isMine ? colors.white : colors.text },
              ]}
            >
              {item.content}
            </AccessibleText>
          )}
          <View style={styles.messageFooter}>
            <AccessibleText
              variant="caption"
              style={[
                styles.messageTime,
                { color: isMine ? "rgba(255,255,255,0.65)" : colors.subtext },
              ]}
            >
              {timeString}
            </AccessibleText>
            {isMine && renderStatusIcon(item.status)}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Theme-derived, high-contrast-aware colors ───────────────
  // Standard card outline so white cards/bubbles stay visible against a
  // (also white, under high contrast) screen background.
  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };
  // Date-separator divider — a light tint of primary normally, solid-ish
  // black under high contrast so it doesn't disappear against the bg.
  const dateLineColor = highContrast ? "rgba(0,0,0,0.3)" : "rgba(138,56,245,0.15)";
  // Typing-indicator dots — swap the soft lavender for black under HC.
  const typingDotColor = highContrast ? "#000000" : "#C4B5FD";

  return (
    <ScreenWrapper withBottomSafeArea={false}>
      {/* ── Header — paddingTop uses insets so it clears the translucent status bar */}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: colors.primary }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the conversation list"
        >
          <ArrowLeft size={24} color={colors.white} strokeWidth={2.2} />
        </TouchableOpacity>

        <View style={styles.headerProfile}>
          <View style={styles.headerAvatarContainer}>
            <View style={styles.headerAvatar}>
              {recipientAvatar ? (
                <AccessibleText style={styles.headerAvatarEmoji}>{recipientAvatar}</AccessibleText>
              ) : (
                <User size={22} color={colors.white} strokeWidth={2} />
              )}
            </View>
            {(peerPresence?.status === "online" || (!peerPresence && isOnline)) && (
              <View style={[styles.headerOnlineDot, { borderColor: colors.primary }]} />
            )}
          </View>

          <View style={styles.headerInfo}>
            <AccessibleText
              variant="title"
              style={[styles.headerName, { color: colors.white }]}
              numberOfLines={1}
            >
              {recipientName}
            </AccessibleText>
            <AccessibleText
              variant="caption"
              style={[styles.headerStatus, { color: "rgba(255,255,255,0.7)" }]}
            >
              {someoneTyping
                ? "typing…"
                : peerPresence?.status === "online"
                ? "Online"
                : peerPresence?.lastSeen
                ? `Last seen ${formatLastSeen(peerPresence.lastSeen)}`
                : isOnline
                ? "Online"
                : "Offline"}
            </AccessibleText>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            accessibilityRole="button"
            accessibilityLabel="Call"
            accessibilityHint="Voice calling is not yet available"
          >
            <Phone size={20} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={handleHeaderMenu}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <MoreVertical size={20} color={colors.white} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Messages List ────────────────────────────────── */}
      <View style={{ flex: 1, paddingBottom: Platform.OS === 'android' ? (keyboardHeight > 0 ? keyboardHeight + 10 : 0) : 0 }}>
        {Platform.OS === 'ios' ? (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
            {/* iOS wrapper */}
            <FlatList
              ref={flatListRef}
              data={[...dedupedMessages].reverse()}
              inverted
              keyExtractor={(item, index) => item.id ? `${item.id}-${index}` : `msg-${index}`}
              renderItem={renderMessage}
              contentContainerStyle={[styles.messageList, { paddingBottom: 10 }]}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                someoneTyping ? (
                  <View style={styles.typingContainer}>
                    <View style={[styles.typingBubble, { backgroundColor: colors.card, shadowColor: colors.primary }, cardBorder]}>
                      <View style={styles.typingDots}>
                        <View style={[styles.typingDot, { backgroundColor: typingDotColor }, styles.typingDot1]} />
                        <View style={[styles.typingDot, { backgroundColor: typingDotColor }, styles.typingDot2]} />
                        <View style={[styles.typingDot, { backgroundColor: typingDotColor }, styles.typingDot3]} />
                      </View>
                    </View>
                  </View>
                ) : null
              }
            />

            {/* ── Composer ───────────────────────────────────────── */}
            {media.isRecording && (
              <View style={[styles.recordingBar, { backgroundColor: colors.card }, cardBorder]}>
                <AccessibleText variant="body" style={[styles.recordingText, { color: colors.error }]}>
                  ● Recording… tap ⏹ to send
                </AccessibleText>
                <TouchableOpacity
                  onPress={media.cancelRecording}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel recording"
                >
                  <AccessibleText variant="body" style={[styles.recordingCancel, { color: colors.subtext }]}>
                    Cancel
                  </AccessibleText>
                </TouchableOpacity>
              </View>
            )}
            <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              <View style={[styles.composerCard, { backgroundColor: colors.card, shadowColor: colors.secondary }, cardBorder]}>
                <TouchableOpacity
                  style={styles.plusBtn}
                  onPress={media.pickImage}
                  disabled={media.isUploading}
                  accessibilityRole="button"
                  accessibilityLabel="Attach image"
                  accessibilityHint="Opens your photo library to attach an image"
                >
                  {media.isUploading
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <Plus size={24} color={colors.primary} strokeWidth={2.5} />}
                </TouchableOpacity>

                <View style={[styles.inputPill, { backgroundColor: colors.surface }, cardBorder]}>
                  <TextInput
                    style={[styles.textInput, { color: colors.text }]}
                    placeholder="Type a message..."
                    placeholderTextColor={colors.subtext}
                    value={messageText}
                    onChangeText={handleTextChange}
                    multiline
                    maxLength={5000}
                    accessibilityLabel="Message input"
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.micBtn,
                    media.isRecording && [styles.micBtnRecording, { backgroundColor: colors.error }],
                  ]}
                  onPress={() => (media.isRecording ? media.stopAndSendRecording() : media.startRecording())}
                  accessibilityRole="button"
                  accessibilityLabel={media.isRecording ? "Stop and send voice note" : "Record voice note"}
                >
                  {media.isRecording
                    ? <Square size={16} color={colors.white} fill={colors.white} />
                    : <Mic size={20} color={colors.white} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sendCircle, { backgroundColor: colors.primary }, !messageText.trim() && styles.sendCircleDisabled]}
                  onPress={handleSend}
                  disabled={!messageText.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  accessibilityHint="Sends the typed message"
                >
                  <Send size={19} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        ) : (
          /* Android wrapper */
          <>
            <FlatList
              ref={flatListRef}
              data={[...dedupedMessages].reverse()}
              inverted
              keyExtractor={(item, index) => item.id ? `${item.id}-${index}` : `msg-${index}`}
              renderItem={renderMessage}
              contentContainerStyle={[styles.messageList, { paddingBottom: 10 }]}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                someoneTyping ? (
                  <View style={styles.typingContainer}>
                    <View style={[styles.typingBubble, { backgroundColor: colors.card, shadowColor: colors.primary }, cardBorder]}>
                      <View style={styles.typingDots}>
                        <View style={[styles.typingDot, { backgroundColor: typingDotColor }, styles.typingDot1]} />
                        <View style={[styles.typingDot, { backgroundColor: typingDotColor }, styles.typingDot2]} />
                        <View style={[styles.typingDot, { backgroundColor: typingDotColor }, styles.typingDot3]} />
                      </View>
                    </View>
                  </View>
                ) : null
              }
            />

            {/* ── Composer ───────────────────────────────────────── */}
            {media.isRecording && (
              <View style={[styles.recordingBar, { backgroundColor: colors.card }, cardBorder]}>
                <AccessibleText variant="body" style={[styles.recordingText, { color: colors.error }]}>
                  ● Recording… tap ⏹ to send
                </AccessibleText>
                <TouchableOpacity
                  onPress={media.cancelRecording}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel recording"
                >
                  <AccessibleText variant="body" style={[styles.recordingCancel, { color: colors.subtext }]}>
                    Cancel
                  </AccessibleText>
                </TouchableOpacity>
              </View>
            )}
            <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              <View style={[styles.composerCard, { backgroundColor: colors.card, shadowColor: colors.secondary }, cardBorder]}>
                <TouchableOpacity
                  style={styles.plusBtn}
                  onPress={media.pickImage}
                  disabled={media.isUploading}
                  accessibilityRole="button"
                  accessibilityLabel="Attach image"
                  accessibilityHint="Opens your photo library to attach an image"
                >
                  {media.isUploading
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <Plus size={24} color={colors.primary} strokeWidth={2.5} />}
                </TouchableOpacity>

                <View style={[styles.inputPill, { backgroundColor: colors.surface }, cardBorder]}>
                  <TextInput
                    style={[styles.textInput, { color: colors.text }]}
                    placeholder="Type a message..."
                    placeholderTextColor={colors.subtext}
                    value={messageText}
                    onChangeText={handleTextChange}
                    multiline
                    maxLength={5000}
                    accessibilityLabel="Message input"
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.micBtn,
                    media.isRecording && [styles.micBtnRecording, { backgroundColor: colors.error }],
                  ]}
                  onPress={() => (media.isRecording ? media.stopAndSendRecording() : media.startRecording())}
                  accessibilityRole="button"
                  accessibilityLabel={media.isRecording ? "Stop and send voice note" : "Record voice note"}
                >
                  {media.isRecording
                    ? <Square size={16} color={colors.white} fill={colors.white} />
                    : <Mic size={20} color={colors.white} />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sendCircle, { backgroundColor: colors.primary }, !messageText.trim() && styles.sendCircleDisabled]}
                  onPress={handleSend}
                  disabled={!messageText.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  accessibilityHint="Sends the typed message"
                >
                  <Send size={19} color={colors.white} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>

      <AltTextModal
        visible={!!media.pendingImageUri}
        imageUri={media.pendingImageUri}
        onCancel={media.cancelPendingImage}
        onSend={media.sendPendingImage}
      />

      {/* Message long-press actions */}
      <ActionSheet
        visible={!!messageMenu}
        title="Message"
        options={messageMenuOptions}
        onClose={() => setMessageMenu(null)}
      />

      {/* DM header ⋮ menu */}
      <ActionSheet
        visible={headerMenuOpen}
        title={recipientName}
        options={[
          { label: "Report user", icon: Flag, onPress: () => setReportReasonOpen(true) },
          { label: "Block user", icon: Ban, destructive: true, onPress: askBlock },
        ]}
        onClose={() => setHeaderMenuOpen(false)}
      />

      {/* Report reason picker */}
      <ActionSheet
        visible={reportReasonOpen}
        title="Report reason"
        message="Why are you reporting this user?"
        options={["Spam", "Harassment", "Inappropriate content", "Other"].map((r) => ({
          label: r,
          onPress: () => submitReport(r),
        }))}
        onClose={() => {
          setReportReasonOpen(false);
          setReportTargetMessageId(null);
        }}
      />

      {/* Confirm / info dialog */}
      <ConfirmDialog
        visible={!!confirmState}
        title={confirmState?.title || ""}
        message={confirmState?.message}
        icon={confirmState?.icon}
        confirmLabel={confirmState?.confirmLabel}
        destructive={confirmState?.destructive}
        hideCancel={confirmState?.hideCancel}
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />
    </ScreenWrapper>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3EAFF",
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    // paddingTop is now dynamic via insets (set inline)
    paddingBottom: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  backText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  headerProfile: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  headerAvatarContainer: {
    position: "relative",
    marginRight: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerAvatarEmoji: {
    fontSize: 20,
  },
  headerOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22C55E",
    borderWidth: 2,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: "700",
  },
  headerStatus: {
    fontSize: 12,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: "row",
    gap: 6,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerActionIcon: {
    fontSize: 18,
    color: "#fff",
  },

  // ── Messages ────────────────────────────────────────────
  messageList: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingBottom: 8,
  },

  // Date separator
  dateSeparator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  dateLine: {
    flex: 1,
    height: 1,
  },
  dateText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: "hidden",
  },

  // Message bubbles
  messageBubbleContainer: {
    marginBottom: 6,
  },
  myBubbleContainer: {
    alignItems: "flex-end",
  },
  theirBubbleContainer: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myBubble: {
    borderBottomRightRadius: 6,
  },
  theirBubble: {
    borderBottomLeftRadius: 6,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  statusIcon: {
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
  },
  statusRead: {
    color: "#A5F3FC",
  },

  // ── Typing Indicator ────────────────────────────────────
  typingContainer: {
    alignItems: "flex-start",
    marginTop: 4,
  },
  typingBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  typingDots: {
    flexDirection: "row",
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  typingDot1: { opacity: 0.4 },
  typingDot2: { opacity: 0.7 },
  typingDot3: { opacity: 1 },

  // ── Composer ────────────────────────────────────────────
  composer: {
    paddingHorizontal: 10,
    paddingTop: 8,
    backgroundColor: "transparent",
  },
  composerCard: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 30,
    paddingVertical: 7,
    paddingHorizontal: 8,
    gap: 7,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  recordingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 10,
    marginBottom: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordingText: {
    fontSize: 13,
    fontWeight: "600",
  },
  recordingCancel: {
    fontSize: 13,
    fontWeight: "600",
  },
  plusBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  inputPill: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  textInput: {
    fontSize: 15,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    maxHeight: 110,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F5A623",
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnRecording: {
    // backgroundColor now themed inline (colors.error) so it stays a
    // clear "recording/alert" red in both normal and high-contrast modes.
  },
  sendCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sendCircleDisabled: {
    opacity: 0.45,
  },
});
