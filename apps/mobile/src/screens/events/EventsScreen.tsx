import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import {
  Calendar,
  MapPin,
  Search,
  ChevronDown,
  X,
  Filter,
  Check,
} from "lucide-react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import AppFooter from "../../components/layout/AppFooter";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import { fetchAllEvents, fetchEventCategories, EventModel, EventCategory, parseAccessibilityTags } from "../../services/eventService";
import { formatEventDateDisplay } from "../../utils/dateHelpers";

export default function EventsScreen() {
  const navigation = useNavigation<any>();
  const { colors, spacing, highContrast } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<EventModel[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  // Master data only — no invented fallback categories. `categoriesLoaded`
  // distinguishes "still fetching" from "fetch finished and there's
  // genuinely nothing", so the empty-state message doesn't flash on mount.
  const [activeCategories, setActiveCategories] = useState<EventCategory[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  useEffect(() => {
    fetchEventCategories().then((cats) => {
      setActiveCategories(cats);
      setCategoriesLoaded(true);
    });
  }, []);

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

  // Category chips are driven entirely by Master Data (Active only) — no
  // hardcoded fallback list. If the master fetch fails or returns empty,
  // the only option is "All".
  const categoryFilters = useMemo(() => {
    return [
      { id: "all", label: "All Categories" },
      ...activeCategories.map((c) => ({ id: c.id, label: c.name })),
    ];
  }, [activeCategories]);

  const selectedCategoryObj = useMemo(() => {
    return categoryFilters.find((c) => c.id === selectedCategory) || categoryFilters[0];
  }, [categoryFilters, selectedCategory]);

  // Resolves an event's category id to its master-data display name, so a
  // raw id (e.g. "EV0012026") never surfaces in search matching or on a
  // card. Falls back to the raw value only if master data hasn't loaded it
  // (e.g. legacy free-text rows from before the id-linkage backfill).
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    activeCategories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [activeCategories]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesCategory = selectedCategory === "all" || event.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const categoryLabel = categoryNameById.get(event.category) || event.category;
      const matchesSearch =
        !q ||
        event.title.toLowerCase().includes(q) ||
        event.location.toLowerCase().includes(q) ||
        event.description.toLowerCase().includes(q) ||
        (categoryLabel && categoryLabel.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [events, selectedCategory, searchQuery, categoryNameById]);

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
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search text"
            >
              <X size={18} color={colors.subtext} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* CATEGORY DROPDOWN TRIGGER */}
      <View style={styles.dropdownContainer}>
        <TouchableOpacity
          style={[
            styles.dropdownBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
            highContrast && { borderWidth: 2, borderColor: "#000000" },
          ]}
          activeOpacity={0.8}
          onPress={() => setIsCategoryModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Category filter: ${selectedCategoryObj.label}`}
          accessibilityHint="Opens dropdown to filter events by category"
        >
          <View style={styles.dropdownLeft}>
            <View
              style={[
                styles.dropdownIconCircle,
                { backgroundColor: highContrast ? colors.surface : "#F3E8FF" },
              ]}
            >
              <Filter size={16} color={colors.primary} />
            </View>
            <View>
              <AccessibleText variant="caption" style={[styles.dropdownSublabel, { color: colors.subtext }]}>
                CATEGORY
              </AccessibleText>
              <AccessibleText variant="body" style={[styles.dropdownValue, { color: colors.text }]}>
                {selectedCategoryObj.label}
              </AccessibleText>
            </View>
          </View>
          <ChevronDown size={20} color={colors.primary} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {/* CATEGORY SELECTOR MODAL */}
      <Modal
        visible={isCategoryModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCategoryModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsCategoryModalOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.dropdownModal,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  highContrast && { borderWidth: 2, borderColor: "#000000" },
                ]}
              >
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                  <View style={styles.modalHeaderTitleRow}>
                    <Filter size={18} color={colors.primary} style={{ marginRight: 8 }} />
                    <AccessibleText variant="title" style={{ fontSize: 16, color: colors.text }}>
                      Select Event Category
                    </AccessibleText>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsCategoryModalOpen(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Close category modal"
                  >
                    <X size={20} color={colors.subtext} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                  {categoryFilters.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryOption,
                          { borderBottomColor: colors.border },
                          isSelected && { backgroundColor: highContrast ? colors.surface : "#F5F3FF" },
                        ]}
                        onPress={() => {
                          setSelectedCategory(cat.id);
                          setIsCategoryModalOpen(false);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                      >
                        <AccessibleText
                          variant="body"
                          style={[
                            styles.categoryOptionText,
                            { color: isSelected ? colors.primary : colors.text },
                            isSelected && { fontWeight: "700" },
                          ]}
                        >
                          {cat.label}
                        </AccessibleText>
                        {isSelected && <Check size={18} color={colors.primary} strokeWidth={2.5} />}
                      </TouchableOpacity>
                    );
                  })}
                  {categoriesLoaded && activeCategories.length === 0 && (
                    <View style={styles.categoryEmptyState}>
                      <AccessibleText variant="body" style={{ color: colors.subtext, textAlign: "center", fontSize: 13 }}>
                        No event categories are configured yet. Check back later or browse all events.
                      </AccessibleText>
                    </View>
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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
          <AccessibleText variant="title" style={{ fontSize: 18, marginTop: spacing.sm, color: colors.text }}>
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
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 120, 140) }]}
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
                    {(categoryNameById.get(event.category) || event.category).toUpperCase()}
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
                      {formatEventDateDisplay(event.date)}
                      {event.time ? ` • ${event.time}` : ""}
                    </AccessibleText>
                  </View>
                </View>

                <View style={styles.footer}>
                  <AccessibleText
                    variant="body"
                    style={[styles.spotsText, { color: colors.primary, fontWeight: "700" }]}
                  >
                    {event.spots > 0 ? `${event.spots} spots left` : "Open Event"}
                  </AccessibleText>
                  <AccessibleButton
                    accessibilityLabel={`View details for ${event.title}`}
                    variant="primary"
                    onPress={() => navigation.navigate("EventDetails", { eventId: event.id })}
                    style={styles.detailsBtn}
                  >
                    View Details
                  </AccessibleButton>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* FOOTER NAV BAR */}
      <AppFooter activeTab="Events" />
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
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    height: "100%",
  },
  dropdownContainer: {
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
  },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  dropdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dropdownIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownSublabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  dropdownValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dropdownModal: {
    width: "100%",
    maxWidth: 380,
    maxHeight: 460,
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalList: {
    paddingVertical: 6,
  },
  categoryEmptyState: {
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  categoryOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryOptionText: {
    fontSize: 15,
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
