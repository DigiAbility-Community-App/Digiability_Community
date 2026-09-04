import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../shared/AccessibleText";
import { AlertTriangle, X, Check } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const REPORT_CATEGORIES = [
  "Spam",
  "Harassment",
  "Inappropriate content",
  "Other",
] as const;

export interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details?: string) => void;
  title?: string;
  subtitle?: string;
}

export function ReportModal({
  visible,
  onClose,
  onSubmit,
  title = "Report reason",
  subtitle = "Why are you reporting this message?",
}: ReportModalProps) {
  const { colors, highContrast } = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedCategory, setSelectedCategory] = useState<string>("Spam");
  const [customCategory, setCustomCategory] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (visible) {
      setSelectedCategory("Spam");
      setCustomCategory("");
      setDescription("");
      setErrorMsg("");
    }
  }, [visible]);

  const handleSubmit = () => {
    if (!description.trim()) {
      setErrorMsg("Please describe the issue with this content.");
      return;
    }

    if (selectedCategory === "Other" && !customCategory.trim()) {
      setErrorMsg("Please enter a category name for 'Other'.");
      return;
    }

    const finalReason =
      selectedCategory === "Other"
        ? `Other: ${customCategory.trim()}`
        : selectedCategory;

    onSubmit(finalReason, description.trim());
  };

  const isOther = selectedCategory === "Other";
  const canSubmit =
    description.trim().length > 0 && (!isOther || customCategory.trim().length > 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoid}
          keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.card,
                paddingBottom: Math.max(insets.bottom, 20),
              },
              highContrast && { borderWidth: 2, borderColor: "#000000" },
            ]}
          >
            <View style={styles.handleBar} />

            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <AccessibleText
                  variant="title"
                  style={[styles.title, { color: colors.text }]}
                >
                  {title}
                </AccessibleText>
                <AccessibleText
                  variant="caption"
                  style={[styles.subtitle, { color: colors.subtext }]}
                >
                  {subtitle}
                </AccessibleText>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close report dialog"
              >
                <X size={20} color={colors.subtext} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Category Options */}
              <View style={styles.categoryContainer}>
                {REPORT_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryRow,
                        {
                          backgroundColor: isSelected
                            ? highContrast
                              ? "#000000"
                              : `${colors.primary}12`
                            : colors.surface,
                          borderColor: isSelected
                            ? colors.primary
                            : colors.border,
                        },
                      ]}
                      onPress={() => {
                        setSelectedCategory(cat);
                        setErrorMsg("");
                      }}
                      activeOpacity={0.7}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={cat}
                    >
                      <AccessibleText
                        variant="body"
                        style={[
                          styles.categoryText,
                          {
                            color: isSelected
                              ? highContrast
                                ? "#FFFFFF"
                                : colors.primary
                              : colors.text,
                            fontWeight: isSelected ? "700" : "500",
                          },
                        ]}
                      >
                        {cat}
                      </AccessibleText>
                      {isSelected && (
                        <View
                          style={[
                            styles.checkBadge,
                            { backgroundColor: colors.primary },
                          ]}
                        >
                          <Check size={12} color="#FFFFFF" strokeWidth={3} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom Category Input if 'Other' */}
              {isOther && (
                <View style={styles.inputGroup}>
                  <AccessibleText
                    variant="caption"
                    style={[styles.inputLabel, { color: colors.text }]}
                  >
                    Specify category *
                  </AccessibleText>
                  <TextInput
                    style={[
                      styles.textInputSingle,
                      {
                        backgroundColor: colors.surface,
                        color: colors.text,
                        borderColor:
                          errorMsg && !customCategory.trim()
                            ? colors.error
                            : colors.border,
                      },
                    ]}
                    placeholder="e.g., Copyright violation, Hate speech, etc."
                    placeholderTextColor={colors.subtext}
                    value={customCategory}
                    onChangeText={(text) => {
                      setCustomCategory(text);
                      if (errorMsg) setErrorMsg("");
                    }}
                    maxLength={100}
                    autoCapitalize="sentences"
                    accessibilityLabel="Custom report category"
                  />
                </View>
              )}

              {/* Required Description Input */}
              <View style={styles.inputGroup}>
                <AccessibleText
                  variant="caption"
                  style={[styles.inputLabel, { color: colors.text }]}
                >
                  Describe the issue (compulsory) *
                </AccessibleText>
                <TextInput
                  style={[
                    styles.textInputMulti,
                    {
                      backgroundColor: colors.surface,
                      color: colors.text,
                      borderColor:
                        errorMsg && !description.trim()
                          ? colors.error
                          : colors.border,
                    },
                  ]}
                  placeholder="Please describe why this content violates community guidelines..."
                  placeholderTextColor={colors.subtext}
                  value={description}
                  onChangeText={(text) => {
                    setDescription(text);
                    if (errorMsg) setErrorMsg("");
                  }}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  textAlignVertical="top"
                  accessibilityLabel="Report description"
                />
                <View style={styles.counterRow}>
                  {errorMsg ? (
                    <AccessibleText
                      variant="caption"
                      style={[styles.errorText, { color: colors.error }]}
                    >
                      {errorMsg}
                    </AccessibleText>
                  ) : (
                    <View />
                  )}
                  <AccessibleText
                    variant="overline"
                    style={{ color: colors.subtext }}
                  >
                    {description.length}/500
                  </AccessibleText>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel report"
                >
                  <AccessibleText
                    variant="body"
                    style={[styles.cancelBtnText, { color: colors.subtext }]}
                  >
                    Cancel
                  </AccessibleText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    {
                      backgroundColor: canSubmit
                        ? colors.error || "#EF4444"
                        : `${colors.subtext}40`,
                    },
                  ]}
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                  accessibilityRole="button"
                  accessibilityLabel="Submit report"
                  accessibilityState={{ disabled: !canSubmit }}
                >
                  <AccessibleText
                    variant="body"
                    style={styles.submitBtnText}
                  >
                    Submit Report
                  </AccessibleText>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
  },
  keyboardAvoid: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
  },
  card: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 16,
    paddingHorizontal: 22,
    maxHeight: "92%",
  },
  handleBar: {
    width: 44,
    height: 4,
    backgroundColor: "rgba(150, 150, 150, 0.3)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 3,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
  },
  scrollArea: {
    width: "100%",
  },
  scrollContent: {
    paddingBottom: 60,
  },
  categoryContainer: {
    gap: 8,
    marginBottom: 16,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 14,
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  textInputSingle: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  textInputMulti: {
    minHeight: 80,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  counterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  errorText: {
    fontSize: 11,
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  submitBtn: {
    flex: 1.4,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
