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
  Alert,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp, useFocusEffect } from "@react-navigation/native";
import { ChatsStackParamList } from "@navigation/ChatsStack";
import { useAuthStore } from "@store/authStore";
import { useChatStore, ChatMessage } from "@store/chatStore";
import { chatService } from "@services/chatService";
import { sendSocketMessage } from "@services/socketService";
import * as Speech from "expo-speech";
import * as Location from "expo-location";
import { generateUUID } from "../../utils/uuid";
import { useChatMedia } from "@hooks/useChatMedia";
import { MessageMedia } from "../../components/chat/MessageMedia";
import { AltTextModal } from "../../components/chat/AltTextModal";
import { ActionSheet, ActionSheetOption } from "../../components/chat/ActionSheet";
import { ConfirmDialog } from "../../components/chat/ConfirmDialog";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Check, CheckCheck, Plus, Mic, Send, Square,
  ArrowLeft, Settings, Trash2, Volume2, Users, Accessibility, Heart, HeartHandshake,
  Flag, CircleCheck, TriangleAlert,
} from "lucide-react-native";

// ─────────────────────────────────────────────────────────
// Group Chat Screen — Care Circle / Group Thread
//
// Real-time group messaging with:
// - Sender name on each message (unlike DM)
// - Member avatars beside messages
// - Group info banner
// - Real WebSocket message delivery
// ─────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<ChatsStackParamList, "GroupChat">;
  route: RouteProp<ChatsStackParamList, "GroupChat">;
};

const MEMBER_COLORS = [
  "#E74C3C", "#2ECC71", "#3498DB", "#F39C12", "#9B59B6",
  "#1ABC9C", "#E91E63", "#00BCD4", "#FF5722", "#607D8B",
];

const GroupChatScreen = ({ navigation, route }: Props) => {
  const { conversationId, groupName, subType } = route.params;
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const storeMessages = useChatStore((s) => s.messages[conversationId] || []);
  const setMessages = useChatStore((s) => s.setMessages);
  const addMessage = useChatStore((s) => s.addMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const conversation = useChatStore((s) => s.conversations[conversationId]);
  const clearUnreadCount = useChatStore((s) => s.clearUnreadCount);

  // Opening the group marks it read: clear the local badge + advance read cursor.
  useEffect(() => {
    clearUnreadCount(conversationId);
    const msgs = useChatStore.getState().messages[conversationId] || [];
    const lastFromOther = [...msgs].reverse().find((m) => m.senderId !== user?.id);
    if (lastFromOther?.id) {
      sendSocketMessage("message.read", { messageId: lastFromOther.id, conversationId });
    }
  }, [conversationId, storeMessages.length]);

  // Admin rights for force-deleting others' messages
  const myRole = conversation?.participants?.find((p) => p.userId === user?.id)?.role;
  const hasAdminRights = subType === "CARE_CIRCLE"
    ? myRole === "OWNER" || myRole === "CAREGIVER"
    : myRole === "OWNER" || myRole === "ADMIN";

  const typingUserIds = useChatStore((s) => s.typing[conversationId]);
  const someoneTyping = (typingUserIds || []).some((id) => id !== user?.id);

  // Voice notes + image sharing.
  const media = useChatMedia(conversationId, user?.id);

  const [messageText, setMessageText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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

  // Build a userId → name map from conversation participants
  const memberNameMap = useCallback(() => {
    const map: Record<string, string> = {};
    if (conversation?.participants) {
      conversation.participants.forEach((p) => {
        map[p.userId] = p.user?.name || "Unknown";
      });
    }
    return map;
  }, [conversation]);

  // Deduplicate messages
  const dedupedMessages = useMemo(() => {
    const seen = new Map<string, ChatMessage>();
    const seenClientIds = new Map<string, string>(); // clientMessageId → best id

    for (const msg of storeMessages) {
      if (msg.clientMessageId) {
        const existingKey = seenClientIds.get(msg.clientMessageId);
        if (existingKey) {
          const existing = seen.get(existingKey);
          if (existing && existing.id === existing.clientMessageId && msg.id !== msg.clientMessageId) {
            seen.delete(existingKey);
            seen.set(msg.id, msg);
            seenClientIds.set(msg.clientMessageId, msg.id);
          }
          continue;
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

  // Exact array the (inverted) FlatList renders: newest → oldest. Sender
  // grouping MUST be computed against this same array/index, otherwise deletes
  // desync it from the render order and avatars/names vanish intermittently.
  const listData = useMemo(() => [...dedupedMessages].reverse(), [dedupedMessages]);

  // Assign stable colors based on member index
  const memberColorMap = useCallback(() => {
    const map: Record<string, string> = {};
    if (conversation?.participants) {
      conversation.participants.forEach((p, i) => {
        map[p.userId] = MEMBER_COLORS[i % MEMBER_COLORS.length];
      });
    }
    return map;
  }, [conversation]);

  const nameMap = memberNameMap();
  const colorMap = memberColorMap();

  // Refresh conversation data every time this screen comes into focus so
  // member count and participant list always reflect the latest state.
  // This fixes the stale count bug where the refresh was skipped when
  // at least one participant was already in the store.
  useFocusEffect(
    useCallback(() => {
      chatService.getConversations().then((convos) => {
        useChatStore.getState().setConversations(convos);
      }).catch(console.error);
    }, [conversationId])
  );

  // Load message history and ensure conversation is in the store
  useEffect(() => {
    const loadMessages = async () => {
      try {
        // Always ensure conversation is in the store before loading messages
        const storeConv = useChatStore.getState().conversations[conversationId];
        if (!storeConv) {
          const convos = await chatService.getConversations();
          useChatStore.getState().setConversations(convos);
        }

        const data = (await chatService.getMessages(conversationId)) as ChatMessage[];
        const existing = useChatStore.getState().messages[conversationId] || [];
        const existingIds = new Set(existing.map(m => m.id));
        const existingClientIds = new Set(existing.map(m => m.clientMessageId));

        const merged: ChatMessage[] = [...existing];
        for (const msg of data) {
          if (!existingIds.has(msg.id) && !existingClientIds.has(msg.clientMessageId)) {
            merged.push(msg);
          }
        }
        merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setMessages(conversationId, merged);
      } catch (err) {
        console.error("Failed to load group messages", err);
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
    setTimeout(() => { isSendingRef.current = false; }, 300);

    const content = messageText.trim();
    const clientMessageId = generateUUID();

    // Optimistic update
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

    // Send via WebSocket
    sendSocketMessage("message.send", {
      conversationId,
      content,
      type: "TEXT",
      clientMessageId,
    });
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

  // Emergency SOS — posts an urgent, location-tagged alert to the care circle.
  // Reuses the normal message pipeline so it delivers + push-notifies members.
  const sendSOS = useCallback(
    (locationLine: string) => {
      if (!user) return;
      const content = `🆘 EMERGENCY — I need help right now.${locationLine}`;
      const clientMessageId = generateUUID();
      const optimistic: ChatMessage = {
        id: clientMessageId,
        clientMessageId,
        conversationId,
        senderId: user.id,
        content,
        type: "TEXT",
        metadata: JSON.stringify({ sos: true }),
        status: "sent",
        createdAt: new Date().toISOString(),
      };
      addMessage(optimistic);
      sendSocketMessage("message.send", {
        conversationId,
        content,
        type: "TEXT",
        clientMessageId,
        metadata: JSON.stringify({ sos: true }),
      });
    },
    [user, conversationId, addMessage]
  );

  const handleSOS = useCallback(() => {
    Alert.alert(
      "Send Emergency SOS?",
      "This alerts everyone in your care circle immediately and shares your current location if available.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send SOS",
          style: "destructive",
          onPress: async () => {
            let locationLine = "";
            try {
              const perm = await Location.requestForegroundPermissionsAsync();
              if (perm.status === "granted") {
                const pos = await Location.getCurrentPositionAsync({
                  accuracy: Location.Accuracy.Balanced,
                });
                const { latitude, longitude } = pos.coords;
                locationLine = `\n📍 My location: https://maps.google.com/?q=${latitude},${longitude}`;
              }
            } catch (err) {
              console.error("SOS location failed", err);
            }
            sendSOS(locationLine);
          },
        },
      ]
    );
  }, [sendSOS]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // ── Message deletion (stylish modals) ───────────────────────
  const performDelete = (messageId: string, deleteFor: "me" | "everyone") => {
    sendSocketMessage("message.delete", { messageId, conversationId, deleteFor });
    // Optimistically remove from local list
    removeMessage(conversationId, messageId);
  };

  const [messageMenu, setMessageMenu] = useState<ChatMessage | null>(null);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message?: string;
    icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
    confirmLabel: string;
    destructive?: boolean;
    hideCancel?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Reporting a specific message — captures messageId + sender so the admin
  // moderation queue gets full context, not just a bare user-level report.
  const [reportTarget, setReportTarget] = useState<ChatMessage | null>(null);
  const submitMessageReport = (reason: string) => {
    if (!reportTarget) return;
    chatService
      .reportUser({
        reportedUserId: reportTarget.senderId,
        conversationId,
        messageId: reportTarget.id,
        reason,
      })
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
      .finally(() => setReportTarget(null));
  };

  const askDelete = (messageId: string, deleteFor: "me" | "everyone") => {
    setConfirmState({
      title: deleteFor === "everyone" ? "Delete for everyone?" : "Delete for me?",
      message: "This action can't be undone.",
      icon: Trash2,
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: () => performDelete(messageId, deleteFor),
    });
  };

  const handleMessageLongPress = (item: ChatMessage) => {
    if (!item.id || item.status === "sending") return;
    setMessageMenu(item);
  };

  // Options for the message action sheet, derived from the current target.
  const messageMenuOptions: ActionSheetOption[] = (() => {
    if (!messageMenu) return [];
    const item = messageMenu;
    const isMine = item.senderId === user?.id;
    const canDeleteForEveryone = isMine || hasAdminRights;
    const opts: ActionSheetOption[] = [];
    if (item.type === "TEXT" && item.content?.trim()) {
      opts.push({ label: "Read aloud", icon: Volume2, onPress: () => Speech.speak(item.content) });
    }
    if (!isMine) {
      opts.push({
        label: "Report message",
        icon: Flag,
        destructive: true,
        onPress: () => setReportTarget(item),
      });
    }
    opts.push({ label: "Delete for me", icon: Trash2, destructive: true, onPress: () => askDelete(item.id, "me") });
    if (canDeleteForEveryone) {
      opts.push({ label: "Delete for everyone", icon: Trash2, destructive: true, onPress: () => askDelete(item.id, "everyone") });
    }
    return opts;
  })();

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isMine = item.senderId === user?.id;
    const senderName = isMine ? "You" : (nameMap[item.senderId] || "Unknown");
    const senderColor = colorMap[item.senderId] || "#8A38F5";

    // List is inverted (newest first), so the chronologically-previous (older)
    // message — the one rendered directly above — is at index + 1. Show the
    // sender header only when that neighbour is a different sender.
    const prevMsg = listData[index + 1] || null;
    const showSender = !isMine && prevMsg?.senderId !== item.senderId;

    const timeString = item.createdAt
      ? new Date(item.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

    return (
      <View
        style={[
          styles.messageRow,
          isMine ? styles.myMessageRow : styles.theirMessageRow,
        ]}
      >
        {/* Sender Avatar (only for others, first in sequence) */}
        {!isMine && (
          <View style={styles.avatarSlot}>
            {showSender ? (
              <View style={[styles.msgAvatar, { backgroundColor: senderColor + "20" }]}>
                <Text style={[styles.msgAvatarText, { color: senderColor }]}>
                  {getInitials(senderName)}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={[styles.bubbleWrapper, isMine && { alignItems: "flex-end" }]}>
          {/* Sender name */}
          {showSender && (
            <Text style={[styles.senderName, { color: senderColor }]}>
              {senderName}
            </Text>
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onLongPress={() => handleMessageLongPress(item)}
            delayLongPress={300}
            style={[
              styles.messageBubble,
              isMine ? styles.myBubble : styles.theirBubble,
            ]}
          >
            {item.type === "IMAGE" || item.type === "AUDIO" ? (
              <MessageMedia message={item} isMine={isMine} />
            ) : (
              <Text
                style={[
                  styles.messageText,
                  isMine && styles.myMessageText,
                ]}
              >
                {item.content}
              </Text>
            )}
            <View style={styles.messageFooter}>
              <Text
                style={[
                  styles.messageTime,
                  isMine && styles.myMessageTime,
                ]}
              >
                {timeString}
              </Text>
              {isMine && (
                <View style={{ marginLeft: 4 }}>
                  {item.status === "sending" ? (
                    <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>...</Text>
                  ) : item.status === "read" ? (
                    <CheckCheck size={14} color="#38bdf8" />
                  ) : item.status === "delivered" ? (
                    <CheckCheck size={14} color="rgba(255,255,255,0.8)" />
                  ) : (
                    <Check size={14} color="rgba(255,255,255,0.8)" />
                  )}
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <ScreenWrapper>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color="#fff" strokeWidth={2.2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.groupIconContainer}>
              <View style={styles.groupIcon}>
                {subType === 'CARE_CIRCLE'
                  ? <Accessibility size={22} color="#fff" strokeWidth={2} />
                  : <Users size={22} color="#fff" strokeWidth={2} />}
              </View>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerName} numberOfLines={1}>{groupName}</Text>
              <Text style={styles.headerMembers}>Loading...</Text>
            </View>
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#8A38F5" />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper withBottomSafeArea={false}>
      {/* ── Header — paddingTop clears the translucent status bar via safe-area insets */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color="#fff" strokeWidth={2.2} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => navigation.navigate("GroupInfo", { conversationId })}
          activeOpacity={0.7}
        >
          <View style={styles.groupIconContainer}>
            <View style={styles.groupIcon}>
              {subType === 'CARE_CIRCLE'
                ? <Accessibility size={22} color="#fff" strokeWidth={2} />
                : <Users size={22} color="#fff" strokeWidth={2} />}
            </View>
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>
              {groupName}
            </Text>
            <Text style={styles.headerMembers}>
              {conversation?.participants?.length || 0} members
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {subType === 'CARE_CIRCLE' && (
            <TouchableOpacity
              style={styles.sosBtn}
              onPress={handleSOS}
              accessibilityRole="button"
              accessibilityLabel="Send emergency SOS to this care circle"
            >
              <Text style={styles.sosBtnText}>SOS</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => navigation.navigate("GroupInfo", { conversationId })}
          >
            <Settings size={20} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Messages ─────────────────────────────────────── */}
      <View style={{ flex: 1, paddingBottom: Platform.OS === 'android' ? (keyboardHeight > 0 ? keyboardHeight + 10 : 0) : 0 }}>
        {Platform.OS === 'ios' ? (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
            {/* iOS wrapper */}
            <FlatList
              ref={flatListRef}
              data={listData}
              inverted
              keyExtractor={(item, index) => item.id ? `${item.id}-${index}` : `msg-${index}`}
              renderItem={renderMessage}
              contentContainerStyle={[styles.messageList, { paddingBottom: 10 }]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>{subType === 'CARE_CIRCLE' ? <Heart size={48} color="#8A38F5" strokeWidth={1.75} /> : <HeartHandshake size={48} color="#8A38F5" strokeWidth={1.75} />}</View>
                  <Text style={styles.emptyTitle}>Welcome to {groupName}!</Text>
                  <Text style={styles.emptySubtitle}>
                    Send the first message to start the conversation
                  </Text>
                </View>
              }
            />

            {/* ── Composer ───────────────────────────────────── */}
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
                    placeholder="Message the group..."
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
              data={listData}
              inverted
              keyExtractor={(item, index) => item.id ? `${item.id}-${index}` : `msg-${index}`}
              renderItem={renderMessage}
              contentContainerStyle={[styles.messageList, { paddingBottom: 10 }]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>{subType === 'CARE_CIRCLE' ? <Heart size={48} color="#8A38F5" strokeWidth={1.75} /> : <HeartHandshake size={48} color="#8A38F5" strokeWidth={1.75} />}</View>
                  <Text style={styles.emptyTitle}>Welcome to {groupName}!</Text>
                  <Text style={styles.emptySubtitle}>
                    Send the first message to start the conversation
                  </Text>
                </View>
              }
            />

            {/* ── Composer ───────────────────────────────────── */}
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
                    placeholder="Message the group..."
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

      {/* Confirm dialog */}
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

      {/* Report reason picker */}
      <ActionSheet
        visible={!!reportTarget}
        title="Report reason"
        message="Why are you reporting this message?"
        options={["Spam", "Harassment", "Inappropriate content", "Other"].map((r) => ({
          label: r,
          onPress: () => submitMessageReport(r),
        }))}
        onClose={() => setReportTarget(null)}
      />
    </ScreenWrapper>
  );
};

export default GroupChatScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3EAFF",
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#500088",
    paddingHorizontal: 12,
    // paddingTop is dynamic via insets (applied inline)
    paddingBottom: 12,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  backText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  groupIconContainer: {
    marginRight: 10,
  },
  groupIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  groupIconEmoji: {
    fontSize: 22,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  headerMembers: {
    color: "rgba(255,255,255,0.65)",
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
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerActionIcon: {
    fontSize: 18,
  },

  // ── Messages ────────────────────────────────────────────
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 8,
  },

  // Message row
  messageRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  myMessageRow: {
    justifyContent: "flex-end",
  },
  theirMessageRow: {
    justifyContent: "flex-start",
  },

  // Sender avatar
  avatarSlot: {
    width: 32,
    marginRight: 6,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  msgAvatarText: {
    fontSize: 10,
    fontWeight: "800",
  },

  // Bubble
  bubbleWrapper: {
    maxWidth: "75%",
  },
  senderName: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
    marginLeft: 4,
  },
  messageBubble: {
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
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    color: "#1a1a1a",
  },
  myMessageText: {
    color: "#fff",
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
    color: "#aaa",
  },
  myMessageTime: {
    color: "rgba(255,255,255,0.6)",
  },
  statusIcon: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
  },

  // ── Empty State ─────────────────────────────────────────
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#6B21A8",
    textAlign: "center",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
  },

  // ── Composer ────────────────────────────────────────────
  sosBtn: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  sosBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.5,
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
  typingHint: {
    paddingHorizontal: 20,
    paddingBottom: 6,
    fontSize: 12,
    fontStyle: "italic",
    color: "#7c3aed",
  },
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
