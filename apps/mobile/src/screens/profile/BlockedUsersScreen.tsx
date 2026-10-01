import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native";
import { Ban, UserCheck } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { chatService } from "@services/chatService";

// ─────────────────────────────────────────────────────────────
// Blocked Users
//
// Blocking was previously irreversible from the UI: the block action existed,
// but nothing anywhere called unblockUser or listed who you had blocked. The
// Community Guidelines tell people they can undo a block from here, so this
// screen is what makes that true.
// ─────────────────────────────────────────────────────────────

interface BlockedUser {
  id: string;
  name: string;
  blockedAt: string;
}

export default function BlockedUsersScreen() {
  const { colors, highContrast } = useTheme();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };

  const load = useCallback(async () => {
    try {
      setUsers(await chatService.getBlockedUsers());
    } catch {
      Alert.alert("Error", "Could not load your blocked list. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirmUnblock = (user: BlockedUser) => {
    Alert.alert(
      "Unblock user",
      `Unblock ${user.name}? You will be able to message each other again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: async () => {
            setBusyId(user.id);
            try {
              await chatService.unblockUser(user.id);
              setUsers((prev) => prev.filter((u) => u.id !== user.id));
            } catch {
              Alert.alert("Error", "Could not unblock this user. Please try again.");
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenWrapper>
      <AppHeader title="Blocked Users" />

      <ScrollView contentContainerStyle={styles.content}>
        <AccessibleText variant="body" style={[styles.intro, { color: colors.subtext }]}>
          Blocking works both ways: neither of you can send the other a direct message. It does
          not remove either of you from groups or Care Circles you both belong to.
        </AccessibleText>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : users.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }, cardBorder]}>
            <UserCheck size={30} color={colors.subtext} strokeWidth={1.8} />
            <AccessibleText variant="subtitle" style={[styles.emptyTitle, { color: colors.text }]}>
              No blocked users
            </AccessibleText>
            <AccessibleText variant="caption" style={{ color: colors.subtext, textAlign: "center" }}>
              Anyone you block will appear here, and you can unblock them at any time.
            </AccessibleText>
          </View>
        ) : (
          users.map((user) => (
            <View
              key={user.id}
              style={[styles.row, { backgroundColor: colors.card }, cardBorder]}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
                  <Ban size={18} color={colors.subtext} strokeWidth={2} />
                </View>
                <View style={styles.rowText}>
                  <AccessibleText variant="subtitle" style={{ color: colors.text }}>
                    {user.name}
                  </AccessibleText>
                  <AccessibleText variant="caption" style={{ color: colors.subtext }}>
                    Blocked {new Date(user.blockedAt).toLocaleDateString()}
                  </AccessibleText>
                </View>
              </View>

              <AccessibleButton
                variant="secondary"
                accessibilityLabel={`Unblock ${user.name}`}
                accessibilityHint="Lets you message each other again"
                style={styles.unblockBtn}
                onPress={() => confirmUnblock(user)}
                disabled={busyId === user.id}
              >
                {busyId === user.id ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <AccessibleText variant="button" style={{ color: colors.primary }}>
                    Unblock
                  </AccessibleText>
                )}
              </AccessibleButton>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  intro: { marginBottom: 4, lineHeight: 20 },
  centered: { paddingVertical: 40, alignItems: "center" },
  emptyCard: { borderRadius: 14, padding: 24, alignItems: "center", gap: 8 },
  emptyTitle: { marginTop: 4 },
  row: {
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, gap: 2 },
  unblockBtn: { paddingHorizontal: 16, paddingVertical: 8, minWidth: 96 },
});
