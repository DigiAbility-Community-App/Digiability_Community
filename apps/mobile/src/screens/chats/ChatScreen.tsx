import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
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
      chatService
        .reportUser({ reportedUserId: peerId, conversationId, reason })
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
        );
    },
    [peerId, conversationId]
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
        return <Text style={styles.statusIcon}>...</Text>;
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
          <View style={styles.dateLine} />
          <Text style={styles.dateText}>{(item as Message).content}</Text>
          <View style={styles.dateLine} />
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
          style={[
            styles.messageBubble,
            isMine ? styles.myBubble : styles.theirBubble,
          ]}
        >
          {item.type === "IMAGE" || item.type === "AUDIO" ? (
            <MessageMedia message={item as ChatMessage} isMine={isMine} />
          ) : (
            <Text
              style={[
                styles.messageText,
                isMine ? styles.myMessageText : styles.theirMessageText,
              ]}
            >
              {item.content}
            </Text>
          )}
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                isMine ? styles.myMessageTime : styles.theirMessageTime,
              ]}
            >
              {timeString}
            </Text>
            {isMine && renderStatusIcon(item.status)}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScreenWrapper withBottomSafeArea={false}>
      {/* ── Header — paddingTop uses insets so it clears the translucent status bar */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color="#fff" strokeWidth={2.2} />
        </TouchableOpacity>

        <View style={styles.headerProfile}>
          <View style={styles.headerAvatarContainer}>
            <View style={styles.headerAvatar}>
              {recipientAvatar ? (
                <Text style={styles.headerAvatarEmoji}>{recipientAvatar}</Text>
              ) : (
                <User size={22} color="#fff" strokeWidth={2} />
              )}
            </View>
            {(peerPresence?.status === "online" || (!peerPresence && isOnline)) && (
              <View style={styles.headerOnlineDot} />
            )}
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>
              {recipientName}
            </Text>
            <Text style={styles.headerStatus}>
              {someoneTyping
                ? "typing…"
                : peerPresence?.status === "online"
                ? "Online"
                : peerPresence?.lastSeen
                ? `Last seen ${formatLastSeen(peerPresence.lastSeen)}`
                : isOnline
                ? "Online"
                : "Offline"}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionBtn}>
            <Phone size={20} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={handleHeaderMenu}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <MoreVertical size={20} color="#fff" strokeWidth={2} />
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
                    <View style={styles.typingBubble}>
                      <View style={styles.typingDots}>
                        <View style={[styles.typingDot, styles.typingDot1]} />
                        <View style={[styles.typingDot, styles.typingDot2]} />
                        <View style={[styles.typingDot, styles.typingDot3]} />
                      </View>
                    </View>
                  </View>
                ) : null
              }
            />

            {/* ── Composer ───────────────────────────────────────── */}
            {media.isRecording && (
              <View style={styles.recordingBar}>
                <Text style={styles.recordingText}>● Recording… tap ⏹ to send</Text>
                <TouchableOpacity onPress={media.cancelRecording}>
                  <Text style={styles.recordingCancel}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              <View style={styles.composerCard}>
                <TouchableOpacity
                  style={styles.plusBtn}
                  onPress={media.pickImage}
                  disabled={media.isUploading}
                  accessibilityLabel="Attach image"
                >
                  {media.isUploading
                    ? <ActivityIndicator size="small" color="#7C3AED" />
                    : <Plus size={24} color="#7C3AED" strokeWidth={2.5} />}
                </TouchableOpacity>

                <View style={styles.inputPill}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Type a message..."
                    placeholderTextColor="#9A93A8"
                    value={messageText}
                    onChangeText={handleTextChange}
                    multiline
                    maxLength={5000}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.micBtn, media.isRecording && styles.micBtnRecording]}
                  onPress={() => (media.isRecording ? media.stopAndSendRecording() : media.startRecording())}
                  accessibilityLabel={media.isRecording ? "Stop and send voice note" : "Record voice note"}
                >
                  {media.isRecording
                    ? <Square size={16} color="#fff" fill="#fff" />
                    : <Mic size={20} color="#fff" />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sendCircle, !messageText.trim() && styles.sendCircleDisabled]}
                  onPress={handleSend}
                  disabled={!messageText.trim()}
                  accessibilityLabel="Send message"
                >
                  <Send size={19} color="#fff" />
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
                    <View style={styles.typingBubble}>
                      <View style={styles.typingDots}>
                        <View style={[styles.typingDot, styles.typingDot1]} />
                        <View style={[styles.typingDot, styles.typingDot2]} />
                        <View style={[styles.typingDot, styles.typingDot3]} />
                      </View>
                    </View>
                  </View>
                ) : null
              }
            />

            {/* ── Composer ───────────────────────────────────────── */}
            {media.isRecording && (
              <View style={styles.recordingBar}>
                <Text style={styles.recordingText}>● Recording… tap ⏹ to send</Text>
                <TouchableOpacity onPress={media.cancelRecording}>
                  <Text style={styles.recordingCancel}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              <View style={styles.composerCard}>
                <TouchableOpacity
                  style={styles.plusBtn}
                  onPress={media.pickImage}
                  disabled={media.isUploading}
                  accessibilityLabel="Attach image"
                >
                  {media.isUploading
                    ? <ActivityIndicator size="small" color="#7C3AED" />
                    : <Plus size={24} color="#7C3AED" strokeWidth={2.5} />}
                </TouchableOpacity>

                <View style={styles.inputPill}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Type a message..."
                    placeholderTextColor="#9A93A8"
                    value={messageText}
                    onChangeText={handleTextChange}
                    multiline
                    maxLength={5000}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.micBtn, media.isRecording && styles.micBtnRecording]}
                  onPress={() => (media.isRecording ? media.stopAndSendRecording() : media.startRecording())}
                  accessibilityLabel={media.isRecording ? "Stop and send voice note" : "Record voice note"}
                >
                  {media.isRecording
                    ? <Square size={16} color="#fff" fill="#fff" />
                    : <Mic size={20} color="#fff" />}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sendCircle, !messageText.trim() && styles.sendCircleDisabled]}
                  onPress={handleSend}
                  disabled={!messageText.trim()}
                  accessibilityLabel="Send message"
                >
                  <Send size={19} color="#fff" />
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
        onClose={() => setReportReasonOpen(false)}
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
    backgroundColor: "#8A38F5",
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
    borderColor: "#8A38F5",
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  headerStatus: {
    color: "rgba(255,255,255,0.7)",
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
    backgroundColor: "rgba(138,56,245,0.15)",
  },
  dateText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: "#8A38F5",
    fontWeight: "600",
    backgroundColor: "#EDE9FE",
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
    backgroundColor: "#8A38F5",
    borderBottomRightRadius: 6,
  },
  theirBubble: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 6,
    shadowColor: "#8A38F5",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  myMessageText: {
    color: "#fff",
  },
  theirMessageText: {
    color: "#1a1a1a",
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
  myMessageTime: {
    color: "rgba(255,255,255,0.65)",
  },
  theirMessageTime: {
    color: "#aaa",
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
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    shadowColor: "#8A38F5",
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
    backgroundColor: "#C4B5FD",
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
    backgroundColor: "#fff",
    borderRadius: 30,
    paddingVertical: 7,
    paddingHorizontal: 8,
    gap: 7,
    shadowColor: "#6B21A8",
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
    backgroundColor: "#fff",
    borderRadius: 20,
  },
  recordingText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "600",
  },
  recordingCancel: {
    color: "#666",
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
    backgroundColor: "#F1EFF6",
    borderRadius: 22,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  textInput: {
    fontSize: 15,
    color: "#1a1a1a",
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
    backgroundColor: "#dc2626",
  },
  sendCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  sendCircleDisabled: {
    backgroundColor: "#CBB8ED",
  },
});
