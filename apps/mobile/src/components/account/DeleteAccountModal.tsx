import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { ShieldAlert } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../shared/AccessibleText";
import { AccessibleButton } from "../shared/AccessibleButton";
import { deleteAccount } from "@services/authService";

// ─────────────────────────────────────────────────────────────
// Delete Account — password confirmation
//
// The server now requires the password for this irreversible action, so an
// unlocked phone is no longer enough to destroy someone's account.
//
// A modal rather than Alert.prompt: that API exists only on iOS, so on Android
// it would silently never appear and deletion would be unreachable.
// ─────────────────────────────────────────────────────────────

export function DeleteAccountModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors, highContrast } = useTheme();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setPassword("");
      setError(null);
      setSubmitting(false);
    }
  }, [visible]);

  const handleDelete = async () => {
    if (!password.trim()) {
      setError("Please enter your password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await deleteAccount(password);
      // deleteAccount clears local stores and the refresh token, which flips
      // RootNavigator back to the auth stack — no navigation needed here.
    } catch (err: any) {
      const status = err?.response?.status;
      setError(
        status === 401
          ? "That password is incorrect."
          : err?.response?.data?.message || "Could not delete your account. Please try again."
      );
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card },
              highContrast && { borderWidth: 2, borderColor: "#000000" },
            ]}
          >
            <View style={[styles.iconCircle, { backgroundColor: `${colors.error}18` }]}>
              <ShieldAlert size={26} color={colors.error} strokeWidth={2} />
            </View>

            <AccessibleText variant="subtitle" style={{ color: colors.text, textAlign: "center" }}>
              Confirm with your password
            </AccessibleText>

            <AccessibleText
              variant="caption"
              style={{ color: colors.subtext, textAlign: "center", lineHeight: 19 }}
            >
              This erases your profile, messages and personal details immediately and cannot be
              undone. A minimal registration record is kept for 180 days as Indian law requires,
              then destroyed.
            </AccessibleText>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: error ? colors.error : colors.border,
                },
              ]}
              placeholder="Your password"
              placeholderTextColor={colors.subtext}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (error) setError(null);
              }}
              secureTextEntry
              autoCapitalize="none"
              editable={!submitting}
              accessibilityLabel="Password"
            />

            {error && (
              <AccessibleText variant="caption" style={{ color: colors.error }}>
                {error}
              </AccessibleText>
            )}

            <AccessibleButton
              variant="danger"
              accessibilityLabel="Permanently delete my account"
              onPress={handleDelete}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : "Delete my account"}
            </AccessibleButton>

            <AccessibleButton
              variant="secondary"
              accessibilityLabel="Cancel account deletion"
              onPress={onClose}
              disabled={submitting}
            >
              <AccessibleText variant="button" style={{ color: colors.primary }}>
                Keep my account
              </AccessibleText>
            </AccessibleButton>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 24,
  },
  card: { borderRadius: 18, padding: 24, gap: 12 },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
});
