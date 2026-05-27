import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Share,
} from "react-native";
import {
  Calendar,
  MapPin,
  Users,
  Share2,
  AlertCircle,
  Accessibility as AccessIcon,
  ChevronLeft,
} from "lucide-react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import AppFooter from "../../components/layout/AppFooter";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import { fetchEventById, EventModel } from "../../services/eventService";

export default function EventDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { colors, spacing, highContrast } = useTheme();
  
  const { eventId } = route.params || {};
  const [event, setEvent] = useState<EventModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (eventId) {
      loadEventDetails();
    }
  }, [eventId]);

  const loadEventDetails = async () => {
    try {
      setLoading(true);
      const data = await fetchEventById(eventId);
      setEvent(data);
    } catch (error) {
      console.log("Failed to load event details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!event) return;
    try {
      await Share.share({
        message: `Check out this event: ${event.title}\nDate: ${event.date}\nLocation: ${event.location}\nShared via DigiAbility Community.`,
      });
    } catch (error) {
      console.log("Failed to share event:", error);
    }
  };

  const handleRegisterPress = () => {
    if (!event) return;
    navigation.navigate("LeavePortal", {
      eventId: event.id,
      externalUrl: event.externalUrl,
      eventTitle: event.title,
    });
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <AppHeader title="Event Details" />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AccessibleText variant="body" style={{ color: colors.primary, marginTop: spacing.xs }}>
            Loading event details...
          </AccessibleText>
        </View>
      </ScreenWrapper>
    );
  }

  if (!event) {
    return (
      <ScreenWrapper>
        <AppHeader title="Event Details" />
        <View style={styles.centerContainer}>
          <AlertCircle color={colors.error} size={48} />
          <AccessibleText variant="title" style={{ fontSize: 18, marginTop: spacing.sm }}>
            Event Not Found
          </AccessibleText>
          <AccessibleText variant="body" style={{ color: colors.subtext, textAlign: "center", marginTop: 4, paddingHorizontal: 40 }}>
            We couldn't retrieve the details for this event. It may have been cancelled or deleted by the admin.
          </AccessibleText>
          <AccessibleButton
            accessibilityLabel="Go back to previous screen"
            onPress={() => navigation.goBack()}
            style={{ marginTop: spacing.md }}
          >
            Go Back
          </AccessibleButton>
        </View>
      </ScreenWrapper>
    );
  }

  const borderStyle = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };

  // Generate appropriate accessibility accommodations summary based on category
  const getAccommodations = (category: string) => {
    switch (category) {
      case "Medical Support":
        return ["Wheelchair Accessible Entrance", "Accessible Restrooms", "Medical Care Assistant On-Site"];
      case "Skill Training":
        return ["Sign Language Interpreter (ASL/ISL)", "Screen Reader Friendly Slides", "Assisted Companion Seating"];
      case "Legal Aid":
        return ["Legal Document Templates in Braille", "Quiet Room Accommodation", "One-on-One Legal Counsel"];
      case "Assistive Technology":
        return ["Device Hand-on Trials", "Technician Support Support", "Audio Guides Available"];
      default:
        return ["Wheelchair Accessible Venue", "Helper Companion Passes Free", "Captioning Enabled (For Virtual)"];
    }
  };

  return (
    <ScreenWrapper>
      {/* HEADER */}
      <AppHeader
        title="Event Details"
        rightActions={
          <TouchableOpacity
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share event details"
            style={styles.headerShareButton}
          >
            <Share2 color="#fff" size={22} />
          </TouchableOpacity>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* EVENT BANNER */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: event.image }} style={styles.bannerImage} />
          <View style={[
            styles.categoryBadgeOverlay,
            { backgroundColor: highContrast ? "#000000" : colors.primary }
          ]}>
            <AccessibleText variant="overline" style={{ color: "#FFFFFF", fontWeight: "800" }}>
              {event.category}
            </AccessibleText>
          </View>
        </View>

        {/* TITLE & ORGANIZER */}
        <View style={styles.titleSection}>
          <AccessibleText variant="heroTitle" style={[styles.mainTitle, { color: colors.text }]}>
            {event.title}
          </AccessibleText>
          
          <AccessibleText variant="caption" style={{ color: colors.subtext }}>
            Hosted by <AccessibleText style={{ fontWeight: "700", color: colors.primary }}>DigiAbility Admin Network</AccessibleText>
          </AccessibleText>
        </View>

        {/* METADATA GRID CARD */}
        <View style={[styles.metaCard, { backgroundColor: colors.card }, borderStyle]}>
          {/* DATE & TIME */}
          <View style={styles.metaRow}>
            <View style={[styles.iconIconBg, { backgroundColor: highContrast ? "#000000" : "#F5F3FF" }]}>
              <Calendar color={highContrast ? "#FFFFFF" : colors.primary} size={22} />
            </View>
            <View style={styles.metaTextContainer}>
              <AccessibleText variant="title" style={{ fontSize: 15, fontWeight: "700" }}>
                Date & Time
              </AccessibleText>
              <AccessibleText variant="body" style={{ color: colors.subtext, marginTop: 2 }}>
                {event.date} {event.time ? `• ${event.time}` : ""}
              </AccessibleText>
            </View>
          </View>

          {/* LOCATION */}
          <View style={[styles.metaRow, styles.metaRowBorder, { borderColor: colors.border }]}>
            <View style={[styles.iconIconBg, { backgroundColor: highContrast ? "#000000" : "#FEF3C7" }]}>
              <MapPin color={highContrast ? "#FFFFFF" : "#D97706"} size={22} />
            </View>
            <View style={styles.metaTextContainer}>
              <AccessibleText variant="title" style={{ fontSize: 15, fontWeight: "700" }}>
                Location
              </AccessibleText>
              <AccessibleText variant="body" style={{ color: colors.subtext, marginTop: 2 }}>
                {event.location}
              </AccessibleText>
            </View>
          </View>

          {/* SEATS AVAILABILITY */}
          <View style={[styles.metaRow, styles.metaRowBorder, { borderColor: colors.border }]}>
            <View style={[styles.iconIconBg, { backgroundColor: highContrast ? "#000000" : "#FEE2E2" }]}>
              <Users color={highContrast ? "#FFFFFF" : colors.error} size={22} />
            </View>
            <View style={styles.metaTextContainer}>
              <AccessibleText variant="title" style={{ fontSize: 15, fontWeight: "700" }}>
                Availability
              </AccessibleText>
              <AccessibleText variant="body" style={{ color: colors.error, fontWeight: "700", marginTop: 2 }}>
                {event.spots > 0 ? `${event.spots} Slots Remaining` : "Sold Out"}
              </AccessibleText>
            </View>
          </View>
        </View>

        {/* EVENT DESCRIPTION */}
        <View style={styles.sectionContainer}>
          <AccessibleText variant="label" style={{ marginBottom: spacing.sm }}>
            PROGRAM DESCRIPTION
          </AccessibleText>
          <AccessibleText variant="body" style={[styles.descriptionText, { color: colors.text }]}>
            {event.description}
          </AccessibleText>
        </View>

        {/* ACCESSIBILITY ACCOMMODATIONS */}
        <View style={styles.sectionContainer}>
          <AccessibleText variant="label" style={{ marginBottom: spacing.sm }}>
            ACCESSIBILITY ACCOMMODATIONS
          </AccessibleText>
          <View style={[styles.accommodationsCard, { backgroundColor: colors.card }, borderStyle]}>
            <View style={styles.accommodationsHeader}>
              <AccessIcon color={colors.primary} size={20} />
              <AccessibleText variant="title" style={{ fontSize: 14, fontWeight: "700", marginLeft: 8 }}>
                Accommodations Provided
              </AccessibleText>
            </View>
            <View style={styles.bulletList}>
              {getAccommodations(event.category).map((acc, index) => (
                <View key={index} style={styles.bulletRow}>
                  <AccessibleText style={[styles.bulletDot, { color: colors.primary }]}>•</AccessibleText>
                  <AccessibleText variant="body" style={[styles.bulletText, { color: colors.subtext }]}>
                    {acc}
                  </AccessibleText>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* REGISTER CALL TO ACTION */}
        <View style={styles.buttonContainer}>
          <AccessibleButton
            variant={event.spots > 0 ? "primary" : "outline"}
            disabled={event.spots <= 0}
            accessibilityLabel={event.spots > 0 ? "Register for this program" : "Registration closed for this event"}
            accessibilityHint="Double tap to register. You will be redirected to the secure external registration portal."
            onPress={handleRegisterPress}
            style={styles.registerBtn}
          >
            {event.spots > 0 ? "Register Now" : "Registration Closed"}
          </AccessibleButton>
          
          <AccessibleText variant="caption" style={[styles.disclaimerText, { color: colors.subtext }]}>
            Note: Clicking Register will safely route you to the registration form on the Digiability Service Portal.
          </AccessibleText>
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* BOTTOM NAV */}
      <AppFooter activeTab="Home" />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  headerShareButton: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: 140,
  },
  imageContainer: {
    width: "100%",
    height: 240,
    position: "relative",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  categoryBadgeOverlay: {
    position: "absolute",
    bottom: 16,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 32,
    marginBottom: 6,
  },
  metaCard: {
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  metaRowBorder: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  iconIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  metaTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  sectionContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 24,
  },
  accommodationsCard: {
    borderRadius: 20,
    padding: 16,
  },
  accommodationsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  bulletList: {
    gap: 8,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bulletDot: {
    fontSize: 18,
    lineHeight: 18,
    marginRight: 8,
  },
  bulletText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  registerBtn: {
    borderRadius: 16,
    height: 56,
  },
  disclaimerText: {
    textAlign: "center",
    marginTop: 10,
    paddingHorizontal: 20,
    lineHeight: 16,
  },
});