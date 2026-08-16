import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import {
  Calendar,
  MapPin,
  Search,
  SlidersHorizontal,
} from "lucide-react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import AppFooter from "../../components/layout/AppFooter";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import { fetchAllEvents, EventModel, parseAccessibilityTags } from "../../services/eventService";

const CATEGORY_FILTERS = [
  { label: "All",        value: "All" },
  { label: "Medical",    value: "Medical Support" },
  { label: "Legal",      value: "Legal Aid" },
  { label: "Training",   value: "Skill Training" },
  { label: "Assistive",  value: "Assistive Technology" },
  { label: "General",    value: "General Support" },
];

export default function EventsScreen() {
  const navigation = useNavigation<any>();
  const { colors, spacing, highContrast } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<EventModel[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const loadEvents = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const data = await fetchAllEvents();
      setEvents(data);
    } catch (error) {
      console.log("Failed to fetch events:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Reload events when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadEvents(true);
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadEvents(false);
  };

  const filteredEvents = events.filter((event) => {
    const activeFilter = CATEGORY_FILTERS.find(f => f.label === selectedCategory);
    const matchesCategory =
      selectedCategory === "All" || event.category === (activeFilter?.value ?? selectedCategory);
    const matchesSearch =
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };

  return (
    <ScreenWrapper>
      {/* HEADER */}
      <AppHeader title="Community Events" hideBackButton={true} />

      {/* SEARCH BAR */}
      <View style={styles.searchContainer}>
        <View style={[
          styles.searchBar, 
          { backgroundColor: colors.card, borderColor: colors.border },
          highContrast && { borderWidth: 2, borderColor: "#000000" }
        ]}>
          <Search color={colors.subtext} size={20} style={styles.searchIcon} />
          <TextInput
            placeholder="Search events, workshops..."
            placeholderTextColor={colors.subtext}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: colors.text }]}
            accessibilityLabel="Search events and workshops"
          />
        </View>
      </View>

      {/* FILTERS */}
      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {CATEGORY_FILTERS.map((filter) => {
            const active = selectedCategory === filter.label;
            return (
              <TouchableOpacity
                key={filter.value}
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  active && { backgroundColor: colors.primary, borderColor: colors.primary },
                  highContrast && { borderWidth: 2, borderColor: "#000000" },
                ]}
                onPress={() => setSelectedCategory(filter.label)}
                accessibilityRole="button"
                accessibilityLabel={`${filter.label} filter`}
                accessibilityState={{ selected: active }}
              >
                <AccessibleText
                  variant="body"
                  style={[styles.filterText, { color: colors.text }, active && { color: "#FFFFFF" }]}
                >
                  {filter.label}
                </AccessibleText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* CONTENT */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AccessibleText variant="body" style={{ color: colors.primary, marginTop: spacing.xs }}>
            Loading events...
          </AccessibleText>
        </View>
      ) : filteredEvents.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.centerContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
        >
          <AccessibleText style={styles.emptyEmoji}>📅</AccessibleText>
          <AccessibleText variant="title" style={{ fontSize: 18, marginTop: spacing.sm }}>
            No Events Found
          </AccessibleText>
          <AccessibleText variant="body" style={{ color: colors.subtext, textAlign: "center", marginTop: 4, paddingHorizontal: 40 }}>
            {searchQuery 
              ? "We couldn't find any events matching your search terms. Try adjusting your query."
              : "No upcoming programs are scheduled for this category at the moment. Pull down to refresh."}
          </AccessibleText>
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
        >
          {filteredEvents.map((event) => (
            <View
              key={event.id}
              style={[
                styles.card,
                { backgroundColor: colors.card, shadowColor: colors.primary },
                cardBorder,
              ]}
            >
              {/* IMAGE + ACCESSIBILITY TAG PILLS OVERLAY */}
              <View style={styles.imageWrapper}>
                <Image
                  source={{ uri: event.image }}
                  style={styles.cardImage}
                  defaultSource={require("../../../assets/logo.png")}
                />
                {parseAccessibilityTags(event.accessibility_tags).length > 0 && (
                  <View style={styles.tagRow}>
                    {parseAccessibilityTags(event.accessibility_tags).slice(0, 3).map((tag) => (
                      <View key={tag} style={[styles.tagPill, highContrast && { backgroundColor: "#000000" }]}>
                        <AccessibleText style={[styles.tagText, highContrast && { color: "#FFFFFF" }]}>
                          {tag.toUpperCase()}
                        </AccessibleText>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.cardBody}>
                <View
                  style={[
                    styles.categoryBadge,
                    { backgroundColor: highContrast ? "#FFFFFF" : "#F3E8FF" },
                    highContrast && { borderWidth: 1, borderColor: "#000000" },
                  ]}
                >
                  <AccessibleText
                    variant="overline"
                    style={[styles.categoryText, { color: highContrast ? "#000000" : colors.primary }]}
                  >
                    {event.category.toUpperCase()}
                  </AccessibleText>
                </View>

                <AccessibleText
                  variant="title"
                  style={[styles.title, { color: colors.text }]}
                >
                  {event.title}
                </AccessibleText>

                <View style={styles.infoBox}>
                  <View style={styles.infoRow}>
                    <MapPin color={colors.subtext} size={16} />
                    <AccessibleText
                      variant="body"
                      style={[styles.infoText, { color: colors.subtext }]}
                    >
                      {event.location}
                    </AccessibleText>
                  </View>

                  <View style={styles.infoRow}>
                    <Calendar color={colors.subtext} size={16} />
                    <AccessibleText
                      variant="body"
                      style={[styles.infoText, { color: colors.subtext }]}
                    >
                      {event.date} {event.time ? `• ${event.time}` : ""}
                    </AccessibleText>
                  </View>
                </View>

                <View style={styles.footer}>
                  <AccessibleText
                    variant="body"
                    style={[styles.spotsText, { color: colors.error, fontWeight: "700" }]}
                  >
                    {event.spots > 0 ? `${event.spots} Spots Left` : "Registration Closed"}
                  </AccessibleText>

                  <AccessibleButton
                    variant={event.buttonType === "outline" ? "outline" : "primary"}
                    accessibilityLabel={`View details for ${event.title}`}
                    accessibilityHint="Double tap to see full event specifications"
                    onPress={() => navigation.navigate("EventDetails", { eventId: event.id })}
                    style={styles.detailsBtn}
                  >
                    View details
                  </AccessibleButton>
                </View>
              </View>
            </View>
          ))}

          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* BOTTOM NAV */}
      <AppFooter activeTab="Home" />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  filterWrapper: {
    marginTop: 12,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  filterText: {
    fontSize: 13,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  card: {
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  imageWrapper: {
    width: "100%",
    height: 180,
    position: "relative",
  },
  cardImage: {
    width: "100%",
    height: 180,
  },
  tagRow: {
    position: "absolute",
    bottom: 10,
    left: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagPill: {
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#1A1B20",
    letterSpacing: 0.6,
  },
  cardBody: {
    padding: 20,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 10,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
    lineHeight: 26,
  },
  infoBox: {
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    fontSize: 14,
  },
  footer: {
    borderTopWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    marginTop: 16,
    paddingTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  spotsText: {
    fontSize: 13,
  },
  detailsBtn: {
    borderRadius: 12,
    minWidth: 110,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  emptyEmoji: {
    fontSize: 48,
    lineHeight: 60,
    marginBottom: 12,
  },
});
