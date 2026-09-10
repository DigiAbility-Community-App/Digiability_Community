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
  Alert,
  Animated,
  Keyboard,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
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
import { MessageMedia, hasCaption } from "../../components/chat/MessageMedia";
import { MediaViewer } from "../../components/chat/MediaViewer";
import { AltTextModal } from "../../components/chat/AltTextModal";
import { ReportModal } from "../../components/chat/ReportModal";
import { ActionSheet, ActionSheetOption } from "../../components/chat/ActionSheet";
import { ConfirmDialog } from "../../components/chat/ConfirmDialog";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Check, CheckCheck, Plus, Mic, Send, Square,
  ArrowLeft, Settings, Trash2, Volume2, Users, Accessibility, Heart, HeartHandshake,
  Flag, CircleCheck, TriangleAlert, AlertCircle, CornerUpLeft, X
} from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { LinkifiedText } from "../../components/shared/LinkifiedText";
import { istDateKey, formatDateLabel } from "../../utils/dateHelpers";
import { formatUserDisplayName } from "../../utils/formatUserName";

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

// Per-member color-coding palette — each group member gets a stable color for
// their name/avatar initials so a multi-person thread stays scannable. This is
// intentionally its own literal palette (not theme-driven): the whole point is
// per-member distinction, which a single theme color couldn't provide.
const MEMBER_COLORS = [
  "#E74C3C", "#2ECC71", "#3498DB", "#F39C12", "#9B59B6",
  "#1ABC9C", "#E91E63", "#00BCD4", "#FF5722", "#607D8B",
];
// Same hue family, darkened/deepened so each still passes readable contrast
// against a white background under high-contrast mode (several of the
// originals — the greens, oranges, teals, cyan — are too light for that).
const MEMBER_COLORS_HC = [
  "#B71C1C", "#1B5E20", "#0D47A1", "#E65100", "#4A148C",
  "#004D40", "#880E4F", "#006064", "#BF360C", "#263238",
];

const GroupChatScreen = ({ navigation, route }: Props) => {
  const { conversationId, groupName, subType } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, highContrast } = useTheme();
  const user = useAuthStore((s) => s.user);
  const storeMessages = useChatStore((s) => s.messages[conversationId] || []);
  const setMessages = useChatStore((s) => s.setMessages);
  const addMessage = useChatStore((s) => s.addMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const conversation = useChatStore((s) => s.conversations[conversationId]);
  const clearUnreadCount = useChatStore((s) => s.clearUnreadCount);
  const [messageText, setMessageText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [mediaViewer, setMediaViewer] = useState<{ src: string; alt: string; isVideo: boolean } | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  // Display names for members who have since left/been removed — the
  // conversation's participant list only ever contains active members, so a
  // historical message from someone no longer in the group would otherwise
  // render as "Unknown". Resolved separately via member-history + batch
  // user lookup; see the effect below.
  const [formerMemberNames, setFormerMemberNames] = useState<Record<string, string>>({});

  // Stop any active speech when the screen unmounts or the user navigates away.
  // This prevents speech from looping or playing in the background.
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);
  // Track whether this screen is currently focused (visible to the user).
  // We only send read receipts when the screen is focused so that navigating
  // away does NOT incorrectly mark group messages as seen.
  const isFocusedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      if (!conversation) return;
      clearUnreadCount(conversationId);
      const msgs = useChatStore.getState().messages[conversationId] || [];
      const lastFromOther = [...msgs].reverse().find((m) => m.senderId !== user?.id);
      if (lastFromOther?.id) {
        sendSocketMessage("message.read", { messageId: lastFromOther.id, conversationId });
      }
      return () => {
        // Screen is losing focus — stop marking new arrivals as read
        isFocusedRef.current = false;
      };
    }, [conversationId, user?.id, conversation])
  );

  // When new messages arrive while this screen is already focused, mark them
  // read immediately. Without focus the effect is a no-op.
  useEffect(() => {
    if (!isFocusedRef.current || !conversation) return;
    const msgs = useChatStore.getState().messages[conversationId] || [];
    const lastFromOther = [...msgs].reverse().find((m) => m.senderId !== user?.id);
    if (lastFromOther?.id) {
      clearUnreadCount(conversationId);
      sendSocketMessage("message.read", { messageId: lastFromOther.id, conversationId });
    }
  }, [storeMessages.length]);

  // Auto-dismiss if group is deleted
  useEffect(() => {
    if (!isLoading && !conversation) {
      Alert.alert("Group Deleted", "This group is no longer available.");
      navigation.popToTop();
    }
  }, [conversation, isLoading, navigation]);

  // Admin rights for force-deleting others' messages
  const myRole = conversation?.participants?.find((p) => p.userId === user?.id)?.role;
  const hasAdminRights = subType === "CARE_CIRCLE"
    ? myRole === "OWNER" || myRole === "CAREGIVER"
    : myRole === "OWNER" || myRole === "ADMIN";
  // Super Admin / Admin at platform level — can delete ANY message for everyone
  const isSuperAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";

  const typingUserIds = useChatStore((s) => s.typing[conversationId]);
  const someoneTyping = (typingUserIds || []).some((id) => id !== user?.id);

  // Voice notes + image sharing.
  const media = useChatMedia(conversationId, user?.id);

  const openMediaViewer = useCallback((src: string, alt: string, isVideo: boolean) => {
    setMediaViewer({ src, alt, isVideo });
  }, []);
  const closeMediaViewer = useCallback(() => {
    setMediaViewer(null);
  }, []);

  const flatListRef = useRef<FlatList>(null);

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
    const showSub = Keyboard.addListener("keyboardDidShow", (e: any) => {
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


  // Build a userId → name map from conversation participants
  const memberNameMap = useCallback(() => {
    const map: Record<string, string> = {};
    if (conversation?.participants) {
      conversation.participants.forEach((p) => {
        map[p.userId] = formatUserDisplayName(p.user);
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

  // Assign stable colors based on member index — swap to the high-contrast
  // variants when that preference is on, so member names/avatars stay legible.
  const memberColorMap = useCallback(() => {
    const map: Record<string, string> = {};
    const palette = highContrast ? MEMBER_COLORS_HC : MEMBER_COLORS;
    if (conversation?.participants) {
      conversation.participants.forEach((p, i) => {
        map[p.userId] = palette[i % palette.length];
      });
    }
    return map;
  }, [conversation, highContrast]);

  const nameMap = { ...memberNameMap(), ...formerMemberNames };
  const colorMap = memberColorMap();

  // Resolve display names for former members (left/removed) so their
  // historical messages show "Name (Removed)" instead of "Unknown". Only
  // needs to look at userIds that show up in member-history but are no
  // longer in the active participant list.
  useEffect(() => {
    let active = true;
    const resolveFormerMembers = async () => {
      try {
        const history = await chatService.getConversationMemberHistory(conversationId);
        const currentIds = new Set((conversation?.participants || []).map((p) => p.userId));
        const formerEntries = history.filter((h) => h.leftAt && !currentIds.has(h.userId));
        if (formerEntries.length === 0) {
          if (active) setFormerMemberNames({});
          return;
        }
        const userMap = await chatService.batchLookupUsers(formerEntries.map((h) => h.userId));
        const map: Record<string, string> = {};
        formerEntries.forEach((h) => {
          const looked = userMap.get(h.userId);
          map[h.userId] = formatUserDisplayName({
            name: looked?.name || "Unknown",
            deletedAt: looked?.deletedAt ?? null,
            isSuspended: looked?.isSuspended ?? null,
            leftAt: h.leftAt,
            leftReason: h.leftReason,
          });
        });
        if (active) setFormerMemberNames(map);
      } catch (err) {
        // Non-critical — worst case a former member's historical messages
        // show "Unknown", same as before this feature existed.
        console.warn("Failed to resolve former member names", err);
      }
    };
    resolveFormerMembers();
    return () => {
      active = false;
    };
  }, [conversationId, conversation?.participants]);

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

        // Restore the "Reported" marker for messages this user already
        // reported in a previous session — the flag only lives client-side
        // otherwise, so it would vanish on reopening the chat without this.
        try {
          const reportedIds = await chatService.getMyReportedMessageIds(conversationId);
          reportedIds.forEach((id) => useChatStore.getState().markMessageReported(id));
        } catch {
          // Non-critical — worst case the marker is just missing until the
          // next successful fetch.
        }
      } catch (err: any) {
        // Don't fail silently — an error here used to render as an ordinary
        // empty conversation, which is indistinguishable from "no messages
        // yet". A 403 in particular means we aren't a member of this group.
        console.error("Failed to load group messages", err);
        const status = err?.response?.status;
        setConfirmState({
          title: status === 403 ? "You're not in this group" : "Couldn't load messages",
          message:
            status === 403
              ? "You are no longer a member of this group, so its messages can't be shown."
              : err?.response?.data?.message || "Something went wrong loading this conversation. Pull down or reopen the chat to try again.",
          icon: AlertCircle,
          confirmLabel: "OK",
          hideCancel: true,
          onConfirm: () => setConfirmState(null),
        });
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

    const metadataObj: any = {};
    if (replyingTo) {
      metadataObj.replyTo = {
        id: replyingTo.id,
        content: replyingTo.content,
        senderName: replyingTo.senderId === user.id ? "You" : (nameMap[replyingTo.senderId] || "Unknown")
      };
    }
    const metadata = Object.keys(metadataObj).length > 0 ? JSON.stringify(metadataObj) : undefined;

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
      metadata,
    };

    addMessage(newMsg);
    setMessageText("");
    emitTypingStop();

    setReplyingTo(null);

    // Send via WebSocket
    const sent = sendSocketMessage("message.send", {
      conversationId,
      content,
      type: "TEXT",
      clientMessageId,
      senderName: user.name,
      metadata,
    });
    if (!sent) {
      // Never leave the optimistic bubble looking delivered when nothing
      // left the device — the failed status drives the themed dialog below.
      useChatStore.getState().failMessage(clientMessageId, "You appear to be offline. The message wasn't sent.");
    }
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
      const sent = sendSocketMessage("message.send", {
        conversationId,
        content,
        type: "TEXT",
        clientMessageId,
        metadata: JSON.stringify({ sos: true }),
        senderName: user.name,
      });
      if (!sent) {
        // An SOS that silently goes nowhere is the worst possible failure
        // here — say so loudly rather than showing a delivered-looking alert.
        useChatStore.getState().failMessage(clientMessageId, "You appear to be offline. Your SOS was NOT sent — please call for help directly.");
      }
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

  // Surface a themed dialog the moment a message we sent gets rejected
  // (group suspended, blocked, moderation, ...) — failMessage() in the
  // store sets status:'failed' + failureReason, this just watches for it.
  // The acknowledged flag lives in the store (not a local ref) so it
  // survives leaving and re-entering this screen — a ref resets on every
  // remount and would otherwise re-show the dialog for the same message
  // each time you come back to the group.
  useEffect(() => {
    const latestFailed = [...storeMessages].reverse().find(
      (m) => m.status === "failed" && !m.failureAcknowledged
    );
    if (latestFailed) {
      useChatStore.getState().acknowledgeMessageFailure(latestFailed.clientMessageId);
      setConfirmState({
        title: "Message Not Sent",
        message: latestFailed.failureReason || "Your message could not be delivered.",
        confirmLabel: "OK",
        destructive: true,
        hideCancel: true,
        onConfirm: () => setConfirmState(null),
      });
    }
  }, [storeMessages]);

  // Reporting a specific message — captures messageId + sender so the admin
  // moderation queue gets full context, not just a bare user-level report.
  const [reportTarget, setReportTarget] = useState<ChatMessage | null>(null);
  const submitMessageReport = (reason: string, details?: string) => {
    if (!reportTarget) return;
    const finalReason = details ? `${reason} — ${details}` : reason;
    chatService
      .reportUser({
        reportedUserId: reportTarget.senderId,
        conversationId,
        messageId: reportTarget.id,
        reason: finalReason,
      })
      .then(() => {
        useChatStore.getState().markMessageReported(reportTarget.id);
        setConfirmState({
          title: "Report submitted",
          message: "Thank you. Our team will review this.",
          icon: CircleCheck,
          confirmLabel: "Done",
          hideCancel: true,
          onConfirm: () => {},
        });
      })
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
    // Super Admins can delete any message for everyone
    const canDeleteForEveryone = isMine || hasAdminRights || isSuperAdmin;
    const opts: ActionSheetOption[] = [];
    opts.push({ label: "Reply", icon: CornerUpLeft, onPress: () => setReplyingTo(item) });
    if (item.type === "TEXT" && item.content?.trim()) {
      if (speakingId === item.id) {
        opts.push({ label: "Stop reading aloud", icon: Volume2, onPress: () => {
          Speech.stop();
          setSpeakingId(null);
        }});
      } else {
        opts.push({ label: "Read aloud", icon: Volume2, onPress: () => {
          Speech.stop();
          setSpeakingId(item.id);
          Speech.speak(item.content, {
            language: "en-IN",
            onDone: () => setSpeakingId(null),
            onStopped: () => setSpeakingId(null),
            onError: () => setSpeakingId(null),
          });
        }});
      }
    }
    // Do NOT allow reporting messages sent by platform admins/super admins
    const senderIsAdmin = (
      item.senderId === "admin" ||
      item.senderId === "system" ||
      item.senderId === "digiability-admin" ||
      item.type === "SYSTEM"
    );
    let meta: any = null;
    try { meta = item.metadata ? (typeof item.metadata === "string" ? JSON.parse(item.metadata) : item.metadata) : null; } catch {}
    const senderIsPlatformAdmin = senderIsAdmin || meta?.isAdmin === true || meta?.senderName === "DigiAbility Admin";
    if (!isMine && !senderIsPlatformAdmin && !item.reportedByMe) {
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
    let meta: any = null;
    try {
      meta = item.metadata ? (typeof item.metadata === "string" ? JSON.parse(item.metadata) : item.metadata) : null;
    } catch {}

    const isMine = item.senderId === user?.id;
    const isAdmin =
      item.senderId === "admin" ||
      item.senderId === "system" ||
      item.senderId === "digiability-admin" ||
      item.type === "SYSTEM" ||
      meta?.isAdmin === true ||
      meta?.senderName === "DigiAbility Admin" ||
      item.content?.startsWith("📢 [");

    const senderName = isMine
      ? "You"
      : isAdmin
      ? (meta?.senderName || "DigiAbility Admin")
      : nameMap[item.senderId] || "Unknown";

    const senderColor = isMine
      ? colors.primary
      : isAdmin
      ? (highContrast ? "#000000" : "#7004DC")
      : colorMap[item.senderId] || colors.primary;

    const senderInitials = isAdmin ? "DA" : getInitials(senderName);

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

    // Date Separator logic
    const msgDateKey = item.createdAt ? istDateKey(new Date(item.createdAt)) : "";
    const prevMsgDateKey = prevMsg?.createdAt ? istDateKey(new Date(prevMsg.createdAt)) : "";
    const showDateSep = msgDateKey && (!prevMsg || msgDateKey !== prevMsgDateKey);

    return (
      <View>
        {showDateSep && (
          <View style={styles.dateSeparator}>
            <View style={[styles.dateLine, { backgroundColor: dateLineColor }]} />
            <AccessibleText
              variant="caption"
              style={[styles.dateText, { color: colors.primary, backgroundColor: colors.surface }, cardBorder]}
            >
              {formatDateLabel(msgDateKey)}
            </AccessibleText>
            <View style={[styles.dateLine, { backgroundColor: dateLineColor }]} />
          </View>
        )}
        <SwipeableMessageRow onReply={() => setReplyingTo(item)} colors={colors} isMine={isMine}>
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
                  <View style={[styles.msgAvatar, { backgroundColor: isAdmin ? (highContrast ? "#000" : "#EDE1FF") : senderColor + "20" }]}>
                    <AccessibleText variant="caption" style={[styles.msgAvatarText, { color: isAdmin ? (highContrast ? "#FFF" : "#7004DC") : senderColor, fontWeight: "700" }]}>
                      {senderInitials}
                    </AccessibleText>
                  </View>
                ) : null}
              </View>
            )}

            <View style={[styles.bubbleWrapper, isMine ? { alignItems: "flex-end" } : { alignItems: "flex-start" }]}>
              {/* Sender name */}
              {showSender && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3, marginLeft: 4 }}>
                  <AccessibleText variant="caption" style={[styles.senderName, { color: senderColor, fontWeight: isAdmin ? "800" : "600" }]}>
                    {senderName}
                  </AccessibleText>
                  {isAdmin && (
                    <View style={{ backgroundColor: "#7004DC", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                      <AccessibleText style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "800" }}>
                        ADMIN
                      </AccessibleText>
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                activeOpacity={0.8}
                onLongPress={() => handleMessageLongPress(item)}
                delayLongPress={300}
                accessibilityRole="button"
                accessibilityLabel={isMine ? "Your message" : `Message from ${senderName}`}
                accessibilityHint="Double tap and hold for message options"
                style={[
                  styles.messageBubble,
                  isMine ? styles.myBubble : styles.theirBubble,
                  isMine
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.card, shadowColor: colors.primary },
                  !isMine && cardBorder,
                  (item.type === "IMAGE" || item.type === "VIDEO") && styles.mediaBubble,
                ]}
              >
                {(() => {
                  const meta = item.metadata ? JSON.parse(item.metadata) : null;
                  if (meta?.replyTo) {
                    return (
                      <View style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: 8, borderRadius: 8, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: isMine ? '#fff' : colors.primary }}>
                        <AccessibleText variant="caption" style={{ color: isMine ? '#fff' : colors.primary, fontWeight: 'bold', marginBottom: 2 }}>
                          {meta.replyTo.senderName}
                        </AccessibleText>
                        <AccessibleText variant="caption" numberOfLines={1} style={{ color: isMine ? 'rgba(255,255,255,0.9)' : colors.text }}>
                          {meta.replyTo.content}
                        </AccessibleText>
                      </View>
                    );
                  }
                  return null;
                })()}
                {item.deletedAt ? (
                  <View style={styles.textBubbleContainer}>
                    <AccessibleText
                      variant="body"
                      style={[
                        styles.messageText,
                        { color: isMine ? "rgba(255,255,255,0.7)" : colors.subtext, fontStyle: "italic" },
                      ]}
                    >
                      This message was removed
                    </AccessibleText>
                    <View style={styles.messageFooter}>
                      <AccessibleText
                        variant="caption"
                        numberOfLines={1}
                        style={[
                          styles.messageTime,
                          { color: isMine ? "rgba(255,255,255,0.7)" : colors.subtext },
                        ]}
                      >
                        {timeString}
                      </AccessibleText>
                    </View>
                  </View>
                ) : (item.type === "IMAGE" || item.type === "VIDEO") ? (
                  <View style={styles.mediaBubbleInner}>
                    <MessageMedia message={item} isMine={isMine} onOpenViewer={openMediaViewer} onLongPress={() => handleMessageLongPress(item)} />
                    {/* With a caption the overlay would sit on top of the
                        last line of text — use normal flow underneath. */}
                    <View style={hasCaption(item) ? styles.mediaCaptionFooter : styles.mediaTimeOverlay}>
                      <AccessibleText
                        style={hasCaption(item)
                          ? [styles.messageTime, { color: isMine ? "rgba(255,255,255,0.7)" : colors.subtext }]
                          : styles.mediaTimeText}
                      >
                        {timeString}
                      </AccessibleText>
                      {!isMine && item.reportedByMe && (
                        <View style={styles.reportedBadge}>
                          <Flag size={10} color="#D97706" />
                          <AccessibleText style={styles.reportedBadgeText}>Reported</AccessibleText>
                        </View>
                      )}
                      {isMine && (
                        <View style={{ marginLeft: 2 }}>
                          {item.status === "sending" ? (
                            <AccessibleText style={{ color: hasCaption(item) ? colors.subtext : "rgba(255,255,255,0.8)", fontSize: 10 }}>...</AccessibleText>
                          ) : item.status === "read" ? (
                            <CheckCheck size={12} color="#38bdf8" />
                          ) : item.status === "delivered" ? (
                            <CheckCheck size={12} color={hasCaption(item) ? colors.subtext : "rgba(255,255,255,0.9)"} />
                          ) : item.status === "failed" ? (
                            <AlertCircle size={12} color="#EF4444" />
                          ) : (
                            <Check size={12} color={hasCaption(item) ? colors.subtext : "rgba(255,255,255,0.9)"} />
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                ) : item.type === "AUDIO" ? (
                  <View>
                    <MessageMedia message={item} isMine={isMine} onOpenViewer={openMediaViewer} onLongPress={() => handleMessageLongPress(item)} />
                    <View style={styles.messageFooter}>
                      <AccessibleText variant="caption" style={[styles.messageTime, { color: isMine ? "rgba(255,255,255,0.6)" : colors.subtext }]}>
                        {timeString}
                      </AccessibleText>
                      {!isMine && item.reportedByMe && (
                        <View style={styles.reportedBadge}>
                          <Flag size={10} color="#D97706" />
                          <AccessibleText style={styles.reportedBadgeText}>Reported</AccessibleText>
                        </View>
                      )}
                      {isMine && (
                        <View style={{ marginLeft: 2 }}>
                          {item.status === "sending" ? (
                            <AccessibleText variant="caption" style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>...</AccessibleText>
                          ) : item.status === "read" ? (
                            <CheckCheck size={13} color="#38bdf8" />
                          ) : item.status === "delivered" ? (
                            <CheckCheck size={13} color="rgba(255,255,255,0.8)" />
                          ) : item.status === "failed" ? (
                            <AlertCircle size={13} color="#EF4444" />
                          ) : (
                            <Check size={13} color="rgba(255,255,255,0.8)" />
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={styles.textBubbleContainer}>
                    <LinkifiedText
                      variant="body"
                      text={item.content}
                      style={[
                        styles.messageText,
                        { color: isMine ? colors.white : colors.text },
                      ]}
                      linkStyle={{ color: isMine ? "rgba(255,255,255,0.9)" : colors.primary }}
                    />
                    <View style={styles.messageFooter}>
                      <AccessibleText
                        variant="caption"
                        numberOfLines={1}
                        style={[
                          styles.messageTime,
                          { color: isMine ? "rgba(255,255,255,0.7)" : colors.subtext },
                        ]}
                      >
                        {timeString}
                      </AccessibleText>
                      {!isMine && item.reportedByMe && (
                        <View style={styles.reportedBadge}>
                          <Flag size={10} color="#D97706" />
                          <AccessibleText style={styles.reportedBadgeText}>Reported</AccessibleText>
                        </View>
                      )}
                      {isMine && (
                        <View style={{ marginLeft: 2 }}>
                          {item.status === "sending" ? (
                            <AccessibleText variant="caption" style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>...</AccessibleText>
                          ) : item.status === "read" ? (
                            <CheckCheck size={13} color="#38bdf8" />
                          ) : item.status === "delivered" ? (
                            <CheckCheck size={13} color="rgba(255,255,255,0.85)" />
                          ) : item.status === "failed" ? (
                            <AlertCircle size={13} color="#EF4444" />
                          ) : (
                            <Check size={13} color="rgba(255,255,255,0.85)" />
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SwipeableMessageRow>
      </View>
    );
  };

  // ── Theme-derived, high-contrast-aware colors ───────────────
  // Standard card outline so white cards/bubbles stay visible against a
  // (also white, under high contrast) screen background.
  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };
  
  const dateLineColor = highContrast ? "rgba(0,0,0,0.3)" : "rgba(138,56,245,0.15)";
  const typingDotColor = highContrast ? "#000000" : "#C4B5FD";

  if (isLoading) {
    return (
      <ScreenWrapper>
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
          <View style={styles.headerCenter}>
            <View style={styles.groupIconContainer}>
              <View style={styles.groupIcon}>
                {subType === 'CARE_CIRCLE'
                  ? <Accessibility size={22} color={colors.white} strokeWidth={2} />
                  : <Users size={22} color={colors.white} strokeWidth={2} />}
              </View>
            </View>
            <View style={styles.headerInfo}>
              <AccessibleText variant="title" style={[styles.headerName, { color: colors.white }]} numberOfLines={1}>{groupName}</AccessibleText>
              <AccessibleText variant="caption" style={[styles.headerMembers, { color: "rgba(255,255,255,0.65)" }]}>Loading...</AccessibleText>
            </View>
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper withBottomSafeArea={false}>
      {/* ── Header — paddingTop clears the translucent status bar via safe-area insets */}
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

        <TouchableOpacity
          style={styles.headerCenter}
          onPress={() => navigation.navigate("GroupInfo", { conversationId })}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${groupName}, group info`}
          accessibilityHint="Opens group members and settings"
        >
          <View style={styles.groupIconContainer}>
            <View style={styles.groupIcon}>
              {subType === 'CARE_CIRCLE'
                ? <Accessibility size={22} color={colors.white} strokeWidth={2} />
                : <Users size={22} color={colors.white} strokeWidth={2} />}
            </View>
          </View>

          <View style={styles.headerInfo}>
            <AccessibleText variant="title" style={[styles.headerName, { color: colors.white }]} numberOfLines={1}>
              {groupName}
            </AccessibleText>
            <AccessibleText variant="caption" style={[styles.headerMembers, { color: "rgba(255,255,255,0.65)" }]}>
              {conversation?.participants?.length || 0} members
            </AccessibleText>
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          {subType === 'CARE_CIRCLE' && (
            <TouchableOpacity
              style={[styles.sosBtn, { backgroundColor: colors.error }]}
              onPress={handleSOS}
              accessibilityRole="button"
              accessibilityLabel="Send emergency SOS to this care circle"
            >
              <AccessibleText variant="caption" style={[styles.sosBtnText, { color: colors.white }]}>SOS</AccessibleText>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => navigation.navigate("GroupInfo", { conversationId })}
            accessibilityRole="button"
            accessibilityLabel="Group settings"
            accessibilityHint="Opens group info and settings"
          >
            <Settings size={20} color={colors.white} strokeWidth={2} />
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
                  <View style={styles.emptyIcon}>{subType === 'CARE_CIRCLE' ? <Heart size={48} color={colors.primary} strokeWidth={1.75} /> : <HeartHandshake size={48} color={colors.primary} strokeWidth={1.75} />}</View>
                  <AccessibleText variant="title" style={[styles.emptyTitle, { color: colors.secondary }]}>Welcome to {groupName}!</AccessibleText>
                  <AccessibleText variant="body" style={[styles.emptySubtitle, { color: colors.subtext }]}>
                    Send the first message to start the conversation
                  </AccessibleText>
                </View>
              }
            />

            {/* ── Composer ───────────────────────────────────── */}
            {media.isRecording && (
              <View style={[styles.recordingBar, { backgroundColor: colors.card }, cardBorder]}>
                <AccessibleText variant="body" style={[styles.recordingText, { color: colors.error }]}>● Recording… tap ⏹ to send</AccessibleText>
                <TouchableOpacity
                  onPress={media.cancelRecording}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel recording"
                >
                  <AccessibleText variant="body" style={[styles.recordingCancel, { color: colors.subtext }]}>Cancel</AccessibleText>
                </TouchableOpacity>
            </View>
          )}
          {replyingTo && (
            <View style={{ marginHorizontal: 12, marginBottom: 8, backgroundColor: colors.surface, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: colors.primary }}>
              <View style={{ flex: 1 }}>
                <AccessibleText variant="caption" style={{ color: colors.primary, fontWeight: 'bold', marginBottom: 4 }}>
                  Replying to {replyingTo.senderId === user?.id ? "Yourself" : (nameMap[replyingTo.senderId] || "Unknown")}
                </AccessibleText>
                <AccessibleText variant="caption" numberOfLines={1} style={{ color: colors.subtext }}>
                  {replyingTo.content}
                </AccessibleText>
              </View>
              <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ padding: 4 }}>
                <X size={20} color={colors.subtext} />
              </TouchableOpacity>
            </View>
          )}
          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <View style={[styles.composerCard, { backgroundColor: colors.card, shadowColor: colors.secondary }, cardBorder]}>
                <TouchableOpacity
                  style={styles.plusBtn}
                  onPress={media.pickMedia}
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
                    placeholder="Message the group..."
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
              data={listData}
              inverted
              keyExtractor={(item, index) => item.id ? `${item.id}-${index}` : `msg-${index}`}
              renderItem={renderMessage}
              contentContainerStyle={[styles.messageList, { paddingBottom: 10 }]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>{subType === 'CARE_CIRCLE' ? <Heart size={48} color={colors.primary} strokeWidth={1.75} /> : <HeartHandshake size={48} color={colors.primary} strokeWidth={1.75} />}</View>
                  <AccessibleText variant="title" style={[styles.emptyTitle, { color: colors.secondary }]}>Welcome to {groupName}!</AccessibleText>
                  <AccessibleText variant="body" style={[styles.emptySubtitle, { color: colors.subtext }]}>
                    Send the first message to start the conversation
                  </AccessibleText>
                </View>
              }
            />

            {/* ── Composer ───────────────────────────────────── */}
            {media.isRecording && (
              <View style={[styles.recordingBar, { backgroundColor: colors.card }, cardBorder]}>
                <AccessibleText variant="body" style={[styles.recordingText, { color: colors.error }]}>● Recording… tap ⏹ to send</AccessibleText>
                <TouchableOpacity
                  onPress={media.cancelRecording}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel recording"
                >
                  <AccessibleText variant="body" style={[styles.recordingCancel, { color: colors.subtext }]}>Cancel</AccessibleText>
                </TouchableOpacity>
              </View>
            )}
            {replyingTo && (
              <View style={{ marginHorizontal: 12, marginBottom: 8, backgroundColor: colors.surface, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: colors.primary }}>
                <View style={{ flex: 1 }}>
                  <AccessibleText variant="caption" style={{ color: colors.primary, fontWeight: 'bold', marginBottom: 4 }}>
                    Replying to {replyingTo.senderId === user?.id ? "Yourself" : (nameMap[replyingTo.senderId] || "Unknown")}
                  </AccessibleText>
                  <AccessibleText variant="caption" numberOfLines={1} style={{ color: colors.subtext }}>
                    {replyingTo.content}
                  </AccessibleText>
                </View>
                <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ padding: 4 }}>
                  <X size={20} color={colors.subtext} />
                </TouchableOpacity>
              </View>
            )}
            {conversation?.sendMessages === "ADMINS_ONLY" && !hasAdminRights ? (
              <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
                <View style={[styles.suspendedComposerCard, { backgroundColor: colors.surface }, cardBorder]}>
                  <AccessibleText variant="caption" style={[styles.suspendedComposerText, { color: colors.subtext }]}>
                    Only admins can send messages in this {subType === "CARE_CIRCLE" ? "care circle" : "group"}.
                  </AccessibleText>
                </View>
              </View>
            ) : (
              <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
                <View style={[styles.composerCard, { backgroundColor: colors.card, shadowColor: colors.secondary }, cardBorder]}>
                  <TouchableOpacity
                    style={styles.plusBtn}
                    onPress={media.pickMedia}
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
                      placeholder="Message the group..."
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
            )}
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

      {/* Report reason picker with description & custom category */}
      <ReportModal
        visible={!!reportTarget}
        title="Report reason"
        subtitle="Why are you reporting this message?"
        onClose={() => setReportTarget(null)}
        onSubmit={submitMessageReport}
      />
      {/* Full-screen Media Viewer */}
      {mediaViewer && (
        <MediaViewer
          visible={!!mediaViewer}
          src={mediaViewer.src}
          alt={mediaViewer.alt}
          isVideo={mediaViewer.isVideo}
          onClose={closeMediaViewer}
        />
      )}
    </ScreenWrapper>
  );
};

const SwipeableMessageRow = React.memo(({ children, onReply, colors, isMine }: any) => {
  const swipeableRef = useRef<Swipeable>(null);

  const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({
      inputRange: [0, 50],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
    return (
      <View style={{ justifyContent: 'center', alignItems: 'center', width: 50 }}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <CornerUpLeft color={colors.primary} size={22} />
        </Animated.View>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      containerStyle={{ width: "100%" }}
      childrenContainerStyle={{
        width: "100%",
        flexDirection: "row",
        justifyContent: isMine ? "flex-end" : "flex-start",
        alignItems: "flex-end",
      }}
      onSwipeableOpen={() => {
        onReply();
        swipeableRef.current?.close();
      }}
      friction={2}
      leftThreshold={35}
    >
      {children}
    </Swipeable>
  );
});

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
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  groupIconContainer: {
    marginRight: 10,
  },
  groupIcon: {
    width: 40,
    height: 40,
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
    fontSize: 16,
    fontWeight: "700",
  },
  headerMembers: {
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

  // ── Messages ────────────────────────────────────────────
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 8,
  },

  // Message row
  messageRow: {
    flexDirection: "row",
    marginBottom: 6,
    width: "100%",
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
    maxWidth: "80%",
    minWidth: 80,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "700",
  },
  // Base bubble style
  messageBubble: {
    paddingHorizontal: 12,
    paddingTop: 7,
    paddingBottom: 6,
    borderRadius: 16,
    minWidth: 80,
  },
  // No padding for image/video bubbles
  mediaBubble: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    overflow: "hidden",
    minWidth: 0,
  },
  mediaBubbleInner: {
    position: "relative",
  },
  // Time overlaid at bottom-right of image
  // Timestamp row used when a media message has a caption — normal flow
  // under the text instead of an absolute pill overlapping it.
  mediaCaptionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  mediaTimeOverlay: {
    position: "absolute",
    bottom: 6,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  mediaTimeText: {
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    color: "#FFFFFF",
  },
  myBubble: {
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    borderBottomLeftRadius: 4,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  textBubbleContainer: {
    flexDirection: "column",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    flexShrink: 1,
  },
  // Inline time row — sits nicely to the right or below
  inlineTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginLeft: "auto",
    paddingLeft: 4,
    paddingBottom: 1,
    gap: 2,
    flexShrink: 0,
  },
  // Time row used for audio messages
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 5,
    gap: 3,
  },
  messageTime: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  reportedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  reportedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#D97706",
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
    lineHeight: 60,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  // ── Composer ────────────────────────────────────────────
  sosBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  sosBtnText: {
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
  suspendedComposerCard: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  suspendedComposerText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
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
