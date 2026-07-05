// ─────────────────────────────────────────────────────────────
// ConfirmDialog — a stylish, on-brand centered confirm modal.
// Replaces native Alert confirmations. Dismisses on backdrop press
// and always offers a Cancel button.
// ─────────────────────────────────────────────────────────────

import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from "react-native";

// Lucide icon component (structural type to stay version-agnostic).
type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export function ConfirmDialog({
  visible,
  title,
  message,
  icon,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  hideCancel = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  icon?: IconComponent;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  hideCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.dialog}>
              {icon ? (
                <View style={[styles.iconCircle, destructive && styles.iconCircleDanger]}>
                  {React.createElement(icon, {
                    size: 26,
                    strokeWidth: 2,
                    color: destructive ? "#DC2626" : "#7C3AED",
                  })}
                </View>
              ) : null}
              <Text style={styles.title}>{title}</Text>
              {message ? <Text style={styles.message}>{message}</Text> : null}
              <View style={styles.actions}>
                {!hideCancel && (
                  <TouchableOpacity style={styles.cancel} activeOpacity={0.8} onPress={onCancel}>
                    <Text style={styles.cancelText}>{cancelLabel}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.confirm, destructive && styles.confirmDanger]}
                  activeOpacity={0.85}
                  onPress={() => {
                    onCancel(); // close first
                    onConfirm();
                  }}
                >
                  <Text style={styles.confirmText}>{confirmLabel}</Text>
                </TouchableOpacity>
              </View>
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
    maxWidth: 340,
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#F0EAF9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  iconCircleDanger: {
    backgroundColor: "#FDECEC",
  },
  icon: {
    fontSize: 26,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A132B",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: "#8A8496",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 4,
  },
  cancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#F0EAF9",
    alignItems: "center",
  },
  cancelText: {
    color: "#6B5B8A",
    fontWeight: "700",
    fontSize: 15,
  },
  confirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#7C3AED",
    alignItems: "center",
  },
  confirmDanger: {
    backgroundColor: "#DC2626",
  },
  confirmText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
