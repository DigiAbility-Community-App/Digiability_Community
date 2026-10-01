import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SafeScreen from "../../components/layout/SafeScreen";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import { SheetKeyboardAvoidingView } from "../../components/shared/SheetKeyboardAvoidingView";
import { chatService } from "../../services/chatService";
import { useTheme } from "../../theme/ThemeContext";
import { sanitizeNameInput, isValidNameFormat } from "../../utils/nameValidation";
import { recordGuardianAttestation } from "../../services/privacyService";
import { Check } from "lucide-react-native";

// Mirrors RELATION_OPTIONS in EditProfileScreen and the server's
// VALID_RELATIONSHIPS in guardian.service.ts.
const RELATION_OPTIONS = ["Parent", "Guardian", "Sibling", "Spouse", "Child", "Other"];

const CreateCareCircleScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, spacing, highContrast } = useTheme();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState("");

  // Guardian attestation (DPDP §9). A Care Circle often exists precisely
  // because someone is caring for a person who cannot consent for themselves,
  // so the confirmation is captured at the point the circle is created.
  const [caresForOther, setCaresForOther] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [subjectIsMinor, setSubjectIsMinor] = useState(false);
  const [attested, setAttested] = useState(false);
  const [attestError, setAttestError] = useState("");

  const validate = () => {
    if (!name.trim()) {
      setNameError("Care circle name is required.");
      return false;
    }
    if (name.trim().length < 3) {
      setNameError("Name must be at least 3 characters.");
      return false;
    }
    if (name.trim().length > 50) {
      setNameError("Name must be 50 characters or fewer.");
      return false;
    }
    if (!isValidNameFormat(name)) {
      setNameError("Name may only contain letters, spaces, and single hyphens or apostrophes between name parts.");
      return false;
    }
    setNameError("");
    return true;
  };

  const handleCreate = async () => {
    if (!validate()) return;

    if (caresForOther) {
      if (!subjectName.trim()) {
        setAttestError("Please enter the name of the person you care for.");
        return;
      }
      if (!relationship) {
        setAttestError("Please choose your relationship to them.");
        return;
      }
      if (!attested) {
        setAttestError(
          "Please confirm you are their parent or lawful guardian, or have that guardian's permission."
        );
        return;
      }
      setAttestError("");
    }

    setLoading(true);
    try {
      const created = await chatService.createCareCircle(name.trim(), description.trim());

      // Recorded AFTER the circle exists so the attestation can reference it,
      // but posted to user-svc directly from the client rather than having
      // chat-svc call user-svc — the architecture keeps those two services
      // from calling each other at runtime (see CLAUDE.md).
      //
      // Best-effort: a failure here must not strand a Care Circle that was
      // already created. It is a legal attestation record, not an
      // authorisation gate.
      if (caresForOther) {
        try {
          await recordGuardianAttestation({
            subjectName: subjectName.trim(),
            subjectIsMinor,
            relationship,
            conversationId: created.id,
          });
        } catch (attestErr) {
          console.error("[CreateCareCircle] guardian attestation failed:", attestErr);
        }
      }
      // Reset to MainTabs + open the new care circle chat so the user lands directly in it
      navigation.reset({
        index: 1,
        routes: [
          { name: "MainTabs" },
          {
            name: "Chats",
            params: {
              screen: "GroupChat",
              params: {
                conversationId: created.id,
                groupName: created.name,
                subType: "CARE_CIRCLE",
              },
            },
          },
        ],
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ?? "Failed to create care circle. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
  };

  return (
    <SafeScreen bottom={false} statusBarStyle="dark" style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top : 16 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the previous screen"
        >
          <AccessibleText style={[styles.backArrow, { color: colors.secondary }]}>←</AccessibleText>
        </TouchableOpacity>
        <AccessibleText variant="title" style={{ color: colors.secondary }}>
          Create Care Circle
        </AccessibleText>
      </View>

      <SheetKeyboardAvoidingView style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingHorizontal: spacing.lg, paddingBottom: 160 }]}
        >
          {/* ICON */}
          <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
            <AccessibleText style={styles.iconEmoji}>👥</AccessibleText>
          </View>

          <AccessibleText variant="heroTitle" style={[styles.heroTitle, { color: colors.text }]}>
            Name your Care Circle
          </AccessibleText>
          <AccessibleText variant="subtitle" style={{ color: colors.subtext, marginBottom: 32, textAlign: "center" }}>
            Give your circle a name so trusted people know who they're joining.
          </AccessibleText>

          {/* NAME */}
          <View style={styles.fieldGroup}>
            <AccessibleText variant="label" style={{ color: colors.subtext, marginBottom: 8 }}>
              CIRCLE NAME *
            </AccessibleText>
            <View style={[styles.inputRow, { backgroundColor: colors.surface }]}>
              <TextInput
                value={name}
                onChangeText={(v) => { setName(sanitizeNameInput(v)); if (nameError) setNameError(""); }}
                placeholder="e.g. My Family Circle"
                placeholderTextColor="#9A94A3"
                style={[styles.input, { color: colors.text }]}
                maxLength={50}
                accessibilityLabel="Care circle name"
                accessibilityHint="Enter a name for your care circle, between 3 and 50 characters"
              />
            </View>
            {nameError ? (
              <AccessibleText style={[styles.errorText, { color: colors.error }]} accessibilityRole="alert">
                {nameError}
              </AccessibleText>
            ) : null}
          </View>

          {/* DESCRIPTION */}
          <View style={styles.fieldGroup}>
            <AccessibleText variant="label" style={{ color: colors.subtext, marginBottom: 8 }}>
              DESCRIPTION (OPTIONAL)
            </AccessibleText>
            <View style={[styles.textAreaRow, { backgroundColor: colors.surface }]}>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="e.g. Emergency contacts and daily caregivers"
                placeholderTextColor="#9A94A3"
                style={[styles.textArea, { color: colors.text }]}
                maxLength={200}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                accessibilityLabel="Care circle description"
                accessibilityHint="Optional. Describe the purpose of your care circle, up to 200 characters"
              />
            </View>
            <AccessibleText style={[styles.charCount, { color: colors.subtext }]}>
              {description.length}/200
            </AccessibleText>
          </View>

          {/* GUARDIAN ATTESTATION — DPDP Act 2023 §9 */}
          <View style={styles.fieldGroup}>
            <TouchableOpacity
              onPress={() => { setCaresForOther((v) => !v); setAttestError(""); }}
              style={styles.checkRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: caresForOther }}
              accessibilityLabel="This circle is for someone I care for"
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: caresForOther ? colors.primary : colors.border,
                    backgroundColor: caresForOther ? colors.primary : "transparent",
                  },
                ]}
              >
                {caresForOther && <Check size={14} color="#fff" strokeWidth={3} />}
              </View>
              <AccessibleText variant="body" style={{ flex: 1, color: colors.text }}>
                This circle is for someone I care for
              </AccessibleText>
            </TouchableOpacity>

            {caresForOther && (
              <View style={{ marginTop: 14, gap: 12 }}>
                <View>
                  <AccessibleText variant="label" style={{ color: colors.subtext, marginBottom: 8 }}>
                    THEIR NAME *
                  </AccessibleText>
                  <View style={[styles.inputRow, { backgroundColor: colors.surface }]}>
                    <TextInput
                      value={subjectName}
                      onChangeText={(v) => { setSubjectName(v); setAttestError(""); }}
                      placeholder="Who are you caring for?"
                      placeholderTextColor="#9A94A3"
                      style={[styles.input, { color: colors.text }]}
                      maxLength={80}
                      accessibilityLabel="Name of the person you care for"
                    />
                  </View>
                </View>

                <View>
                  <AccessibleText variant="label" style={{ color: colors.subtext, marginBottom: 8 }}>
                    YOUR RELATIONSHIP TO THEM *
                  </AccessibleText>
                  <View style={styles.chipRow}>
                    {RELATION_OPTIONS.map((opt) => {
                      const selected = relationship === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => { setRelationship(opt); setAttestError(""); }}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: selected ? colors.primary : colors.surface,
                              borderColor: selected ? colors.primary : colors.border,
                            },
                          ]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          accessibilityLabel={opt}
                        >
                          <AccessibleText
                            variant="caption"
                            style={{ color: selected ? "#fff" : colors.text, fontWeight: "600" }}
                          >
                            {opt}
                          </AccessibleText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setSubjectIsMinor((v) => !v)}
                  style={styles.checkRow}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: subjectIsMinor }}
                  accessibilityLabel="They are under 18"
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: subjectIsMinor ? colors.primary : colors.border,
                        backgroundColor: subjectIsMinor ? colors.primary : "transparent",
                      },
                    ]}
                  >
                    {subjectIsMinor && <Check size={14} color="#fff" strokeWidth={3} />}
                  </View>
                  <AccessibleText variant="body" style={{ flex: 1, color: colors.text }}>
                    They are under 18
                  </AccessibleText>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { setAttested((v) => !v); setAttestError(""); }}
                  style={styles.checkRow}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: attested }}
                  accessibilityLabel="I confirm I am their parent or lawful guardian, or have that guardian's permission"
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: attested ? colors.primary : colors.border,
                        backgroundColor: attested ? colors.primary : "transparent",
                      },
                    ]}
                  >
                    {attested && <Check size={14} color="#fff" strokeWidth={3} />}
                  </View>
                  <AccessibleText variant="caption" style={{ flex: 1, color: colors.text, lineHeight: 19 }}>
                    I confirm I am their parent or lawful guardian, or that I have that guardian's
                    permission. Indian data protection law requires this before we may hold their
                    information.
                  </AccessibleText>
                </TouchableOpacity>

                {attestError ? (
                  <AccessibleText style={[styles.errorText, { color: colors.error }]} accessibilityRole="alert">
                    {attestError}
                  </AccessibleText>
                ) : null}
              </View>
            )}
          </View>

          {/* INFO CARD */}
          <View style={[styles.infoCard, { backgroundColor: highContrast ? colors.surface : "#F3EAFF" }, highContrast && { borderWidth: 1, borderColor: "#000000" }]}>
            <AccessibleText style={[styles.infoText, { color: colors.secondary }]}>
              💡 After creating your circle, you can invite family members, caregivers, and professionals from the Groups section in the app.
            </AccessibleText>
          </View>
        </ScrollView>

        {/* FOOTER */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24), backgroundColor: colors.background }]}>
          <AccessibleButton
            onPress={handleCreate}
            disabled={loading}
            style={styles.primaryButton}
            accessibilityLabel="Create Care Circle"
            accessibilityHint="Double tap to create your care circle"
          >
            {loading ? <ActivityIndicator color={colors.white} /> : "Create Care Circle"}
          </AccessibleButton>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleSkip}
            style={styles.skipButton}
            accessibilityRole="button"
            accessibilityLabel="Skip for now"
            accessibilityHint="Double tap to skip care circle creation and go to the main app"
          >
            <AccessibleText style={[styles.skipText, { color: colors.subtext }]}>
              Skip for now
            </AccessibleText>
          </TouchableOpacity>
        </View>
      </SheetKeyboardAvoidingView>
    </SafeScreen>
  );
};

export default CreateCareCircleScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  backArrow: {
    fontSize: 22,
    fontWeight: "700",
  },
  content: {
    paddingTop: 8,
    alignItems: "center",
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  iconEmoji: {
    fontSize: 36,
  },
  heroTitle: {
    textAlign: "center",
    marginBottom: 8,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  fieldGroup: {
    width: "100%",
    marginBottom: 20,
  },
  inputRow: {
    borderRadius: 16,
    paddingHorizontal: 16,
    minHeight: 56,
    justifyContent: "center",
  },
  textAreaRow: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 100,
  },
  input: {
    fontSize: 16,
    fontWeight: "500",
  },
  textArea: {
    fontSize: 15,
    lineHeight: 22,
  },
  charCount: {
    fontSize: 11,
    marginTop: 4,
    textAlign: "right",
  },
  errorText: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  infoCard: {
    width: "100%",
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 20,
    shadowColor: "#500088",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  skipButton: {
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  skipText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
