import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { Users, Plus, ChevronRight } from "lucide-react-native";
import { useChatStore } from "@store/chatStore";
import { useNavigation } from "@react-navigation/native";

const GroupsTab = () => {
  const navigation = useNavigation<any>();
  const conversations = useChatStore((s) => Object.values(s.conversations));
  
  // Filter only General Groups
  const generalGroups = conversations.filter(
    (c) => c.type === "GROUP" && c.subType === "GENERAL"
  );

  const handleGroupPress = (group: any) => {
    navigation.navigate("GroupChat", {
      conversationId: group.id,
      groupName: group.name,
      subType: group.subType,
    });
  };

  const handleCreateGroup = () => {
    navigation.navigate("CreateGroup", { subType: "GENERAL" });
  };

  const renderGroupItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.groupCard} 
      onPress={() => handleGroupPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.groupAvatar}>
        <Text style={styles.groupAvatarText}>
          {item.name ? item.name.substring(0,2).toUpperCase() : "GR"}
        </Text>
      </View>
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.groupDesc} numberOfLines={2}>
          {item.lastMessageText || item.description || "No messages yet"}
        </Text>
      </View>
      <ChevronRight size={20} color="#CBD5E1" />
    </TouchableOpacity>
  );

  if (generalGroups.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyCard}>
          <View style={styles.iconBox}>
            <Users size={44} color="#500088" />
          </View>
          <Text style={styles.emptyTitle}>No Groups Currently</Text>
          <Text style={styles.emptySubtitle}>
            There are currently no active community groups.
          </Text>
          <Text style={styles.emptySubtitle}>
            Start meaningful conversations by creating your own group.
          </Text>
          <TouchableOpacity style={styles.createBtn} onPress={handleCreateGroup}>
            <Plus size={18} color="#FFFFFF" />
            <Text style={styles.createBtnText}>Create Group</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={generalGroups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroupItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      <TouchableOpacity style={styles.fab} onPress={handleCreateGroup}>
        <Plus size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

export default GroupsTab;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF8FF",
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
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
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#EDE9FE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  groupAvatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6B21A8",
  },
  groupInfo: {
    flex: 1,
    marginRight: 12,
  },
  groupName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1B20",
    marginBottom: 4,
  },
  groupDesc: {
    fontSize: 13,
    color: "#64748B",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    shadowColor: "#500088",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    marginTop: 20,
    marginHorizontal: 24,
  },
  iconBox: {
    width: 92,
    height: 92,
    borderRadius: 24,
    backgroundColor: "#F3E8FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1B20",
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 6,
  },
  createBtn: {
    marginTop: 28,
    backgroundColor: "#500088",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  createBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 10,
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#500088",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#500088",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
