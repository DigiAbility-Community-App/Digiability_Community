import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SafeScreen from "../../components/layout/SafeScreen";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { chatService } from "../../services/chatService";
import { useTheme } from "../../theme/ThemeContext";

const CreateCareCircleScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, spacing } = useTheme();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState("");

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
    setNameError("");
    return true;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await chatService.createCareCircle(name.trim(), description.trim(), []);
      navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingHorizontal: spacing.lg, paddingBottom: 160 }]}
        >
          {/* ICON */}
          <View style={styles.iconBox}>
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
                onChangeText={(v) => { setName(v); if (nameError) setNameError(""); }}
                placeholder="e.g. My Family Circle"
                placeholderTextColor="#9A94A3"
                style={[styles.input, { color: colors.text }]}
                maxLength={50}
                accessibilityLabel="Care circle name"
                accessibilityHint="Enter a name for your care circle, between 3 and 50 characters"
              />
            </View>
            {nameError ? (
              <AccessibleText style={styles.errorText} accessibilityRole="alert">
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

          {/* INFO CARD */}
          <View style={[styles.infoCard, { backgroundColor: "#F3EAFF" }]}>
            <AccessibleText style={[styles.infoText, { color: "#6B21A8" }]}>
              💡 After creating your circle, you can invite family members, caregivers, and professionals from the Groups section in the app.
            </AccessibleText>
          </View>
        </ScrollView>

        {/* FOOTER */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24), backgroundColor: colors.background }]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleCreate}
            disabled={loading}
            style={styles.primaryWrapper}
            accessibilityRole="button"
            accessibilityLabel="Create Care Circle"
            accessibilityHint="Double tap to create your care circle"
            accessibilityState={{ disabled: loading }}
          >
            <LinearGradient
              colors={loading ? ["#9B7AB8", "#9B7AB8"] : ["#500088", "#6B21A8"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButton}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <AccessibleText style={styles.primaryText}>Create Care Circle</AccessibleText>
              )}
            </LinearGradient>
          </TouchableOpacity>

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
      </KeyboardAvoidingView>
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
    backgroundColor: "#F4F3FA",
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
  fieldGroup: {
    width: "100%",
    marginBottom: 20,
  },
  inputRow: {
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
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
    color: "#DC2626",
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
  primaryWrapper: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#500088",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButton: {
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
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
