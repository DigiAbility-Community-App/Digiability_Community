// ─────────────────────────────────────────────────────────────
// NotificationDetailModal — a stylish, on-brand centered modal for
// reading a full notification (moderation warnings/bans/removals, admin
// alerts). Replaces native Alert.alert, which truncates and can't show a
// multi-section message legibly. Read-only: single Close button, and the
// body scrolls when the message is long instead of getting clipped.
// ─────────────────────────────────────────────────────────────

import React from "react";
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from "react-native";

// Lucide icon component (structural type to stay version-agnostic).
type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export function NotificationDetailModal({
  visible,
  title,
  message,
  icon,
  severity = "info",
  onClose,
}: {
  visible: boolean;
  title: string;
  message: string;
  icon?: IconComponent;
  severity?: "info" | "warning" | "danger";
  onClose: () => void;
}) {
  const accentColor = severity === "danger" ? "#DC2626" : severity === "warning" ? "#D97706" : "#7C3AED";
  const iconBg = severity === "danger" ? "#FDECEC" : severity === "warning" ? "#FEF3C7" : "#F0EAF9";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.dialog}>
              {icon ? (
                <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
                  {React.createElement(icon, { size: 26, strokeWidth: 2, color: accentColor })}
                </View>
              ) : null}
              <Text style={styles.title}>{title}</Text>
              <ScrollView style={styles.messageScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.message}>{message}</Text>
              </ScrollView>
              <TouchableOpacity
                style={[styles.closeBtn, { backgroundColor: accentColor }]}
                activeOpacity={0.85}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20, 12, 34, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  dialog: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A132B",
    textAlign: "center",
    marginBottom: 12,
  },
  messageScroll: {
    alignSelf: "stretch",
    marginBottom: 18,
  },
  message: {
    fontSize: 14,
    color: "#4B4355",
    textAlign: "left",
    lineHeight: 21,
  },
  closeBtn: {
    alignSelf: "stretch",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  closeBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
});
