import React from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import { useTheme, getFontScale } from "../../theme/ThemeContext";

import { Check } from "lucide-react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const FEATURES = [
  {
    id: "easy",
    icon: "✓",
    title: "Easy Check-in",
    description: "Share health updates with your circle instantly",
  },
  {
    id: "alert",
    icon: "✓",
    title: "Quick Help Alert",
    description: "Send an SOS to trusted contacts in one tap",
  },
  {
    id: "card",
    icon: "✓",
    title: "Medical Card",
    description:
      "Store emergency info & share it securely with caregivers",
  },
];

const CareCircleScreen = () => {
  const navigation = useNavigation<any>();
  const { colors, highContrast, textSize } = useTheme();
  const fs = getFontScale(textSize);

  const handleCreate = () => {
    navigation.navigate("CreateCareCircle");
  };

  const handleSkip = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "MainTabs" }],
    });
  };

  return (
    <ScreenWrapper>
      {/* HERO SECTION — extends under translucent status bar naturally */}
      <LinearGradient
        colors={highContrast ? ["#000000", "#000000"] : ["#500088", "#6B21A8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: useSafeAreaInsets().top }]}
      >
        {/* Decorative blobs */}
        <View style={styles.blobTopRight} />
        <View style={styles.blobBottomLeft} />

        {/* Success Circle */}
        <View style={styles.checkCircleShadow} />

        <View style={styles.checkCircle}>
          <Check size={42} color={colors.primary} strokeWidth={3.5} />
        </View>

        {/* Text */}
        <AccessibleText
          style={[styles.heroTitle, { fontSize: fs(32), lineHeight: fs(40), color: "#FFFFFF" }]}
          accessibilityRole="header"
        >
          Welcome to{"\n"}DigiAbility!
        </AccessibleText>

        <AccessibleText style={[styles.heroSubtitle, { fontSize: fs(16), color: "rgba(255,255,255,0.8)" }]}>
          Your profile is complete
        </AccessibleText>
      </LinearGradient>

      {/* WHITE CARD */}
      <ScrollView
        style={styles.cardScroll}
        contentContainerStyle={styles.cardContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.card }, highContrast && { borderTopWidth: 2, borderLeftWidth: 2, borderRightWidth: 2, borderColor: "#000000" }]}>
          {/* Icon */}
          <View style={[styles.iconBox, { backgroundColor: colors.surface }]}>
            <AccessibleText style={styles.iconEmoji}>👥</AccessibleText>
          </View>

          {/* Heading */}
          <View style={styles.textBlock}>
            <AccessibleText
              style={[styles.cardTitle, { fontSize: fs(24), color: colors.text }]}
              accessibilityRole="header"
            >
              Create Your Care Circle
            </AccessibleText>

            <AccessibleText style={[styles.cardDescription, { fontSize: fs(16), lineHeight: fs(26), color: colors.subtext }]}>
              Invite trusted people — family, friends, or caregivers — to support you. Together you stay safer, informed, and connected.
            </AccessibleText>
          </View>

          {/* Features */}
          <View style={styles.featureList}>
            {FEATURES.map((f) => (
              <View
                key={f.id}
                style={[styles.featureRow, { backgroundColor: colors.surface }, highContrast && { borderWidth: 1, borderColor: "#000000" }]}
              >
                <View style={[styles.featureIconBg, { backgroundColor: highContrast ? "#FFFFFF" : "#ECFDF5" }, highContrast && { borderWidth: 1, borderColor: "#000000" }]}>
                  <AccessibleText style={[styles.featureIcon, { color: highContrast ? "#000000" : "#059669" }]}>
                    {f.icon}
                  </AccessibleText>
                </View>

                <View style={styles.featureText}>
                  <AccessibleText style={[styles.featureTitle, { fontSize: fs(16), color: colors.text }]}>{f.title}</AccessibleText>
                  <AccessibleText style={[styles.featureDesc, { fontSize: fs(14), lineHeight: fs(20), color: colors.subtext }]}>{f.description}</AccessibleText>
                </View>
              </View>
            ))}
          </View>

          {/* ACTIONS */}
          <View style={styles.actions}>
            {/* PRIMARY */}
            <AccessibleButton
              style={styles.primaryButton}
              onPress={handleCreate}
              accessibilityLabel="Create Care Circle"
              accessibilityHint="Double tap to set up your care circle and invite trusted contacts"
            >
              Create Care Circle
            </AccessibleButton>

            {/* SKIP */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleSkip}
              style={styles.skipButton}
              accessibilityRole="button"
              accessibilityLabel="Maybe Later"
              accessibilityHint="Double tap to skip and go to the main app. You can create a care circle later."
            >
              <AccessibleText style={[styles.skipText, { color: colors.subtext }]}>Maybe Later</AccessibleText>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
};

export default CareCircleScreen;

const HERO_HEIGHT = 340;
const CARD_OVERLAP = 40;

const styles = StyleSheet.create({
  // Outer container managed by ScreenWrapper (no explicit root style needed)
  hero: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  blobTopRight: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    right: -60,
    top: -60,
  },

  blobBottomLeft: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    left: -40,
    bottom: -40,
  },

  checkCircleShadow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.002)",
    shadowColor: "#500088",
    shadowOpacity: 0.2,
    shadowRadius: 50,
    shadowOffset: {
      width: 0,
      height: 25,
    },
    elevation: 16,
  },

  checkCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },

  tickWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 6,
  },

  tickArm: {
    height: 4,
    borderRadius: 2,
    marginHorizontal: 1,
  },

  heroTitle: {
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.8,
    marginBottom: 8,
  },

  heroSubtitle: {
    fontWeight: "500",
    textAlign: "center",
  },

  // CARD
  cardScroll: {
    flex: 1,
    marginTop: -CARD_OVERLAP,
  },

  cardContent: {
    flexGrow: 1,
  },

  card: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 40,
    paddingHorizontal: 24,
    paddingBottom: 48,
    minHeight: "100%",

    shadowColor: "#500088",
    shadowOpacity: 0.1,
    shadowRadius: 40,
    shadowOffset: {
      width: 0,
      height: -12,
    },

    elevation: 12,
  },

  // ICON
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 24,
  },

  iconEmoji: {
    fontSize: 36,
  },

  // TEXT
  textBlock: {
    marginBottom: 40,
    gap: 12,
  },

  cardTitle: {
    fontWeight: "700",
    letterSpacing: -0.6,
    textAlign: "center",
  },

  cardDescription: {
    textAlign: "center",
  },

  // FEATURES
  featureList: {
    gap: 16,
    marginBottom: 48,
  },

  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 24,
    padding: 16,
    gap: 16,
  },

  featureIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  featureIcon: {
    fontSize: 16,
    fontWeight: "900",
  },

  featureText: {
    flex: 1,
    gap: 4,
  },

  featureTitle: {
    fontWeight: "700",
  },

  featureDesc: {},

  // ACTIONS
  actions: {
    gap: 16,
  },

  primaryButton: {
    minHeight: 60,
    borderRadius: 24,
    shadowColor: "#500088",
    shadowOpacity: 0.25,
    shadowRadius: 15,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 8,
  },

  skipButton: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },

  skipText: {
    fontWeight: "600",
  },
});
