import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatsStackParamList } from "@navigation/ChatsStack";
import { chatService, CommunityGroup } from "@services/chatService";
import { useChatStore } from "@store/chatStore";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { ConfirmDialog } from "../../components/chat/ConfirmDialog";
import { ArrowLeft, Search, SearchX, LogIn, Clock, AlertCircle } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";

type Props = NativeStackScreenProps<ChatsStackParamList, "DiscoverGroups">;

const DiscoverGroupsScreen = ({ navigation, route }: Props) => {
  const subType = route.params?.subType || "GENERAL";
  const insets = useSafeAreaInsets();
  const { colors, highContrast } = useTheme();
  // Nudge the Groups / Care Circles tabs directly rather than waiting for the
  // member.joined round-trip — the socket reconnects on a timer, so a join
  // made while it's down would otherwise not show until a manual refresh.
  const refreshCommunityGroups = useChatStore((s) => s.refreshCommunityGroups);

  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  // Covers both the failure case and the "request sent for approval" case —
  // joining a group that needs admin approval used to succeed silently, with
  // nothing but a small clock icon to show anything had happened.
  const [notice, setNotice] = useState<{
    visible: boolean;
    title: string;
    message: string;
    tone: "info" | "error";
  }>({ visible: false, title: "", message: "", tone: "info" });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await chatService.fetchAllGroups(subType);
        if (active) setGroups(data.filter((g, i, arr) => arr.findIndex((x) => x.id === g.id) === i));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [subType]);

  const unjoinedGroups = useMemo(
    () => groups.filter((g) => !g.isMember && !joinedIds.has(g.id)),
    [groups, joinedIds]
  );

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return unjoinedGroups;
    return unjoinedGroups.filter((g) =>
      g.name?.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q)
    );
  }, [unjoinedGroups, query]);

  const handleJoin = async (group: CommunityGroup) => {
    setJoiningId(group.id);
    try {
      const result = await chatService.joinGroup(group.id);
      if (result.status === "pending_approval") {
        setPendingIds((prev) => new Set(prev).add(group.id));
        setNotice({
          visible: true,
          title: "Request sent",
          message: `An admin needs to approve your request before you can open ${
            subType === "CARE_CIRCLE" ? "this Care Circle" : "this group"
          }.`,
          tone: "info",
        });
        return;
      }
      setJoinedIds((prev) => new Set(prev).add(group.id));
      refreshCommunityGroups();
      navigation.replace("GroupChat", {
        conversationId: group.id,
        groupName: group.name,
        subType: group.subType as "GENERAL" | "CARE_CIRCLE",
      });
    } catch (e: any) {
      const message = e?.response?.data?.message ||
        `Could not join ${subType === "CARE_CIRCLE" ? "the Care Circle" : "the group"}. Please try again.`;
      setNotice({ visible: true, title: "Unable to Join", message, tone: "error" });
    } finally {
      setJoiningId(null);
    }
  };

  const renderItem = ({ item }: { item: CommunityGroup }) => {
    const isJoining = joiningId === item.id;
    const isPending = pendingIds.has(item.id);
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card }]}
        onPress={() =>
          isPending
            ? setNotice({
                visible: true,
                title: "Request pending",
                message: "Your request is waiting for an admin to approve it.",
                tone: "info",
              })
            : handleJoin(item)
        }
        // Only disabled mid-request — a pending card stays tappable so the
        // reminder above can explain why nothing happens when it's tapped.
        disabled={isJoining}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Group: ${item.name}, ${item.memberCount} members${isPending ? ", join request pending approval" : ", tap to join"}`}
      >
        <View style={styles.avatar}>
          <AccessibleText variant="body" style={styles.avatarText}>
            {item.name ? item.name.substring(0, 2).toUpperCase() : "GR"}
          </AccessibleText>
        </View>
        <View style={styles.info}>
          <AccessibleText variant="body" style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </AccessibleText>
          <AccessibleText variant="caption" style={[styles.desc, { color: colors.subtext }]} numberOfLines={1}>
            {item.description || "Community group"}
          </AccessibleText>
          <AccessibleText variant="caption" style={[styles.memberCount, { color: colors.subtext }]}>
            {item.memberCount} {item.memberCount === 1 ? "member" : "members"}
          </AccessibleText>
        </View>
        {isJoining
          ? <ActivityIndicator size="small" color="#500088" />
          : isPending
            ? <Clock size={18} color={colors.subtext} />
            : <LogIn size={18} color="#500088" />
        }
      </TouchableOpacity>
    );
  };

  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };

  return (
    <ScreenWrapper statusBarStyle="light">
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={colors.white} strokeWidth={2.2} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <AccessibleText variant="title" style={[styles.headerTitle, { color: colors.white }]}>
            {subType === "CARE_CIRCLE" ? "Join a Care Circle" : "Join Community"}
          </AccessibleText>
          <AccessibleText variant="caption" style={[styles.headerSubtitle, { color: "rgba(255,255,255,0.6)" }]}>
            Search and join groups you're not in yet
          </AccessibleText>
        </View>
      </View>

      <View style={styles.content}>
        <View style={[styles.searchContainer, { backgroundColor: colors.card, shadowColor: colors.primary }, cardBorder]}>
          <Search size={16} color={colors.text} strokeWidth={2} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name or description..."
            placeholderTextColor={colors.subtext}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Search groups by name or description"
          />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#500088" />
          </View>
        ) : filteredGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <SearchX size={32} color={colors.subtext} strokeWidth={1.8} style={styles.emptyIcon} />
            <AccessibleText variant="body" style={[styles.emptyText, { color: colors.subtext }]}>
              {query ? `No groups found for "${query}"` : "No groups to join right now"}
            </AccessibleText>
          </View>
        ) : (
          <FlatList
            data={filteredGroups}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>

      <ConfirmDialog
        visible={notice.visible}
        title={notice.title}
        message={notice.message}
        icon={notice.tone === "error" ? AlertCircle : Clock}
        hideCancel
        confirmLabel="OK"
        onConfirm={() => setNotice((n) => ({ ...n, visible: false }))}
        onCancel={() => setNotice((n) => ({ ...n, visible: false }))}
      />
    </ScreenWrapper>
  );
};

export default DiscoverGroupsScreen;

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: "row", alignItems: "center" },
  backBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center", marginRight: 14 },
  headerCenter: { flex: 1 },
  headerTitle: { letterSpacing: 0.3 },
  headerSubtitle: { marginTop: 2 },
  content: { flex: 1, paddingTop: 16, paddingHorizontal: 16 },
  searchContainer: { flexDirection: "row", alignItems: "center", borderRadius: 16, paddingHorizontal: 14, marginBottom: 12, shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 14 },
  listContent: { paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 40 },
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFFFFF", padding: 16, borderRadius: 16, marginBottom: 12,
    shadowColor: "#500088", shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: "#EDE9FE",
    justifyContent: "center", alignItems: "center", marginRight: 16,
  },
  avatarText: { fontWeight: "700", color: "#6B21A8" },
  info: { flex: 1, marginRight: 12 },
  name: { fontWeight: "700", marginBottom: 2 },
  desc: { marginBottom: 2 },
  memberCount: { fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 20 },
  emptyIcon: { marginBottom: 8 },
  emptyText: { fontWeight: "500", textAlign: "center" },
});
