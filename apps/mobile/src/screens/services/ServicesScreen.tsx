import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
  RefreshControl,
  Linking,
  TextInput,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import * as WebBrowser from "expo-web-browser";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { ActionSheet, ActionSheetOption } from "../../components/chat/ActionSheet";
import { ConfirmDialog } from "../../components/chat/ConfirmDialog";
import {
  MapPin,
  Phone,
  Star,
  ShieldCheck,
  Clock,
  Mail,
  Globe,
  Search,
  ChevronDown,
  X,
  Filter,
  Check,
} from "lucide-react-native";
import { fetchPublishedServices, fetchServiceCategories, ServiceModel } from "../../services/serviceService";

const MOCK_SERVICES: ServiceModel[] = [
  {
    id: "srv-1",
    name: "Dr. Sarah Jenkins",
    type: "Occupational Therapist",
    category: "therapists",
    logo: "👩‍⚕️",
    description: "Specialized in pediatric occupational therapy and sensory integration for children with autism and developmental delays.",
    location: "Downtown Clinic & Home Visits",
    contactPhone: "+1 (555) 234-5678",
    contactEmail: "sarah.jenkins@therapy.org",
    contactUrl: "https://services.digiability.org/sarah-jenkins",
    rating: 4.9,
    reviews: 124,
    verified: true,
    price: "₹500 - ₹1,500 / session",
    availability: "Next available: Tomorrow"
  },
  {
    id: "srv-2",
    name: "Mobility Solutions Inc.",
    type: "Equipment Vendor",
    category: "equipment",
    logo: "🦽",
    description: "Rental and purchase of wheelchairs, walkers, and custom-fitted seating systems. Same-day delivery available.",
    location: "Westside Hub",
    contactPhone: "+1 (555) 876-5432",
    contactEmail: "info@mobilitysolutions.com",
    contactUrl: "https://services.digiability.org/mobility-solutions",
    rating: 4.7,
    reviews: 89,
    verified: true,
    price: "Varies by equipment",
    availability: "Open 9AM - 6PM"
  },
  {
    id: "srv-3",
    name: "CareBridge Support",
    type: "Respite Care",
    category: "care",
    logo: "🤝",
    description: "Professional respite care providers offering short-term relief for primary caregivers. Background-checked and certified.",
    location: "All City Areas",
    contactPhone: "+1 (555) 345-6789",
    contactEmail: "contact@carebridge.org",
    contactUrl: "https://services.digiability.org/carebridge",
    rating: 4.8,
    reviews: 210,
    verified: true,
    price: "₹200 - ₹350 / hour",
    availability: "24/7 Availability"
  },
  {
    id: "srv-4",
    name: "Legal Advocates for Disability",
    type: "Legal Services",
    category: "legal",
    logo: "⚖️",
    description: "Assistance with disability claims, appeals, and educational advocacy (IEP meetings).",
    location: "City Center",
    contactPhone: "+1 (555) 901-2345",
    contactEmail: "legal@disabilityadvocates.org",
    contactUrl: "https://services.digiability.org/legal-advocates",
    rating: 4.6,
    reviews: 45,
    verified: true,
    price: "Free consultation",
    availability: "By appointment"
  },
  {
    id: "srv-5",
    name: "Accessible Transit Co.",
    type: "Transportation",
    category: "transport",
    logo: "🚐",
    description: "Wheelchair-accessible vans and specialized transport services for medical appointments and daily commuting.",
    location: "Metro Area",
    contactPhone: "+1 (555) 456-7890",
    contactEmail: "dispatch@accessibletransit.com",
    contactUrl: "https://services.digiability.org/accessible-transit",
    rating: 4.9,
    reviews: 312,
    verified: true,
    price: "₹20 / km",
    availability: "Book 24h in advance"
  }
];

const BASE_CATEGORIES = [
  { id: "all", label: "All Categories" },
  { id: "therapists", label: "Therapists" },
  { id: "equipment", label: "Equipment" },
  { id: "care", label: "Respite Care" },
  { id: "legal", label: "Legal" },
  { id: "transport", label: "Transport" },
];

export const ServicesScreen = () => {
  const navigation = useNavigation<any>();
  const { colors, spacing, highContrast } = useTheme();
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [services, setServices] = useState<ServiceModel[]>(MOCK_SERVICES);
  const [refreshing, setRefreshing] = useState(false);
  const iconMuted = highContrast ? colors.text : "#94A3B8";

  // Themed replacements for native Alert.alert in handleContact() — native
  // alerts cap out at 3 buttons on both iOS and Android, so a service with
  // all three contact methods (phone + email + website) plus Cancel silently
  // dropped a button and left the alert in a state that also ignored the
  // Android back button. ActionSheet has no such cap and always shows its
  // own Cancel; ConfirmDialog covers the (rarer) zero-contact-methods case.
  const [contactSheet, setContactSheet] = useState<{
    visible: boolean;
    title: string;
    options: ActionSheetOption[];
  }>({ visible: false, title: "", options: [] });
  const [noContactInfo, setNoContactInfo] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: "",
  });

  const [activeServiceCategories, setActiveServiceCategories] = useState<string[]>([]);

  const loadServices = async () => {
    const data = await fetchPublishedServices();
    if (data && data.length > 0) {
      setServices(data);
    }
  };

  useEffect(() => {
    loadServices();
    fetchServiceCategories().then((names) => {
      if (names.length > 0) setActiveServiceCategories(names);
    });
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadServices();
    setRefreshing(false);
  };

  const handleContact = (service: ServiceModel) => {
    const options: ActionSheetOption[] = [];

    if (service.contactPhone) {
      options.push({
        label: `Call (${service.contactPhone})`,
        icon: Phone,
        onPress: () => Linking.openURL(`tel:${service.contactPhone}`).catch(() => {}),
      });
    }
    if (service.contactEmail) {
      options.push({
        label: `Email (${service.contactEmail})`,
        icon: Mail,
        onPress: () => Linking.openURL(`mailto:${service.contactEmail}`).catch(() => {}),
      });
    }
    if (service.contactUrl) {
      options.push({
        label: "Open Website / Portal",
        icon: Globe,
        onPress: () => WebBrowser.openBrowserAsync(service.contactUrl!).catch(() => {}),
      });
    }

    if (options.length === 0) {
      setNoContactInfo({
        visible: true,
        message: `You can reach out to ${service.name} at their location: ${service.location}`,
      });
      return;
    }

    if (options.length === 1) {
      options[0].onPress();
      return;
    }

    setContactSheet({ visible: true, title: `Contact ${service.name}`, options });
  };

  // Build unique category pills dynamically including any custom categories.
  // Base list comes from Master Data (Active only) when available, falling
  // back to the hardcoded defaults if that fetch failed or returned nothing.
  const categories = useMemo(() => {
    const base =
      activeServiceCategories.length > 0
        ? [
            { id: "all", label: "All Categories" },
            ...activeServiceCategories.map((name) => ({ id: name.toLowerCase(), label: name })),
          ]
        : BASE_CATEGORIES;
    const list = [...base];
    const knownIds = new Set(list.map((c) => c.id));
    services.forEach((s) => {
      if (s.category && !knownIds.has(s.category.toLowerCase())) {
        const catKey = s.category.toLowerCase();
        knownIds.add(catKey);
        list.push({ id: catKey, label: s.category });
      }
    });
    return list;
  }, [services, activeServiceCategories]);

  const activeCategoryObj = useMemo(() => {
    return categories.find((c) => c.id === activeCategory) || { id: "all", label: "All Categories" };
  }, [categories, activeCategory]);

  const matchesCategory = (serviceCategory: string, catId: string) => {
    if (catId === "all") return true;
    const s = (serviceCategory || "").toLowerCase().trim();
    const c = catId.toLowerCase().trim();
    if (s === c) return true;
    if (c === "therapists" && (s.includes("therap") || s.includes("doctor"))) return true;
    if (c === "equipment" && (s.includes("equip") || s.includes("vendor") || s.includes("aid"))) return true;
    if (c === "care" && (s.includes("care") || s.includes("respite"))) return true;
    if (c === "legal" && (s.includes("legal") || s.includes("advoca") || s.includes("law"))) return true;
    if (c === "transport" && (s.includes("transport") || s.includes("transit") || s.includes("cab"))) return true;
    return s.includes(c) || c.includes(s);
  };

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchCat = matchesCategory(s.category, activeCategory);
      if (!matchCat) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        s.name?.toLowerCase().includes(q) ||
        s.type?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.location?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q)
      );
    });
  }, [services, activeCategory, searchQuery]);

  return (
    <ScreenWrapper>
      <AppHeader title="Professional Services" hideBackButton={true} />

      {/* SEARCH BAR */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.card, borderColor: colors.border },
            highContrast && { borderWidth: 2, borderColor: "#000000" },
          ]}
        >
          <Search color={colors.subtext} size={20} style={styles.searchIcon} />
          <TextInput
            placeholder="Search therapists, equipment, care..."
            placeholderTextColor={colors.subtext}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: colors.text }]}
            accessibilityLabel="Search professional services"
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
          accessibilityLabel={`Category filter: ${activeCategoryObj.label}`}
          accessibilityHint="Opens dropdown to filter services by category"
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
                {activeCategoryObj.label}
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
                      Select Service Category
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
                  {categories.map((cat) => {
                    const isSelected = activeCategory === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryOption,
                          { borderBottomColor: colors.border },
                          isSelected && { backgroundColor: highContrast ? colors.surface : "#F5F3FF" },
                        ]}
                        onPress={() => {
                          setActiveCategory(cat.id);
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
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* SERVICES LIST OR EMPTY STATE */}
      {filteredServices.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.centerContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        >
          <AccessibleText style={styles.emptyEmoji}>🏢</AccessibleText>
          <AccessibleText variant="title" style={{ fontSize: 18, marginTop: spacing.sm, color: colors.text }}>
            No Services Found
          </AccessibleText>
          <AccessibleText
            variant="body"
            style={{ color: colors.subtext, textAlign: "center", marginTop: 4, paddingHorizontal: 40 }}
          >
            {searchQuery
              ? "We couldn't find any professional services matching your search. Try a different keyword or category."
              : "No verified providers are available in this category right now. Pull down to refresh."}
          </AccessibleText>
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === "ios" ? 150 : 120 }]}
        >
          {filteredServices.map((service) => (
            <View
              key={service.id}
              style={[
                styles.serviceCard,
                { backgroundColor: colors.card },
                highContrast && { borderWidth: 2, borderColor: "#000000" },
              ]}
            >
              <View style={styles.serviceHeader}>
                <View style={[styles.providerLogo, { backgroundColor: colors.surface }]}>
                  {service.image && service.image.startsWith("http") ? (
                    <Image
                      source={{ uri: service.image }}
                      style={{ width: 44, height: 44, borderRadius: 12 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <AccessibleText style={{ fontSize: 24 }}>{service.logo || "🏢"}</AccessibleText>
                  )}
                </View>
                <View style={styles.providerInfo}>
                  <View style={styles.nameRow}>
                    <AccessibleText variant="title" style={{ fontSize: 16, flexShrink: 1, color: colors.text }}>
                      {service.name}
                    </AccessibleText>
                    {service.verified && (
                      <ShieldCheck
                        size={16}
                        color={highContrast ? colors.text : "#059669"}
                        style={{ marginLeft: 4 }}
                      />
                    )}
                  </View>
                  <View
                    style={[
                      styles.typeBadge,
                      { backgroundColor: highContrast ? colors.surface : "#F3E8FF" },
                      highContrast && { borderWidth: 1, borderColor: "#000000" },
                    ]}
                  >
                    <AccessibleText style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>
                      {service.type}
                    </AccessibleText>
                  </View>
                </View>
              </View>

              <AccessibleText style={{ color: colors.subtext, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
                {service.description}
              </AccessibleText>

              <View style={styles.metaContainer}>
                <View style={styles.metaRow}>
                  <MapPin size={14} color={iconMuted} />
                  <AccessibleText style={{ color: colors.subtext, fontSize: 13, marginLeft: 6 }}>
                    {service.location}
                  </AccessibleText>
                </View>
                <View style={styles.metaRow}>
                  <Clock size={14} color={iconMuted} />
                  <AccessibleText style={{ color: colors.subtext, fontSize: 13, marginLeft: 6 }}>
                    {service.availability}
                  </AccessibleText>
                </View>
                <View style={styles.metaRow}>
                  <Star
                    size={14}
                    color={highContrast ? colors.text : "#F59E0B"}
                    fill={highContrast ? colors.text : "#F59E0B"}
                  />
                  <AccessibleText style={{ color: colors.text, fontSize: 13, fontWeight: "600", marginLeft: 6 }}>
                    {service.rating ?? 4.9}
                  </AccessibleText>
                  <AccessibleText style={{ color: colors.subtext, fontSize: 13, marginLeft: 4 }}>
                    ({service.reviews ?? 10} reviews)
                  </AccessibleText>
                </View>
              </View>

              <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                <AccessibleText style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
                  {service.price}
                </AccessibleText>
                <TouchableOpacity
                  style={[styles.contactBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleContact(service)}
                  accessibilityRole="button"
                  accessibilityLabel={`Contact ${service.name}`}
                  accessibilityHint="Starts contacting this service provider"
                >
                  <Phone size={14} color={colors.white} />
                  <AccessibleText style={{ color: colors.white, fontSize: 13, fontWeight: "700", marginLeft: 6 }}>
                    Contact
                  </AccessibleText>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <ActionSheet
        visible={contactSheet.visible}
        title={contactSheet.title}
        options={contactSheet.options}
        onClose={() => setContactSheet((prev) => ({ ...prev, visible: false }))}
      />

      <ConfirmDialog
        visible={noContactInfo.visible}
        title="Contact Provider"
        message={noContactInfo.message}
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setNoContactInfo({ visible: false, message: "" })}
        onCancel={() => setNoContactInfo({ visible: false, message: "" })}
      />
    </ScreenWrapper>
  );
};

export default ServicesScreen;

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
    paddingTop: 4,
    paddingHorizontal: 16,
  },
  serviceCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#500088",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  serviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  providerLogo: {
    width: 54,
    height: 54,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  providerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  metaContainer: {
    gap: 8,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 16,
  },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
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
