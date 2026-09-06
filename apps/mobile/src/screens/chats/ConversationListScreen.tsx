import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  ActionSheetIOS,
  Platform,
  Alert,
  Keyboard,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { ChatsStackParamList } from "@navigation/ChatsStack";
import { useAuthStore } from "@store/authStore";
import { useChatStore } from "@store/chatStore";
import { chatService } from "@services/chatService";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import AppFooter from "../../components/layout/AppFooter";
import { Mail, SquarePen, Search, Users, Accessibility, User, Bot, X, MessageCircle } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import { formatUserDisplayName } from "../../utils/formatUserName";

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
  /** When true, hides filter pills and shows only DIRECT (1:1) conversations */
  directOnly?: boolean;
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
  subType?: "GENERAL" | "CARE_CIRCLE" | null;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  isOnline: boolean;
  memberCount?: number;
}

const ConversationListScreen = ({ navigation: propNavigation, isTab = false, directOnly = false }: Props) => {
  const localNavigation = useNavigation<any>();
  const navigation = propNavigation || localNavigation;
  const { colors, highContrast } = useTheme();
  const user = useAuthStore((s) => s.user);
  const storeConversations = useChatStore((s) => {
    const seen = new Set<string>();
    return Object.values(s.conversations).filter((c) => {
      if (!c.id || seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  });
  const setConversations = useChatStore((s) => s.setConversations);
  const pendingInvites = useChatStore((s) => s.pendingInvites);
  const setPendingInvites = useChatStore((s) => s.setPendingInvites);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"All" | "Direct" | "Groups" | "Care Circles">("All");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Most-recent-activity first. New/updated conversations bubble to the top.
  const sortedConversations = [...storeConversations].sort((a, b) => {
    const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return tb - ta;
  });

  // Map real data to UI props
  const uiConversations: Conversation[] = sortedConversations.map(c => {
    // For direct chat, find the other participant
    let displayName = c.name || "Unknown";
    if (c.type === "DIRECT" && c.participants) {
      const other = c.participants.find(p => p.userId !== user?.id)?.user;
      if (other) displayName = formatUserDisplayName(other);
    }

      let lastMsgText = c.lastMessageText || "No messages yet";
      if (c.type === "GROUP" && c.lastMessage?.senderId && c.lastMessage.senderId !== user?.id) {
        const sender = c.participants?.find((p: any) => p.userId === c.lastMessage!.senderId)?.user;
        if (sender) {
          lastMsgText = `${formatUserDisplayName(sender)}: ${lastMsgText}`;
        }
      }

    return {
      id: c.id,
      type: c.type,
      subType: c.subType,
      name: displayName,
      // Left blank for regular DMs so the chat header renders the themed User
      // icon fallback; DigiBot keeps its robot mark.
      avatar: c.type === "GROUP"
        ? ""
        : (displayName === "DigiBot" ? "🤖" : ""),
      lastMessage: lastMsgText,
      time: c.updatedAt ? new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "",
      unread: c.unreadCount || 0,
      isOnline: false, // Wire to presence store later
      memberCount: c.participants?.length,
    };
  });

  // Refetch every time the list regains focus (e.g. returning from a chat or
  // from NewChat) so newly started/updated conversations always show up.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const loadData = async () => {
        try {
          const [convData, invitesData] = await Promise.all([
            chatService.getConversations(),
            chatService.getPendingInvites()
          ]);
          if (!active) return;
          setConversations(convData);
          setPendingInvites(invitesData);
        } catch (err) {
          if (!active) return;
          console.error("Failed to fetch conversations/invites", err);
          setLoadError("Failed to load conversations. Pull down to retry.");
        } finally {
          if (active) setIsLoading(false);
        }
      };
      loadData();
      return () => { active = false; };
    }, [setConversations, setPendingInvites])
  );

  const filteredConversations = uiConversations
    .filter((conv, index, arr) => arr.findIndex((c) => c.id === conv.id) === index)
    .filter((conv) => {
    // When used as the Chats tab in Community, show only DMs
    if (directOnly && conv.type !== "DIRECT") return false;

    const matchesSearch = conv.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesFilter =
      activeFilter === "All" ||
      (activeFilter === "Direct" && conv.type === "DIRECT") ||
      (activeFilter === "Groups" && conv.type === "GROUP" && conv.subType !== "CARE_CIRCLE") ||
      (activeFilter === "Care Circles" && conv.subType === "CARE_CIRCLE");
    return matchesSearch && matchesFilter;
  });

  // Count how many conversations have unread messages (not total message count).
  const unreadChats = uiConversations.filter((c) => c.unread > 0).length;

  const handleConversationPress = useCallback(
    (conv: Conversation) => {
      Keyboard.dismiss(); // M12: dismiss search keyboard before navigating
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
            subType: conv.subType,
          });
        }
      }
    },
    [navigation, isTab]
  );

  const navigateToScreen = (screen: string, params?: object) => {
    if (isTab) {
      // When rendered as a tab, screens inside ChatsStack are reached via parent navigator
      navigation.navigate('Chats', { screen, params });
    } else {
      navigation.navigate(screen as any, params as any);
    }
  };

  const handleNewAction = () => {
    navigateToScreen('NewChat');
  };

  // ── Theme-derived, high-contrast-aware card outline ─────────
  // Keeps white cards/rows visible against a (also white, under high
  // contrast) screen background — same convention as ChatScreen.tsx.
  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={[styles.conversationItem, { backgroundColor: colors.card, shadowColor: colors.primary }, cardBorder]}
      onPress={() => handleConversationPress(item)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}${item.unread > 0 ? `, ${item.unread} unread` : ""}`}
      accessibilityHint="Opens this conversation"
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: colors.background },
            item.type === "GROUP" && [styles.groupAvatar, { backgroundColor: colors.surface }],
          ]}
        >
          {item.type === "GROUP"
            ? (item.subType === "CARE_CIRCLE"
                ? <Accessibility size={24} color={colors.primary} strokeWidth={2} />
                : <Users size={24} color={colors.primary} strokeWidth={2} />)
            : (item.name === "DigiBot"
                ? <Bot size={24} color={colors.primary} strokeWidth={2} />
                : <User size={24} color={colors.primary} strokeWidth={2} />)}
        </View>
        {item.isOnline && item.type === "DIRECT" && (
          <View style={[styles.onlineDot, { borderColor: colors.card }]} />
        )}
      </View>

      {/* Content */}
      <View style={styles.conversationContent}>
        <View style={styles.conversationTop}>
          <AccessibleText variant="subtitle" style={[styles.conversationName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </AccessibleText>
          <AccessibleText
            variant="caption"
            style={[
              styles.conversationTime,
              { color: colors.subtext },
              item.unread > 0 && [styles.conversationTimeActive, { color: colors.primary }],
            ]}
          >
            {item.time}
          </AccessibleText>
        </View>
        <View style={styles.conversationBottom}>
          <AccessibleText variant="body" style={[styles.lastMessage, { color: colors.subtext }]} numberOfLines={1}>
            {item.lastMessage}
          </AccessibleText>
          {item.unread > 0 && (
            /* colors.primary already resolves to black under high contrast,
               so it stays visible against the always-white card background
               without needing a separate high-contrast override. */
            <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
              <AccessibleText variant="caption" style={[styles.unreadText, { color: colors.white }]}>
                {item.unread > 99 ? "99+" : item.unread}
              </AccessibleText>
            </View>
          )}
        </View>
        {item.type === "GROUP" && (
          <AccessibleText variant="caption" style={[styles.memberCount, { color: colors.subtext }]}>
            {item.memberCount} members
          </AccessibleText>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderBody = () => (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {!isTab && (
        <AppHeader
          title="Messages"
          rightActions={
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                style={styles.newChatTouch}
                onPress={() => navigation.navigate("Invites")}
                accessibilityRole="button"
                accessibilityLabel="Pending Invites"
                activeOpacity={0.7}
              >
                <Mail size={22} color={colors.white} strokeWidth={2} />
                {pendingInvites.length > 0 && (
                  <View style={[styles.inviteBadge, { borderColor: colors.primary }]}>
                    <AccessibleText variant="caption" style={[styles.inviteBadgeText, { color: colors.white }]}>
                      {pendingInvites.length}
                    </AccessibleText>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.newChatTouch}
                onPress={handleNewAction}
                accessibilityRole="button"
                accessibilityLabel="New Chat"
                activeOpacity={0.7}
              >
                <SquarePen size={22} color={colors.white} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          }
        />
      )}
      {/* ── Content Container (Search Bar moved into body flow for safe spacing) ── */}
      <View style={[
        styles.headerBodyFlow,
        isTab
          ? { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, paddingTop: 14 }
          : { backgroundColor: colors.primary }
      ]}>
        {unreadChats > 0 && (
          <AccessibleText
            variant="caption"
            style={[
              styles.headerSubtitleBody,
              isTab ? { color: colors.primary, marginBottom: 8 } : { color: "rgba(255,255,255,0.85)" }
            ]}
          >
            {unreadChats} unread chat{unreadChats !== 1 ? "s" : ""}
          </AccessibleText>
        )}
        <View style={[
          styles.searchContainer,
          isTab ? { backgroundColor: colors.surface } : { backgroundColor: "rgba(255,255,255,0.15)" }
        ]}>
          <Search size={16} color={isTab ? colors.subtext : "rgba(255,255,255,0.7)"} strokeWidth={2} style={styles.searchIcon} />
          <TextInput
            style={[
              styles.searchInput,
              isTab ? { color: colors.text } : { color: colors.white }
            ]}
            placeholder="Search conversations..."
            placeholderTextColor={isTab ? colors.subtext : "rgba(255,255,255,0.6)"}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search conversations"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X size={16} color={isTab ? colors.subtext : "rgba(255,255,255,0.85)"} strokeWidth={2.4} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Filter Tabs — hidden when directOnly (Chats tab shows DMs only) */}
      {!directOnly && <View style={[styles.filterContainer, isTab && { backgroundColor: colors.background }]}>
        {(["All", "Direct", "Care Circles", "Groups"] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterTab,
              { backgroundColor: colors.card, borderColor: colors.border },
              activeFilter === filter && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setActiveFilter(filter)}
            accessibilityRole="button"
            accessibilityLabel={`Filter: ${filter}`}
            accessibilityState={{ selected: activeFilter === filter }}
          >
            <AccessibleText
              variant="body"
              style={[
                styles.filterText,
                { color: colors.subtext },
                activeFilter === filter && { color: colors.white },
              ]}
            >
              {filter}
            </AccessibleText>
          </TouchableOpacity>
        ))}
      </View>}

      {/* ── Conversation List ────────────────────────────── */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversation}
        contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === 'ios' ? 190 : 170 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyEmoji}><MessageCircle size={44} color={colors.subtext} strokeWidth={1.75} /></View>
            <AccessibleText variant="title" style={[styles.emptyTitle, { color: colors.text }]}>
              No conversations
            </AccessibleText>
            <AccessibleText variant="body" style={{ color: colors.subtext }}>
              Start chatting with your care circle
            </AccessibleText>
          </View>
        }
      />

      {/* ── FAB — New Chat ─────────────────── */}
      <View style={[styles.fabPosition, { bottom: Platform.OS === 'ios' ? 120 : 100 }]}>
        <AccessibleButton
          variant="primary"
          onPress={handleNewAction}
          accessibilityLabel="New chat"
          accessibilityHint="Opens options to start a new 1:1 chat, care circle, or group"
          style={[styles.fab, { shadowColor: colors.primary }]}
        >
          <SquarePen size={17} color={colors.white} strokeWidth={2.2} style={styles.fabIcon} />
          <AccessibleText variant="button" style={{ color: colors.white }}>New Chat</AccessibleText>
        </AccessibleButton>
      </View>
    </View>
  );

  if (loadError && storeConversations.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <AccessibleText variant="body" style={{ color: colors.subtext, textAlign: "center", marginBottom: 16 }}>
          {loadError}
        </AccessibleText>
        <AccessibleButton
          variant="primary"
          onPress={() => {
            setLoadError(null);
            setIsLoading(true);
            chatService.getConversations().then(convData => setConversations(convData)).catch(e => setLoadError("Failed to load. Please try again.")).finally(() => setIsLoading(false));
          }}
          accessibilityLabel="Retry loading conversations"
          style={{ paddingHorizontal: 24, paddingVertical: 12 }}
        >
          Retry
        </AccessibleButton>
      </View>
    );
  }

  if (isTab) {
    return renderBody();
  }

  return (
    <ScreenWrapper>
      <AppHeader
        title="Messages"
        rightActions={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              style={styles.newChatTouch}
              onPress={() => navigation.navigate("Invites")}
              accessibilityRole="button"
              accessibilityLabel="Pending Invites"
              activeOpacity={0.7}
            >
              <Mail size={22} color={colors.white} strokeWidth={2} />
              {pendingInvites.length > 0 && (
                <View style={[styles.inviteBadge, { borderColor: colors.primary }]}>
                  <AccessibleText variant="caption" style={[styles.inviteBadgeText, { color: colors.white }]}>
                    {pendingInvites.length}
                  </AccessibleText>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.newChatTouch}
              onPress={handleNewAction}
              accessibilityRole="button"
              accessibilityLabel="New Chat"
              activeOpacity={0.7}
            >
              <SquarePen size={22} color={colors.white} strokeWidth={2} />
            </TouchableOpacity>
          </View>
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
  },

  headerSubtitleBody: {
    marginBottom: 10,
    fontWeight: "600",
  },
  newChatTouch: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    position: 'relative',
  },
  inviteBadge: {
    position: 'absolute',
    top: 6,
    right: 4,
    backgroundColor: '#FF3B30',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  inviteBadgeText: {
    fontWeight: '800',
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
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
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
    borderWidth: 1,
  },
  filterText: {
    fontWeight: "600",
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
    padding: 14,
    borderRadius: 16,
    marginBottom: 8,
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
    justifyContent: "center",
    alignItems: "center",
  },
  groupAvatar: {
    borderRadius: 16,
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
    flex: 1,
    marginRight: 8,
  },
  conversationTime: {
    fontWeight: "500",
  },
  conversationTimeActive: {
    fontWeight: "700",
  },
  conversationBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastMessage: {
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  unreadText: {
    fontWeight: "800",
  },
  memberCount: {
    marginTop: 2,
  },

  // ── Empty State ─────────────────────────────────────────
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyEmoji: {
    marginBottom: 16,
  },
  emptyTitle: {
    marginBottom: 6,
  },

  // ── FAB ─────────────────────────────────────────────────
  fabPosition: {
    position: "absolute",
    right: 20,
  },
  fab: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 28,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 8,
  },
  fabIcon: {
    marginRight: 8,
  },
});
