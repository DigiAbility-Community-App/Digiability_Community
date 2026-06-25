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
import { generateUUID } from "../../utils/uuid";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Send, ArrowLeft, MoreVertical, Paperclip, Mic, Image as ImageIcon, Smile, Check, CheckCheck } from "lucide-react-native";

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

const ChatScreen = ({ navigation, route }: Props) => {
  const { conversationId, recipientName, recipientAvatar, isOnline } = route.params;
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const storeMessages = useChatStore((s) => s.messages[conversationId] || []);
  const setMessages = useChatStore((s) => s.setMessages);
  const addMessage = useChatStore((s) => s.addMessage);
  
  const [messageText, setMessageText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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

  const handleSend = useCallback(() => {
    if (!messageText.trim() || !user) return;

    const content = messageText.trim();
    const clientMessageId = generateUUID();
    
    // 1. Optimistic update
    const newMsg: ChatMessage = {
      id: clientMessageId, // temporary
      clientMessageId,
      conversationId,
      senderId: user.id,
      content,
      type: "TEXT",
      status: "sent",
      createdAt: new Date().toISOString()
    };
    
    addMessage(newMsg);
    setMessageText("");

    // 2. Send via WS
    sendSocketMessage("message.send", {
      conversationId,
      content,
      type: "TEXT",
      clientMessageId
    });
  }, [messageText, conversationId, user]);

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
        <View
          style={[
            styles.messageBubble,
            isMine ? styles.myBubble : styles.theirBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMine ? styles.myMessageText : styles.theirMessageText,
            ]}
          >
            {item.content}
          </Text>
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
        </View>
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
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerProfile}>
          <View style={styles.headerAvatarContainer}>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarEmoji}>
                {recipientAvatar || "👤"}
              </Text>
            </View>
            {isOnline && <View style={styles.headerOnlineDot} />}
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>
              {recipientName}
            </Text>
            <Text style={styles.headerStatus}>
              {isOnline ? "Online" : "Last seen 2h ago"}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionBtn}>
            <Text style={styles.headerActionIcon}>📞</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionBtn}>
            <Text style={styles.headerActionIcon}>⋮</Text>
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
                isTyping ? (
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
            <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              <TouchableOpacity style={styles.attachBtn}>
                <Text style={styles.attachIcon}>+</Text>
              </TouchableOpacity>
              
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Type a message..."
                  placeholderTextColor="#999"
                  value={messageText}
                  onChangeText={setMessageText}
                  multiline
                  maxLength={5000}
                />
                <TouchableOpacity style={styles.emojiBtn}>
                  <Text style={styles.emojiIcon}>😊</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  messageText.trim() ? styles.sendBtnActive : {},
                ]}
                onPress={handleSend}
                disabled={!messageText.trim()}
              >
                <Text style={styles.sendIcon}>
                  {messageText.trim() ? "➤" : "🎤"}
                </Text>
              </TouchableOpacity>
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
                isTyping ? (
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
            <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
              <TouchableOpacity style={styles.attachBtn}>
                <Text style={styles.attachIcon}>+</Text>
              </TouchableOpacity>
              
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Type a message..."
                  placeholderTextColor="#999"
                  value={messageText}
                  onChangeText={setMessageText}
                  multiline
                  maxLength={5000}
                />
                <TouchableOpacity style={styles.emojiBtn}>
                  <Text style={styles.emojiIcon}>😊</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  messageText.trim() ? styles.sendBtnActive : {},
                ]}
                onPress={handleSend}
                disabled={!messageText.trim()}
              >
                <Text style={styles.sendIcon}>
                  {messageText.trim() ? "➤" : "🎤"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
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
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#f0ecf5",
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#F3EAFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  attachIcon: {
    fontSize: 22,
    color: "#8A38F5",
    fontWeight: "700",
  },
  inputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#f4f3fa",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 44,
    maxHeight: 120,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: "#1a1a1a",
    paddingVertical: 0,
    maxHeight: 100,
  },
  emojiBtn: {
    paddingLeft: 8,
    paddingBottom: 2,
  },
  emojiIcon: {
    fontSize: 20,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#E8E5F0",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendBtnActive: {
    backgroundColor: "#8A38F5",
  },
  sendIcon: {
    fontSize: 18,
    color: "#fff",
  },
});
