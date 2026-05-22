import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { ChatsStackParamList } from "@navigation/ChatsStack";
import { useAuthStore } from "@store/authStore";
import { useChatStore, ChatMessage } from "@store/chatStore";
import { chatService } from "@services/chatService";
import { sendSocketMessage } from "@services/socketService";

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
  const { conversationId, groupName, memberCount } = route.params;
  const user = useAuthStore((s) => s.user);
  const storeMessages = useChatStore((s) => s.messages[conversationId] || []);
  const setMessages = useChatStore((s) => s.setMessages);
  const addMessage = useChatStore((s) => s.addMessage);
  const conversation = useChatStore((s) => s.conversations[conversationId]);

  const [messageText, setMessageText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
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

  // Load message history on mount
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const data = await chatService.getMessages(conversationId);
        setMessages(conversationId, data);
      } catch (err) {
        console.error("Failed to load group messages", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadMessages();
  }, [conversationId]);

  const handleSend = useCallback(() => {
    if (!messageText.trim() || !user) return;

    const content = messageText.trim();
    const clientMessageId = `gm_${Date.now()}_${Math.random().toString(36).substring(7)}`;

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

    // Send via WebSocket
    sendSocketMessage("message.send", {
      conversationId,
      content,
      type: "TEXT",
      clientMessageId,
    });
  }, [messageText, conversationId, user]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isMine = item.senderId === user?.id;
    const senderName = isMine ? "You" : (nameMap[item.senderId] || "Unknown");
    const senderColor = colorMap[item.senderId] || "#8A38F5";

    const prevMsg = index > 0 ? storeMessages[index - 1] : null;
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

          <View
            style={[
              styles.messageBubble,
              isMine ? styles.myBubble : styles.theirBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isMine && styles.myMessageText,
              ]}
            >
              {item.content}
            </Text>
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
                <Text style={styles.statusIcon}>
                  {item.status === "read" ? "✓✓" : item.status === "delivered" ? "✓✓" : "✓"}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.groupIconContainer}>
              <View style={styles.groupIcon}>
                <Text style={styles.groupIconEmoji}>🤝</Text>
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ───────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.groupIconContainer}>
            <View style={styles.groupIcon}>
              <Text style={styles.groupIconEmoji}>🤝</Text>
            </View>
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>
              {groupName}
            </Text>
            <Text style={styles.headerMembers}>
              {conversation?.participants?.length || memberCount} members
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionBtn}>
            <Text style={styles.headerActionIcon}>👥</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionBtn}>
            <Text style={styles.headerActionIcon}>⋮</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Messages ─────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={storeMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🤝</Text>
              <Text style={styles.emptyTitle}>Welcome to {groupName}!</Text>
              <Text style={styles.emptySubtitle}>
                Send the first message to start the conversation
              </Text>
            </View>
          }
        />

        {/* ── Composer ───────────────────────────────────── */}
        <View style={styles.composer}>
          <TouchableOpacity style={styles.attachBtn}>
            <Text style={styles.attachIcon}>+</Text>
          </TouchableOpacity>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Message the group..."
              placeholderTextColor="#999"
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={5000}
            />
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
    </SafeAreaView>
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
    paddingVertical: 12,
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
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    color: "#500088",
    fontWeight: "700",
  },
  inputContainer: {
    flex: 1,
    backgroundColor: "#f4f3fa",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 44,
    maxHeight: 120,
  },
  textInput: {
    fontSize: 15,
    color: "#1a1a1a",
    paddingVertical: 0,
    maxHeight: 100,
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
    backgroundColor: "#500088",
  },
  sendIcon: {
    fontSize: 18,
    color: "#fff",
  },
});
