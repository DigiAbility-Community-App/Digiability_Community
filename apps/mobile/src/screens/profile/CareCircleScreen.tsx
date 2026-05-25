import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

  const handleCreate = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "Home" }],
    });
  };

  const handleSkip = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "Home" }],
    });
  };

  return (
    <ScreenWrapper>
      {/* HERO SECTION — extends under translucent status bar naturally */}
      <LinearGradient
        colors={["#500088", "#6B21A8"]}
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
          <View style={styles.tickWrapper}>
            <View
              style={[
                styles.tickArm,
                {
                  width: 14,
                  transform: [
                    { rotate: "45deg" },
                    { translateY: 3 },
                  ],
                },
              ]}
            />

            <View
              style={[
                styles.tickArm,
                {
                  width: 30,
                  transform: [
                    { rotate: "-55deg" },
                    { translateY: -5 },
                  ],
                },
              ]}
            />
          </View>
        </View>

        {/* Text */}
        <Text style={styles.heroTitle}>
          Welcome to{"\n"}DigiAbility!
        </Text>

        <Text style={styles.heroSubtitle}>
          Your profile is complete
        </Text>
      </LinearGradient>

      {/* WHITE CARD */}
      <ScrollView
        style={styles.cardScroll}
        contentContainerStyle={styles.cardContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {/* Icon */}
          <View style={styles.iconBox}>
            <Text style={styles.iconEmoji}>👥</Text>
          </View>

          {/* Heading */}
          <View style={styles.textBlock}>
            <Text style={styles.cardTitle}>
              Create Your Care Circle
            </Text>

            <Text style={styles.cardDescription}>
              Invite trusted people — family,
              friends, or caregivers — to support
              you. Together you stay safer,
              informed, and connected.
            </Text>
          </View>

          {/* Features */}
          <View style={styles.featureList}>
            {FEATURES.map((f) => (
              <View
                key={f.id}
                style={styles.featureRow}
              >
                <View style={styles.featureIconBg}>
                  <Text style={styles.featureIcon}>
                    {f.icon}
                  </Text>
                </View>

                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>
                    {f.title}
                  </Text>

                  <Text style={styles.featureDesc}>
                    {f.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* ACTIONS */}
          <View style={styles.actions}>
            {/* PRIMARY */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleCreate}
              style={styles.primaryWrapper}
            >
              <LinearGradient
                colors={["#500088", "#6B21A8"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryText}>
                  Create Care Circle
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* SKIP */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleSkip}
              style={styles.skipButton}
            >
              <Text style={styles.skipText}>
                Maybe Later
              </Text>
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
    backgroundColor: "#500088",
    borderRadius: 2,
    marginHorizontal: 1,
  },

  heroTitle: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.8,
    marginBottom: 8,

    fontFamily: "PlusJakartaSans-Bold",
  },

  heroSubtitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",

    fontFamily: "PlusJakartaSans-Regular",
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
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#F4F3FA",
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
    fontSize: 24,
    fontWeight: "700",
    color: "#1A1B20",
    letterSpacing: -0.6,
    textAlign: "center",

    fontFamily: "PlusJakartaSans-Bold",
  },

  cardDescription: {
    fontSize: 16,
    lineHeight: 26,
    color: "#4C4452",
    textAlign: "center",

    fontFamily: "PlusJakartaSans-Regular",
  },

  // FEATURES
  featureList: {
    gap: 16,
    marginBottom: 48,
  },

  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F4F3FA",
    borderRadius: 24,
    padding: 16,
    gap: 16,
  },

  featureIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
  },

  featureIcon: {
    color: "#059669",
    fontSize: 16,
    fontWeight: "900",
  },

  featureText: {
    flex: 1,
    gap: 4,
  },

  featureTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1B20",

    fontFamily: "PlusJakartaSans-Bold",
  },

  featureDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: "#4C4452",

    fontFamily: "PlusJakartaSans-Regular",
  },

  // ACTIONS
  actions: {
    gap: 16,
  },

  primaryWrapper: {
    borderRadius: 24,
    overflow: "hidden",

    shadowColor: "#500088",
    shadowOpacity: 0.25,
    shadowRadius: 15,
    shadowOffset: {
      width: 0,
      height: 10,
    },

    elevation: 8,
  },

  primaryButton: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },

  primaryText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",

    fontFamily: "PlusJakartaSans-Bold",
  },

  skipButton: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },

  skipText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#7E7383",

    fontFamily: "PlusJakartaSans-Regular",
  },
});