import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { LayoutGrid, Wrench, Sparkles, MapPin, ArrowRight, HeartHandshake } from "lucide-react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const UPCOMING_SERVICES = [
  {
    id: "therapists",
    icon: "🏥",
    title: "Verified Therapist Network",
    description: "Book home or clinic visits with certified occupational, speech, and physical therapists.",
    tag: "Verified Providers",
  },
  {
    id: "assistance",
    icon: "🦽",
    title: "Assistive Aids & Rental",
    description: "Rent or purchase wheelchairs, sensory tools, and specialized equipment near you.",
    tag: "Local Delivery",
  },
  {
    id: "ngo-support",
    icon: "🤝",
    title: "NGO Care Programs",
    description: "Connect with verified NGOs and government support programs in your state.",
    tag: "Free & Assisted",
  },
];

export const ServicesScreen = () => {
  const navigation = useNavigation<any>();
  const { colors, spacing, highContrast } = useTheme();
  const [isSubscribed, setIsSubscribed] = useState(false);

  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };

  const handleNotifyToggle = () => {
    setIsSubscribed(!isSubscribed);
  };

  const handleReturnHome = () => {
    navigation.navigate("Home");
  };

  return (
    <ScreenWrapper>
      {/* HEADER */}
      <AppHeader title="Professional Services" hideBackButton={true} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === "ios" ? 150 : 120 }]}
      >
        {/* HERO CARD */}
        <LinearGradient
          colors={highContrast ? ["#000000", "#000000"] : ["#500088", "#7E22CE"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.heroCard,
            highContrast && { borderWidth: 2, borderColor: "#FFFFFF" },
          ]}
        >
          <View style={styles.heroContent}>
            <View style={[styles.heroIconBg, { backgroundColor: "rgba(255, 255, 255, 0.15)" }]}>
              <LayoutGrid color="#FFFFFF" size={32} strokeWidth={2} />
            </View>
            <View style={styles.heroTextContainer}>
              <AccessibleText variant="heroTitle" style={{ color: "#FFFFFF", fontSize: 24, lineHeight: 30 }}>
                Services Hub
              </AccessibleText>
              <AccessibleText variant="body" style={{ color: "rgba(255,255,255,0.85)", marginTop: 4 }}>
                Find verified support and resources in your area.
              </AccessibleText>
            </View>
          </View>
        </LinearGradient>

        {/* STATUS CARD */}
        <View style={[styles.statusCard, { backgroundColor: colors.card }, cardBorder]}>
          <View style={[styles.iconWrapper, { backgroundColor: highContrast ? "#FFFFFF" : "#F4F3FA" }]}>
            <Wrench color={colors.primary} size={28} />
          </View>
          <AccessibleText variant="title" style={{ textAlign: "center", marginTop: spacing.md }}>
            Currently Under Development
          </AccessibleText>
          <AccessibleText variant="body" style={{ color: colors.subtext, textAlign: "center", marginTop: spacing.sm, lineHeight: 22 }}>
            We are hard at work building a secure directory of professional caregivers, therapists, and certified equipment vendors to offer you reliable assistance.
          </AccessibleText>
        </View>

        {/* NOTIFY BLOCK */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleNotifyToggle}
          style={[
            styles.notifyCard,
            { backgroundColor: isSubscribed ? (highContrast ? "#000000" : "#F0FDF4") : colors.card },
            cardBorder,
            isSubscribed && !highContrast && { borderColor: "#BBF7D0", borderWidth: 1 }
          ]}
          accessibilityRole="button"
          accessibilityLabel={isSubscribed ? "Subscribed to notifications. Tap to unsubscribe." : "Tap to get notified when services launch."}
          accessibilityHint="Double tap to toggle notifications subscription for this feature."
        >
          <View style={styles.notifyRow}>
            <View style={styles.notifyText}>
              <AccessibleText variant="title" style={{ fontSize: 16, color: isSubscribed && !highContrast ? "#166534" : colors.text }}>
                {isSubscribed ? "🔔 You're on the list!" : "📩 Get Notified When Ready"}
              </AccessibleText>
              <AccessibleText variant="caption" style={{ color: isSubscribed && !highContrast ? "#166534" : colors.subtext, marginTop: 2 }}>
                {isSubscribed ? "We will alert you as soon as verified partners launch." : "Be the first to know when services are available."}
              </AccessibleText>
            </View>
            <View style={[
              styles.notifyBadge,
              { backgroundColor: isSubscribed ? "#16A34A" : colors.primary }
            ]}>
              <AccessibleText variant="caption" style={{ color: "#FFFFFF", fontWeight: "700" }}>
                {isSubscribed ? "Subscribed" : "Notify Me"}
              </AccessibleText>
            </View>
          </View>
        </TouchableOpacity>

        {/* UPCOMING SHOWCASE */}
        <AccessibleText variant="label" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
          UPCOMING CAPABILITIES
        </AccessibleText>

        {UPCOMING_SERVICES.map((service) => (
          <View
            key={service.id}
            style={[styles.featureCard, { backgroundColor: colors.card }, cardBorder]}
          >
            <View style={[styles.featureHeader]}>
              <View style={styles.featureIconContainer}>
                <AccessibleText style={{ fontSize: 26 }}>{service.icon}</AccessibleText>
              </View>
              <View style={styles.featureTitleContainer}>
                <AccessibleText variant="title" style={{ fontSize: 16 }}>
                  {service.title}
                </AccessibleText>
                <View style={[styles.tag, { backgroundColor: highContrast ? "#000000" : "#F3E8FF" }, highContrast && { borderWidth: 1, borderColor: "#000000" }]}>
                  <AccessibleText variant="caption" style={{ color: highContrast ? "#FFFFFF" : colors.primary, fontSize: 10, fontWeight: "700" }}>
                    {service.tag}
                  </AccessibleText>
                </View>
              </View>
            </View>
            <AccessibleText variant="body" style={{ color: colors.subtext, marginTop: spacing.sm, lineHeight: 20 }}>
              {service.description}
            </AccessibleText>
          </View>
        ))}

        {/* RETURN BUTTON */}
        <AccessibleButton
          accessibilityLabel="Return to Home Dashboard"
          accessibilityHint="Navigates back to the main Home screen"
          onPress={handleReturnHome}
          style={{ marginTop: spacing.xl }}
        >
          Return to Dashboard
        </AccessibleButton>
      </ScrollView>
    </ScreenWrapper>
  );
};

export default ServicesScreen;

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 16,
    paddingHorizontal: 24,
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#500088",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  heroContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroIconBg: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  heroTextContainer: {
    flex: 1,
  },
  statusCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  notifyCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  notifyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notifyText: {
    flex: 1,
    marginRight: 12,
  },
  notifyBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  featureCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  featureHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  featureTitleContainer: {
    flex: 1,
    gap: 4,
    flexDirection: "column",
    alignItems: "flex-start",
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
});
