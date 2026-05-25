import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { ChatsStackParamList } from "@navigation/ChatsStack";

import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─────────────────────────────────────────────────────────
// User Profile Screen
//
// Shown when tapping on a user's avatar or name in a chat.
// Shows basic profile info + quick actions (message, call).
// ─────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<ChatsStackParamList, "UserProfile">;
  route: RouteProp<ChatsStackParamList, "UserProfile">;
};

const UserProfileScreen = ({ navigation, route }: Props) => {
  const { userId, userName } = route.params;
  const insets = useSafeAreaInsets();

  return (
    <ScreenWrapper statusBarStyle="light">
      {/* ── Header with gradient ─────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ── Avatar Card ──────────────────────────────────── */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeEmoji}>👩‍⚕️</Text>
          </View>
          <Text style={styles.profileName}>{userName}</Text>
          <Text style={styles.profileRole}>Therapist • Physiotherapy</Text>

          <View style={styles.statusRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.statusText}>Online</Text>
          </View>

          {/* Quick Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionIcon}>💬</Text>
              <Text style={styles.actionLabel}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionIcon}>📞</Text>
              <Text style={styles.actionLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Text style={styles.actionIcon}>🎥</Text>
              <Text style={styles.actionLabel}>Video</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Info Section ─────────────────────────────────── */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.infoText}>
            Helping individuals with mobility challenges achieve their
            fullest potential through personalized therapy programs. 10+
            years of experience in rehabilitation medicine.
          </Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Details</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoValue}>Mumbai, India</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Member since</Text>
            <Text style={styles.infoValue}>January 2024</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Shared groups</Text>
            <Text style={styles.infoValue}>3 groups</Text>
          </View>
        </View>

        {/* ── Shared Media ─────────────────────────────────── */}
        <View style={styles.infoSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shared Media</Text>
            <TouchableOpacity>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.mediaGrid}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.mediaThumbnail}>
                <Text style={styles.mediaPlaceholder}>📄</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Danger Zone ──────────────────────────────────── */}
        <View style={styles.dangerSection}>
          <TouchableOpacity style={styles.dangerBtn}>
            <Text style={styles.dangerText}>🚫 Block User</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerBtn}>
            <Text style={styles.dangerText}>⚠️ Report User</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

export default UserProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F6F6",
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#8A38F5",
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  backText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  // ── Content ─────────────────────────────────────────────
  content: {
    paddingBottom: 40,
  },

  // ── Profile Card ────────────────────────────────────────
  profileCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: -10,
    borderRadius: 20,
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
    shadowColor: "#8A38F5",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 4,
  },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: "#F3EAFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 3,
    borderColor: "#8A38F5",
  },
  avatarLargeEmoji: {
    fontSize: 40,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    color: "#888",
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
  },
  statusText: {
    fontSize: 13,
    color: "#22C55E",
    fontWeight: "600",
  },

  // Actions
  actions: {
    flexDirection: "row",
    gap: 16,
  },
  actionBtn: {
    alignItems: "center",
    backgroundColor: "#F3EAFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  actionIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#500088",
  },

  // ── Info Sections ───────────────────────────────────────
  infoSection: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 10,
  },
  viewAll: {
    fontSize: 13,
    color: "#8A38F5",
    fontWeight: "600",
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f3fa",
  },
  infoLabel: {
    fontSize: 14,
    color: "#888",
  },
  infoValue: {
    fontSize: 14,
    color: "#1a1a1a",
    fontWeight: "600",
  },

  // ── Media Grid ──────────────────────────────────────────
  mediaGrid: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  mediaThumbnail: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: "#F3EAFF",
    justifyContent: "center",
    alignItems: "center",
  },
  mediaPlaceholder: {
    fontSize: 28,
  },

  // ── Danger Zone ─────────────────────────────────────────
  dangerSection: {
    marginHorizontal: 16,
    marginTop: 20,
    gap: 8,
  },
  dangerBtn: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  dangerText: {
    fontSize: 14,
    color: "#E53E3E",
    fontWeight: "600",
  },
});
