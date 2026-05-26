import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MessageCircle, Plus } from "lucide-react-native";

const ChatsTab = () => {
  return (
    <View style={styles.container}>
      <View style={styles.emptyCard}>
        <View style={styles.iconBox}>
          <MessageCircle size={44} color="#500088" />
        </View>
        <Text style={styles.emptyTitle}>No Chats Currently</Text>
        <Text style={styles.emptySubtitle}>
          There are currently no active group chats.
        </Text>
        <Text style={styles.emptySubtitle}>
          Start chatting with peers by launching a new chat room.
        </Text>
        <TouchableOpacity style={styles.createBtn}>
          <Plus size={18} color="#FFFFFF" />
          <Text style={styles.createBtnText}>Start Chat</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ChatsTab;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#FAF8FF",
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
});
