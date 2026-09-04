import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, RefreshControl, Platform,
} from "react-native";
import { Users, Plus, ChevronRight, UserPlus, TriangleAlert } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { chatService, CommunityGroup } from "../../services/chatService";
import { useTheme } from "../../theme/ThemeContext";

const GroupsTab = () => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadGroups = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await chatService.fetchAllGroups("GENERAL");
      setGroups(data.filter((g, i, arr) => arr.findIndex((x) => x.id === g.id) === i));
    } catch (e) {
      setError("Could not load groups. Pull down to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  // This tab only shows groups the user has already joined — browsing and
  // joining new ones happens on the separate "Join Community" screen.
  const joinedGroups = useMemo(() => groups.filter((g) => g.isMember), [groups]);

  const handleGroupPress = (group: CommunityGroup) => {
    navigation.navigate("Chats", {
      screen: "GroupChat",
      params: { conversationId: group.id, groupName: group.name, subType: group.subType },
    });
  };

  const handleCreateGroup = () => {
    navigation.navigate("Chats", {
      screen: "CreateGroup",
      params: { subType: "GENERAL" },
    });
  };

  const handleJoinCommunity = () => {
    navigation.navigate("Chats", {
      screen: "DiscoverGroups",
      params: { subType: "GENERAL" },
    });
  };

  const renderGroupItem = ({ item }: { item: CommunityGroup }) => {
    return (
      <TouchableOpacity
        style={[styles.groupCard, { backgroundColor: colors.card }]}
        onPress={() => handleGroupPress(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Group: ${item.name}, ${item.memberCount} members`}
      >
        <View style={styles.groupAvatar}>
          <Text style={styles.groupAvatarText}>
            {item.name ? item.name.substring(0, 2).toUpperCase() : "GR"}
          </Text>
        </View>

        <View style={styles.groupInfo}>
          <Text style={[styles.groupName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.groupDesc, { color: colors.subtext }]} numberOfLines={1}>
            {item.lastMessageText || item.description || "No messages yet"}
          </Text>
          <Text style={[styles.memberCount, { color: colors.subtext }]}>
            {item.memberCount} {item.memberCount === 1 ? "member" : "members"}
          </Text>
        </View>

        <ChevronRight size={20} color={colors.border} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#500088" />
      </View>
    );
  }

  if (error) {
    return (
      <FlatList
        data={[]}
        renderItem={() => null}
        contentContainerStyle={styles.centered}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadGroups(true); }} tintColor="#500088" />
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.iconBox}><TriangleAlert size={40} color="#E0A800" strokeWidth={1.9} /></View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Couldn't Load Groups</Text>
            <Text style={[styles.emptySubtitle, { color: colors.subtext }]}>{error}</Text>
          </View>
        }
      />
    );
  }

  const joinCommunityBtn = (
    <TouchableOpacity style={styles.joinCommunityBtn} onPress={handleJoinCommunity} accessibilityRole="button" accessibilityLabel="Join Community — browse groups you haven't joined yet">
      <UserPlus size={18} color="#500088" />
      <Text style={styles.joinCommunityBtnText}>Join Community</Text>
    </TouchableOpacity>
  );

  if (joinedGroups.length === 0) {
    return (
      <FlatList
        data={[]}
        renderItem={() => null}
        contentContainerStyle={styles.centered}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadGroups(true); }} tintColor="#500088" />
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.iconBox}>
              <Users size={44} color="#500088" />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Groups Yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.subtext }]}>
              Create a group, or join one that already exists.
            </Text>
            <TouchableOpacity style={styles.createBtn} onPress={handleCreateGroup}>
              <Plus size={18} color="#FFFFFF" />
              <Text style={styles.createBtnText}>Create Group</Text>
            </TouchableOpacity>
            {joinCommunityBtn}
          </View>
        }
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={joinedGroups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroupItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<View style={styles.listHeader}>{joinCommunityBtn}</View>}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadGroups(true); }}
            tintColor="#500088"
          />
        }
      />
      <TouchableOpacity style={styles.fab} onPress={handleCreateGroup} accessibilityLabel="Create new group">
        <Plus size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

export default GroupsTab;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF8FF" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, paddingTop: 60 },
  listContent: { padding: 16, paddingBottom: Platform.OS === "ios" ? 190 : 170 },
  listHeader: { marginBottom: 12 },
  joinCommunityBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#F3E8FF", borderRadius: 14,
    paddingVertical: 12, gap: 8, marginTop: 14,
  },
  joinCommunityBtnText: { color: "#500088", fontSize: 14, fontWeight: "700" },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#500088",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  groupAvatar: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: "#EDE9FE",
    justifyContent: "center", alignItems: "center",
    marginRight: 16,
  },
  groupAvatarText: { fontSize: 16, fontWeight: "700", color: "#6B21A8" },
  groupInfo: { flex: 1, marginRight: 12 },
  groupName: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  groupDesc: { fontSize: 13, marginBottom: 2 },
  memberCount: { fontSize: 11, fontWeight: "600" },
  emptyCard: {
    backgroundColor: "#FFFFFF", borderRadius: 24, padding: 32,
    alignItems: "center", marginTop: 20, marginHorizontal: 8,
    shadowColor: "#500088", shadowOpacity: 0.05, shadowRadius: 12, elevation: 3,
  },
  iconBox: {
    width: 92, height: 92, borderRadius: 24,
    backgroundColor: "#F3E8FF",
    justifyContent: "center", alignItems: "center", marginBottom: 24,
  },
  emptyTitle: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  emptySubtitle: { fontSize: 15, textAlign: "center", lineHeight: 24, marginBottom: 6 },
  createBtn: {
    marginTop: 28, backgroundColor: "#500088",
    paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 16, flexDirection: "row", alignItems: "center",
  },
  createBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", marginLeft: 10 },
  fab: {
    position: "absolute", bottom: Platform.OS === "ios" ? 120 : 100, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#500088",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#500088", shadowOpacity: 0.3, shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
