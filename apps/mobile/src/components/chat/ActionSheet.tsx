// ─────────────────────────────────────────────────────────────
// ActionSheet — a stylish, on-brand bottom sheet of actions.
// Replaces native ActionSheetIOS / Alert menus. Dismisses on
// backdrop press and always offers a Cancel button.
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Lucide icon component (e.g. Trash2, Volume2). Kept structural so we don't
// depend on a specific lucide-react-native type export version.
type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export interface ActionSheetOption {
  label: string;
  icon?: IconComponent; // themed lucide icon
  destructive?: boolean;
  onPress: () => void;
}

export function ActionSheet({
  visible,
  title,
  message,
  options,
  onClose,
}: {
  visible: boolean;
  title?: string;
  message?: string;
  options: ActionSheetOption[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          {/* Stop propagation so taps on the sheet don't dismiss it */}
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <View style={styles.handle} />
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {message ? <Text style={styles.message}>{message}</Text> : null}

              <View style={styles.options}>
                {options.map((opt, i) => (
                  <TouchableOpacity
                    key={`${opt.label}-${i}`}
                    style={[styles.option, i > 0 && styles.optionBorder]}
                    activeOpacity={0.7}
                    onPress={() => {
                      onClose();
                      opt.onPress();
                    }}
                  >
                    {opt.icon ? (
                      <View style={styles.optionIcon}>
                        <opt.icon
                          size={20}
                          strokeWidth={2}
                          color={opt.destructive ? "#DC2626" : "#7C3AED"}
                        />
                      </View>
                    ) : null}
                    <Text style={[styles.optionLabel, opt.destructive && styles.destructive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.cancel} activeOpacity={0.8} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
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
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E2DBF0",
    alignSelf: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A132B",
    textAlign: "center",
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  message: {
    fontSize: 13,
    color: "#8A8496",
    textAlign: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 2,
  },
  options: {
    backgroundColor: "#F7F5FB",
    borderRadius: 18,
    overflow: "hidden",
    marginTop: 6,
    marginBottom: 10,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  optionBorder: {
    borderTopWidth: 1,
    borderTopColor: "#ECE7F6",
  },
  optionIcon: {
    width: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: "#2A2140",
  },
  destructive: {
    color: "#DC2626",
  },
  cancel: {
    backgroundColor: "#F0EAF9",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#7C3AED",
  },
});
