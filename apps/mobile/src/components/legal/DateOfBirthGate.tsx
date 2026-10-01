import React, { useState } from "react";
import { Modal, View, TextInput, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { CalendarDays } from "lucide-react-native";
import { useAuthStore } from "@store/authStore";
import { getMe, submitDateOfBirth } from "@services/authService";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../shared/AccessibleText";
import { AccessibleButton } from "../shared/AccessibleButton";
import {
  isOldEnough,
  latestEligibleBirthDate,
  toApiDate,
  toDisplayDate,
  MINIMUM_AGE,
} from "../../utils/ageValidation";

// ─────────────────────────────────────────────────────────────
// Date of Birth Gate
//
// Accounts created before the age gate have no recorded date of birth, because
// it used to be an optional profile field most people skipped. This asks for it
// once, at the same interception point as policy re-acceptance, so the
// population converges instead of drifting indefinitely.
//
// Under-18 is NOT rejected outright here: the server records the date and
// routes the account to moderation for a human decision. The likeliest cause of
// a surprising date is a typo, and terminating an account over one without
// recourse would be worse than the problem (docs/legal/06 §1.4, §2.4).
// ─────────────────────────────────────────────────────────────

export function DateOfBirthGate() {
  const { colors, highContrast } = useTheme();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [dob, setDob] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Policy re-acceptance takes precedence, so the two gates never stack.
  // Defers to the policy and data-consent gates so they never stack.
  const visible =
    Boolean(user?.dateOfBirthRequired) && !user?.policyReacceptanceRequired && !user?.dataConsentRequired;

  const handleSubmit = async () => {
    if (!dob) {
      setError("Please select your date of birth.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitDateOfBirth(toApiDate(dob));
      if (!result.eligible) {
        // Recorded and referred to a human — tell them what happens next
        // rather than dumping them out of the app.
        setNotice(result.message);
        setSubmitting(false);
        return;
      }
      const refreshed = await getMe();
      setUser(refreshed);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Couldn't save that. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card },
            highContrast && { borderWidth: 2, borderColor: "#000000" },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.surface }]}>
            <CalendarDays size={26} color={colors.primary} strokeWidth={2} />
          </View>

          {notice ? (
            <>
              <AccessibleText variant="subtitle" style={{ color: colors.text, textAlign: "center" }}>
                Thanks — we'll take a look
              </AccessibleText>
              <AccessibleText
                variant="body"
                style={{ color: colors.subtext, textAlign: "center", lineHeight: 21 }}
              >
                {notice}
              </AccessibleText>
            </>
          ) : (
            <>
              <AccessibleText variant="subtitle" style={{ color: colors.text, textAlign: "center" }}>
                One quick thing
              </AccessibleText>
              <AccessibleText
                variant="body"
                style={{ color: colors.subtext, textAlign: "center", lineHeight: 21 }}
              >
                Digiability Community is for people aged {MINIMUM_AGE} and over. Please confirm
                your date of birth to continue.
              </AccessibleText>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setShowPicker(true)}
                accessibilityRole="button"
                accessibilityLabel="Date of birth"
                accessibilityHint={
                  dob ? `Selected: ${toDisplayDate(dob)}. Double tap to change` : "Double tap to choose"
                }
              >
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      color: colors.text,
                      borderColor: error ? colors.error : colors.border,
                    },
                  ]}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={colors.subtext}
                  value={dob ? toDisplayDate(dob) : ""}
                  editable={false}
                  pointerEvents="none"
                />
              </TouchableOpacity>

              {error && (
                <AccessibleText variant="caption" style={{ color: colors.error }}>
                  {error}
                </AccessibleText>
              )}

              {dob && !isOldEnough(dob) && (
                <AccessibleText variant="caption" style={{ color: colors.subtext }}>
                  This date means you're under {MINIMUM_AGE}. We'll review your account before
                  anything happens to it.
                </AccessibleText>
              )}

              <AccessibleButton
                accessibilityLabel="Confirm date of birth"
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : "Confirm"}
              </AccessibleButton>
            </>
          )}

          <DateTimePickerModal
            isVisible={showPicker}
            mode="date"
            date={dob ?? latestEligibleBirthDate()}
            maximumDate={new Date()}
            onConfirm={(date) => {
              setShowPicker(false);
              setDob(date);
              setError(null);
            }}
            onCancel={() => setShowPicker(false)}
          />
        </View>
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
