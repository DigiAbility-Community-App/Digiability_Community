import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Share,
  Linking,
} from "react-native";
import {
  Calendar,
  MapPin,
  Users,
  Share2,
  AlertCircle,
  Bookmark,
  ChevronLeft,
  ExternalLink,
} from "lucide-react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import AppFooter from "../../components/layout/AppFooter";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import { fetchEventById, EventModel, parseAccessibilityTags } from "../../services/eventService";

export default function EventDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { colors, spacing, highContrast } = useTheme();

  const { eventId } = route.params || {};
  const [event, setEvent] = useState<EventModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (eventId) loadEventDetails();
  }, [eventId]);

  const loadEventDetails = async () => {
    try {
      setLoading(true);
      setError(false);
      const data = await fetchEventById(eventId);
      setEvent(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!event) return;
    try {
      await Share.share({
        message: `Check out this event: ${event.title}\nDate: ${event.date}${event.time ? ` • ${event.time}` : ""}\nLocation: ${event.location}\nShared via DigiAbility Community.`,
      });
    } catch {}
  };

  const handleRegisterPress = () => {
    if (!event) return;
    navigation.navigate("LeavePortal", {
      eventId: event.id,
      externalUrl: event.externalUrl,
      eventTitle: event.title,
      eventDate: event.date,
      eventLocation: event.location,
      organizer: event.organizer || "DigiAbility Admin",
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
        <AppFooter activeTab="Home" />
      </ScreenWrapper>
    );
  }

  if (error || !event) {
    return (
      <ScreenWrapper>
        <AppHeader title="Event Details" />
        <View style={styles.centerContainer}>
          <AlertCircle color={colors.error} size={48} />
          <AccessibleText variant="title" style={{ fontSize: 18, marginTop: spacing.sm, color: colors.text }}>
            Event Not Found
          </AccessibleText>
          <AccessibleText variant="body" style={{ color: colors.subtext, textAlign: "center", marginTop: 4, paddingHorizontal: 40 }}>
            This event may have been cancelled or removed by the admin.
          </AccessibleText>
          <AccessibleButton
            accessibilityLabel="Go back to events list"
            onPress={() => navigation.goBack()}
            style={{ marginTop: spacing.md }}
          >
            Go Back
          </AccessibleButton>
        </View>
        <AppFooter activeTab="Home" />
      </ScreenWrapper>
    );
  }

  const borderStyle = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" };

  const accessibilityTags = parseAccessibilityTags(event.accessibility_tags);
  const isSoldOut = event.spots <= 0;
  const organizer = event.organizer || "DigiAbility Admin";

  return (
    <ScreenWrapper>
      {/* HEADER */}
      <AppHeader
        title="Event Details"
        rightActions={
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleShare}
              style={styles.headerIcon}
              accessibilityRole="button"
              accessibilityLabel="Share this event"
            >
              <Share2 color="#fff" size={20} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setBookmarked(b => !b)}
              style={styles.headerIcon}
              accessibilityRole="button"
              accessibilityLabel={bookmarked ? "Remove bookmark" : "Bookmark this event"}
              accessibilityState={{ selected: bookmarked }}
            >
              <Bookmark
                color="#fff"
                size={20}
                fill={bookmarked ? "#fff" : "none"}
              />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* HERO IMAGE + TAG PILLS */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: event.image }} style={styles.bannerImage} />
          {/* Category overlay bottom-left */}
          <View style={[styles.categoryOverlay, { backgroundColor: highContrast ? "#000" : colors.primary }]}>
            <AccessibleText style={styles.categoryOverlayText}>{event.category.toUpperCase()}</AccessibleText>
          </View>
          {/* Accessibility tag pills overlaid */}
          {accessibilityTags.length > 0 && (
            <View style={styles.tagPillRow}>
              {accessibilityTags.slice(0, 4).map((tag) => (
                <View key={tag} style={[styles.tagPill, highContrast && { backgroundColor: "#000" }]}>
                  <AccessibleText style={[styles.tagPillText, highContrast && { color: "#fff" }]}>
                    {tag.toUpperCase()}
                  </AccessibleText>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* TITLE + ORGANIZER */}
        <View style={styles.titleSection}>
          <AccessibleText
            variant="heroTitle"
            style={[styles.mainTitle, { color: colors.text }]}
            accessibilityRole="header"
          >
            {event.title}
          </AccessibleText>
          <AccessibleText variant="caption" style={{ color: colors.subtext }}>
            Organized by{" "}
            <AccessibleText style={{ fontWeight: "700", color: colors.primary }}>
              {organizer}
            </AccessibleText>
          </AccessibleText>
        </View>

        {/* META CARD: date, location, attendees */}
        <View style={[styles.metaCard, { backgroundColor: colors.card }, borderStyle]}>
          <View style={styles.metaRow}>
            <View style={[styles.metaIcon, { backgroundColor: highContrast ? "#000" : "#F5F3FF" }]}>
              <Calendar color={highContrast ? "#fff" : colors.primary} size={20} />
            </View>
            <View style={styles.metaText}>
              <AccessibleText variant="title" style={styles.metaLabel}>Date & Time</AccessibleText>
              <AccessibleText variant="body" style={{ color: colors.subtext, marginTop: 2 }}>
                {event.date}{event.time ? ` • ${event.time}` : ""}
              </AccessibleText>
            </View>
          </View>

          <View style={[styles.metaRow, styles.metaBorder, { borderColor: colors.border }]}>
            <View style={[styles.metaIcon, { backgroundColor: highContrast ? "#000" : "#FEF3C7" }]}>
              <MapPin color={highContrast ? "#fff" : "#D97706"} size={20} />
            </View>
            <View style={styles.metaText}>
              <AccessibleText variant="title" style={styles.metaLabel}>Location</AccessibleText>
              <AccessibleText variant="body" style={{ color: colors.subtext, marginTop: 2 }}>
                {event.location}
              </AccessibleText>
            </View>
          </View>

          <View style={[styles.metaRow, styles.metaBorder, { borderColor: colors.border }]}>
            <View style={[styles.metaIcon, { backgroundColor: highContrast ? "#000" : "#FEE2E2" }]}>
              <Users color={highContrast ? "#fff" : colors.error} size={20} />
            </View>
            <View style={styles.metaText}>
              <AccessibleText variant="title" style={styles.metaLabel}>Availability</AccessibleText>
              <AccessibleText
                variant="body"
                style={{ color: isSoldOut ? colors.error : "#059669", fontWeight: "700", marginTop: 2 }}
              >
                {isSoldOut ? "Sold Out" : `${event.spots} people attending`}
              </AccessibleText>
            </View>
          </View>
        </View>

        {/* ABOUT */}
        <View style={styles.section}>
          <AccessibleText variant="label" style={[styles.sectionHeading, { color: colors.primary }]}>
            ABOUT
          </AccessibleText>
          <AccessibleText variant="body" style={[styles.descriptionText, { color: colors.text }]}>
            {event.description}
          </AccessibleText>
        </View>

        {/* ACCESSIBILITY SECTION */}
        {accessibilityTags.length > 0 && (
          <View style={styles.section}>
            <AccessibleText variant="label" style={[styles.sectionHeading, { color: colors.primary }]}>
              ACCESSIBILITY
            </AccessibleText>
            <View style={styles.chipWrap}>
              {accessibilityTags.map((tag) => (
                <View
                  key={tag}
                  style={[
                    styles.accessChip,
                    { backgroundColor: highContrast ? "#000" : colors.surface },
                    highContrast && { borderWidth: 1, borderColor: "#fff" },
                  ]}
                >
                  <AccessibleText style={[styles.accessChipText, { color: highContrast ? "#fff" : colors.text }]}>
                    {tag}
                  </AccessibleText>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* REGISTER BUTTON */}
        <View style={styles.registerSection}>
          <View style={styles.registrationNote}>
            <AccessibleText variant="caption" style={{ color: colors.subtext, textAlign: "center" }}>
              Registrations handled by Digiability Services
            </AccessibleText>
          </View>

          <TouchableOpacity
            style={[
              styles.registerBtn,
              isSoldOut && styles.registerBtnDisabled,
              highContrast && { backgroundColor: isSoldOut ? "#555" : "#000" },
            ]}
            onPress={handleRegisterPress}
            disabled={isSoldOut}
            accessibilityRole="button"
            accessibilityLabel={isSoldOut ? "Registration closed for this event" : "Register via Digiability"}
            accessibilityHint="Opens the external Digiability registration portal"
            accessibilityState={{ disabled: isSoldOut }}
          >
            <AccessibleText style={[styles.registerBtnText, isSoldOut && { color: "#999" }]}>
              {isSoldOut ? "Registration Closed" : "Register via Digiability"}
            </AccessibleText>
            {!isSoldOut && <ExternalLink color="#500088" size={18} style={{ marginLeft: 8 }} />}
          </TouchableOpacity>
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>

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
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerIcon: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
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
  categoryOverlay: {
    position: "absolute",
    bottom: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  categoryOverlayText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  tagPillRow: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagPill: {
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagPillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#1A1B20",
    letterSpacing: 0.5,
  },
  titleSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
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
  metaBorder: {
    borderTopWidth: 1,
  },
  metaIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  metaText: {
    marginLeft: 16,
    flex: 1,
  },
  metaLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 24,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  accessChip: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  accessChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  registerSection: {
    paddingHorizontal: 20,
    marginTop: 8,
    gap: 12,
  },
  registrationNote: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  registerBtn: {
    backgroundColor: "#F5C518",
    borderRadius: 16,
    height: 56,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#F5C518",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  registerBtnDisabled: {
    backgroundColor: "#F0F0F0",
    shadowOpacity: 0,
    elevation: 0,
  },
  registerBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#500088",
  },
});
