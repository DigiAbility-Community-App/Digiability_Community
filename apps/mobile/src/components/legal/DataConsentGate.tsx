import React, { useState } from "react";
import { Alert, Modal, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@store/authStore";
import { updateConsent } from "@services/privacyService";
import { getMe, logout } from "@services/authService";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../shared/AccessibleText";
import { ConsentNoticeContent } from "./ConsentNoticeContent";
import { DeleteAccountModal } from "../account/DeleteAccountModal";
import { confirmDeleteAccount } from "../../utils/accountDeletion";

// ─────────────────────────────────────────────────────────────
// Data-processing consent gate (DPDP §5/§6).
//
// Shown when /api/auth/me reports dataConsentRequired: the account has not
// consented to the CURRENT data-processing notice. That includes every account
// created before the notice existed (their consent was bundled with the Terms
// checkbox), and everyone again whenever CONSENT_NOTICE_VERSION is bumped.
//
// Not dismissable. The service can't run without this consent, so the only
// alternatives to agreeing are logging out (decide later) or deleting the
// account. Defers to PolicyReacceptanceGate so the two never stack.
// ─────────────────────────────────────────────────────────────

export function DataConsentGate() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);

  const visible =
    Boolean(user?.dataConsentRequired) && !user?.policyReacceptanceRequired && !showDelete;

  const handleAgree = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateConsent("DATA_PROCESSING", true);
      // Re-read from the server so the client can't disagree with the record.
      setUser(await getMe());
    } catch {
      setError("We couldn't record your consent just now. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      "We need your consent to continue",
      "Without consent to process your data we can't keep running your account. You can log out and decide later, or delete your account and its data.",
      [
        { text: "Review the notice again", style: "cancel" },
        { text: "Log out", onPress: () => logout().catch(() => {}) },
        {
          text: "Delete my account",
          style: "destructive",
          onPress: () => confirmDeleteAccount({ onConfirmed: () => setShowDelete(true) }),
        },
      ]
    );
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleDecline}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
            <AccessibleText variant="subtitle" style={{ color: colors.text }} accessibilityRole="header">
              Please review how we use your data
            </AccessibleText>
            <AccessibleText variant="caption" style={{ color: colors.subtext, marginTop: 4 }}>
              We now ask for this consent separately from our Terms. Nothing about your account
              changes until you choose.
            </AccessibleText>
          </View>
          <ConsentNoticeContent
            agreeLabel="I agree — continue"
            declineLabel="I don't agree"
            busy={busy}
            error={error}
            onAgree={handleAgree}
            onDecline={handleDecline}
          />
        </SafeAreaView>
      </Modal>
      {/* Closing the delete flow without deleting brings the gate back. */}
      <DeleteAccountModal visible={showDelete} onClose={() => setShowDelete(false)} />
    </>
  );
}
