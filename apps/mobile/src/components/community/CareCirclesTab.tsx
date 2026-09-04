import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, RefreshControl, Alert, Platform,
} from "react-native";
import { HeartHandshake, Plus, ChevronRight, LogIn, Accessibility, TriangleAlert, Clock, AlertCircle } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { chatService, CommunityGroup } from "../../services/chatService";
import { useTheme } from "../../theme/ThemeContext";
import { ConfirmDialog } from "../chat/ConfirmDialog";

const CareCirclesTab = () => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const [circles, setCircles] = useState<CommunityGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  // Circles where this user has an outstanding join request awaiting
  // admin/caregiver approval — kept separate from isMember so the card
  // shows "Requested" instead of reverting to a plain "Join" button.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [joinError, setJoinError] = useState<{ visible: boolean; message: string }>({ visible: false, message: "" });

  const loadCircles = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await chatService.fetchAllGroups("CARE_CIRCLE");
      setCircles(data.filter((g, i, arr) => arr.findIndex((x) => x.id === g.id) === i));
    } catch {
      setError("Could not load Care Circles. Pull down to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadCircles(); }, [loadCircles]);

  const handleCirclePress = (circle: CommunityGroup) => {
    if (pendingIds.has(circle.id)) {
      Alert.alert(
        "Request pending",
        "Your request to join this Care Circle is awaiting approval."
      );
      return;
    }
    if (!circle.isMember) {
      Alert.alert(
        `Join "${circle.name}"?`,
        `${circle.memberCount} ${circle.memberCount === 1 ? "member" : "members"} · ${circle.description || "Care Circle support group"}`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Join Circle", onPress: () => handleJoin(circle) },
        ]
      );
      return;
    }
    navigation.navigate("Chats", {
      screen: "GroupChat",
      params: { conversationId: circle.id, groupName: circle.name, subType: "CARE_CIRCLE" },
    });
  };

  const handleJoin = async (circle: CommunityGroup) => {
    setJoiningId(circle.id);
    try {
      const result = await chatService.joinGroup(circle.id);
      if (result.status === "pending_approval") {
        setPendingIds((prev) => new Set(prev).add(circle.id));
        Alert.alert(
          "Request sent",
          "An admin needs to approve your request before you can enter this Care Circle."
        );
        return;
      }
      setCircles((prev) =>
        prev.map((c) => c.id === circle.id ? { ...c, isMember: true, memberCount: c.memberCount + 1 } : c)
      );
      navigation.navigate("Chats", {
        screen: "GroupChat",
        params: { conversationId: circle.id, groupName: circle.name, subType: "CARE_CIRCLE" },
      });
    } catch (e: any) {
      const message = e?.response?.data?.message || "Could not join the Care Circle. Please try again.";
      setJoinError({ visible: true, message });
    } finally {
      setJoiningId(null);
    }
  };

  const handleCreate = () => {
    navigation.navigate("Chats", {
      screen: "CreateGroup",
      params: { subType: "CARE_CIRCLE" },
    });
  };

  const renderItem = ({ item }: { item: CommunityGroup }) => {
    const isJoining = joiningId === item.id;
    const isPending = pendingIds.has(item.id);
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card }]}
        onPress={() => handleCirclePress(item)}
        disabled={isJoining}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Care Circle: ${item.name}, ${item.memberCount} members${item.isMember ? ", you are a member" : isPending ? ", join request pending approval" : ", tap to join"}`}
      >
        <View style={styles.avatar}>
          <Accessibility size={26} color="#8A38F5" strokeWidth={2} />
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            {!item.isMember && (
              <View style={styles.joinBadge}>
                <Text style={styles.joinBadgeText}>{isPending ? "Requested" : "Join"}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.desc, { color: colors.subtext }]} numberOfLines={1}>
            {item.description || item.lastMessageText || "Support circle"}
          </Text>
          <Text style={[styles.memberCount, { color: colors.subtext }]}>
            {item.memberCount} {item.memberCount === 1 ? "member" : "members"}
          </Text>
        </View>

        {isJoining
          ? <ActivityIndicator size="small" color="#500088" />
          : item.isMember
            ? <ChevronRight size={20} color={colors.border} />
            : isPending
              ? <Clock size={18} color={colors.subtext} />
              : <LogIn size={18} color="#500088" />
        }
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadCircles(true); }} tintColor="#500088" />}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.iconBox}><TriangleAlert size={40} color="#E0A800" strokeWidth={1.9} /></View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Couldn't Load Care Circles</Text>
            <Text style={[styles.emptySubtitle, { color: colors.subtext }]}>{error}</Text>
          </View>
        }
      />
    );
  }

  const errorDialog = (
    <ConfirmDialog
      visible={joinError.visible}
      title="Unable to Join"
      message={joinError.message}
      icon={AlertCircle}
      hideCancel
      confirmLabel="OK"
      onConfirm={() => setJoinError({ visible: false, message: "" })}
      onCancel={() => setJoinError({ visible: false, message: "" })}
    />
  );

  if (circles.length === 0) {
    return (
      <>
        <FlatList
          data={[]}
          renderItem={() => null}
          contentContainerStyle={styles.centered}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadCircles(true); }} tintColor="#500088" />}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <View style={styles.iconBox}>
                <HeartHandshake size={44} color="#500088" />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Care Circles Yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.subtext }]}>
                Create a Care Circle to connect with your support network.
              </Text>
              <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
                <Plus size={18} color="#FFFFFF" />
                <Text style={styles.createBtnText}>Create Care Circle</Text>
              </TouchableOpacity>
            </View>
          }
        />
        {errorDialog}
      </>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={circles}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadCircles(true); }}
            tintColor="#500088"
          />
        }
      />
      <TouchableOpacity style={styles.fab} onPress={handleCreate} accessibilityLabel="Create new Care Circle">
        <Plus size={24} color="#FFFFFF" />
      </TouchableOpacity>
      {errorDialog}
    </View>
  );
};

export default CareCirclesTab;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF8FF" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, paddingTop: 60 },
  listContent: { padding: 16, paddingBottom: Platform.OS === "ios" ? 190 : 170 },
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFFFFF", padding: 16, borderRadius: 16, marginBottom: 12,
    shadowColor: "#500088", shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: "#F3EAFF",
    justifyContent: "center", alignItems: "center", marginRight: 16,
  },
  avatarEmoji: { fontSize: 24 },
  info: { flex: 1, marginRight: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  name: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
  joinBadge: { backgroundColor: "#F3E8FF", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  joinBadgeText: { fontSize: 10, fontWeight: "700", color: "#500088" },
  desc: { fontSize: 13, marginBottom: 2 },
  memberCount: { fontSize: 11, fontWeight: "600" },
  emptyCard: {
    backgroundColor: "#FFFFFF", borderRadius: 24, padding: 32,
    alignItems: "center", marginTop: 20, marginHorizontal: 8,
    shadowColor: "#500088", shadowOpacity: 0.05, shadowRadius: 12, elevation: 3,
  },
  iconBox: {
    width: 92, height: 92, borderRadius: 24, backgroundColor: "#F3E8FF",
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
