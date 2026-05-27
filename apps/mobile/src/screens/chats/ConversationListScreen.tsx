import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { ChatsStackParamList } from "@navigation/ChatsStack";
import { useAuthStore } from "@store/authStore";
import { useChatStore } from "@store/chatStore";
import { chatService } from "@services/chatService";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import AppFooter from "../../components/layout/AppFooter";

// ─────────────────────────────────────────────────────────
// Conversation List Screen
//
// The primary chat inbox showing all DMs and group chats
// sorted by most recent activity. Matches the auth/home
// purple palette (#500088 / #8A38F5).
//
// Uses demo data for the demo build. In production this
// would pull from the chatStore + REST API.
// ─────────────────────────────────────────────────────────

type Props = {
  navigation?: any;
  isTab?: boolean;
};

// ── Demo Data ──────────────────────────────────────────────

// Interface definitions
interface User {
  id: string;
  name: string;
}

interface Conversation {
  id: string;
  type: "DIRECT" | "GROUP";
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  isOnline: boolean;
  memberCount?: number;
}

const ConversationListScreen = ({ navigation: propNavigation, isTab = false }: Props) => {
  const localNavigation = useNavigation<any>();
  const navigation = propNavigation || localNavigation;
  const user = useAuthStore((s) => s.user);
  const storeConversations = useChatStore((s) => Object.values(s.conversations));
  const setConversations = useChatStore((s) => s.setConversations);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"All" | "Direct" | "Groups">("All");
  const [isLoading, setIsLoading] = useState(true);

  // Map real data to UI props
  const uiConversations: Conversation[] = storeConversations.map(c => {
    // For direct chat, find the other participant
    let displayName = c.name || "Unknown";
    if (c.type === "DIRECT" && c.participants) {
      const other = c.participants.find(p => p.userId !== user?.id)?.user;
      if (other) displayName = other.name;
    }

    return {
      id: c.id,
      type: c.type,
      name: displayName,
      avatar: c.type === "GROUP" ? "🦽" : "👤",
      lastMessage: c.lastMessage?.content || "No messages yet",
      time: c.updatedAt ? new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "",
      unread: c.unreadCount || 0,
      isOnline: false, // Wire to presence store later
      memberCount: c.participants?.length,
    };
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await chatService.getConversations();
        setConversations(data);
      } catch (err) {
        console.error("Failed to fetch conversations", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const filteredConversations = uiConversations.filter((conv) => {
    const matchesSearch = conv.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesFilter =
      activeFilter === "All" ||
      (activeFilter === "Direct" && conv.type === "DIRECT") ||
      (activeFilter === "Groups" && conv.type === "GROUP");
    return matchesSearch && matchesFilter;
  });

  const totalUnread = uiConversations.reduce((sum, c) => sum + c.unread, 0);

  const handleConversationPress = useCallback(
    (conv: Conversation) => {
      if (isTab) {
        if (conv.type === "DIRECT") {
          navigation.navigate("Chats", {
            screen: "Chat",
            params: {
              conversationId: conv.id,
              recipientName: conv.name,
              recipientAvatar: conv.avatar,
              isOnline: conv.isOnline,
            },
          });
        } else {
          navigation.navigate("Chats", {
            screen: "GroupChat",
            params: {
              conversationId: conv.id,
              groupName: conv.name,
              memberCount: conv.memberCount ?? 0,
            },
          });
        }
      } else {
        if (conv.type === "DIRECT") {
          navigation.navigate("Chat", {
            conversationId: conv.id,
            recipientName: conv.name,
            recipientAvatar: conv.avatar,
            isOnline: conv.isOnline,
          });
        } else {
          navigation.navigate("GroupChat", {
            conversationId: conv.id,
            groupName: conv.name,
            memberCount: conv.memberCount ?? 0,
          });
        }
      }
    },
    [navigation, isTab]
  );

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => handleConversationPress(item)}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View
          style={[
            styles.avatar,
            item.type === "GROUP" && styles.groupAvatar,
          ]}
        >
          <Text style={styles.avatarEmoji}>{item.avatar}</Text>
        </View>
        {item.isOnline && item.type === "DIRECT" && (
          <View style={styles.onlineDot} />
        )}
      </View>

      {/* Content */}
      <View style={styles.conversationContent}>
        <View style={styles.conversationTop}>
          <Text style={styles.conversationName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text
            style={[
              styles.conversationTime,
              item.unread > 0 && styles.conversationTimeActive,
            ]}
          >
            {item.time}
          </Text>
        </View>
        <View style={styles.conversationBottom}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage}
          </Text>
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {item.unread > 99 ? "99+" : item.unread}
              </Text>
            </View>
          )}
        </View>
        {item.type === "GROUP" && (
          <Text style={styles.memberCount}>
            {item.memberCount} members
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderBody = () => (
    <View style={[styles.container, isTab && { backgroundColor: "#FAF8FF" }]}>
      {/* ── Content Container (Search Bar moved into body flow for safe spacing) ── */}
      <View style={[
        styles.headerBodyFlow,
        isTab 
          ? { backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#EEEDF4", paddingTop: 14 } 
          : { backgroundColor: "#8A38F5" }
      ]}>
        {totalUnread > 0 && (
          <Text style={[
            styles.headerSubtitleBody,
            isTab ? { color: "#500088", marginBottom: 8 } : { color: "rgba(255,255,255,0.85)" }
          ]}>
            {totalUnread} unread message{totalUnread !== 1 ? "s" : ""}
          </Text>
        )}
        <View style={[
          styles.searchContainer,
          isTab ? { backgroundColor: "#F4F3FA" } : { backgroundColor: "rgba(255,255,255,0.15)" }
        ]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[
              styles.searchInput,
              isTab ? { color: "#1A1B20" } : { color: "#fff" }
            ]}
            placeholder="Search conversations..."
            placeholderTextColor={isTab ? "#9CA3AF" : "rgba(255,255,255,0.6)"}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Text style={isTab ? { color: "#6B7280", fontSize: 16 } : styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Filter Tabs ──────────────────────────────────── */}
      <View style={[styles.filterContainer, isTab && { backgroundColor: "#FAF8FF" }]}>
        {(["All", "Direct", "Groups"] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterTab,
              activeFilter === filter && styles.filterTabActive,
              isTab && activeFilter !== filter && { backgroundColor: "#FFFFFF", borderColor: "#EEEDF4" }
            ]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === filter && styles.filterTextActive,
                isTab && activeFilter !== filter && { color: "#4C4452" }
              ]}
            >
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Conversation List ────────────────────────────── */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversation}
        contentContainerStyle={[styles.listContent, isTab && { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyTitle}>No conversations</Text>
            <Text style={styles.emptySubtitle}>
              Start chatting with your care circle
            </Text>
          </View>
        }
      />

      {/* ── FAB — Create Care Circle ─────────────────── */}
      <TouchableOpacity
        style={[styles.fab, isTab ? { bottom: 85 } : { bottom: 90 }]}
        onPress={() => {
          if (isTab) {
            navigation.navigate("Chats", { screen: "CreateGroup" });
          } else {
            navigation.navigate("CreateGroup");
          }
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>👥</Text>
        <Text style={styles.fabLabel}>New Circle</Text>
      </TouchableOpacity>
    </View>
  );

  if (isTab) {
    return renderBody();
  }

  return (
    <ScreenWrapper>
      <AppHeader
        title="Messages"
        rightActions={
          <TouchableOpacity
            style={styles.newChatTouch}
            onPress={() => {
              if (isTab) {
                navigation.navigate("Chats", { screen: "CreateGroup" });
              } else {
                navigation.navigate("CreateGroup");
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="New Care Circle Group"
            accessibilityHint="Navigates to group creation page"
            activeOpacity={0.7}
          >
            <Text style={styles.newChatIcon}>✏️</Text>
          </TouchableOpacity>
        }
      />
      {renderBody()}
      <AppFooter activeTab="Community" />
    </ScreenWrapper>
  );
};

export default ConversationListScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F6F6",
  },

  headerSubtitleBody: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 10,
    fontWeight: "600",
  },
  newChatTouch: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  newChatIcon: {
    fontSize: 20,
  },
  headerBodyFlow: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },

  // ── Search ──────────────────────────────────────────────
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#fff",
  },
  clearSearch: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 16,
    paddingLeft: 8,
  },

  // ── Filters ─────────────────────────────────────────────
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E8E5F0",
  },
  filterTabActive: {
    backgroundColor: "#8A38F5",
    borderColor: "#8A38F5",
  },
  filterText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },
  filterTextActive: {
    color: "#fff",
  },

  // ── List ────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 160,
  },

  // ── Conversation Item ───────────────────────────────────
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: "#8A38F5",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },

  // ── Avatar ──────────────────────────────────────────────
  avatarContainer: {
    position: "relative",
    marginRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "#F3EAFF",
    justifyContent: "center",
    alignItems: "center",
  },
  groupAvatar: {
    backgroundColor: "#EDE9FE",
    borderRadius: 16,
  },
  avatarEmoji: {
    fontSize: 24,
  },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22C55E",
    borderWidth: 2.5,
    borderColor: "#fff",
  },

  // ── Content ─────────────────────────────────────────────
  conversationContent: {
    flex: 1,
  },
  conversationTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
    flex: 1,
    marginRight: 8,
  },
  conversationTime: {
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
  },
  conversationTimeActive: {
    color: "#8A38F5",
    fontWeight: "700",
  },
  conversationBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastMessage: {
    fontSize: 13,
    color: "#888",
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: "#8A38F5",
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  unreadText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  memberCount: {
    fontSize: 11,
    color: "#aaa",
    marginTop: 2,
  },

  // ── Empty State ─────────────────────────────────────────
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#888",
  },

  // ── FAB ─────────────────────────────────────────────────
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#500088",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 28,
    shadowColor: "#500088",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  fabLabel: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
