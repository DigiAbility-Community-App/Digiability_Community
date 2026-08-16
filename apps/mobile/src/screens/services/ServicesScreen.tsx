import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  Image,
  RefreshControl,
  Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import * as WebBrowser from "expo-web-browser";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { MapPin, Phone, Star, ShieldCheck, Clock, Mail, Globe } from "lucide-react-native";
import { fetchPublishedServices, ServiceModel } from "../../services/serviceService";

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
    price: "$80 - $150 / session",
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
    price: "$25 - $40 / hour",
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
    price: "$2.50 / mile",
    availability: "Book 24h in advance"
  }
];

const CATEGORIES = [
  { id: "all", label: "All" },
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
  const [services, setServices] = useState<ServiceModel[]>(MOCK_SERVICES);
  const [refreshing, setRefreshing] = useState(false);
  const iconMuted = highContrast ? colors.text : "#94A3B8";

  const loadServices = async () => {
    const data = await fetchPublishedServices();
    if (data && data.length > 0) {
      setServices(data);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadServices();
    setRefreshing(false);
  };

  const handleContact = (service: ServiceModel) => {
    const options: { text: string; onPress?: () => void; style?: "default" | "cancel" | "destructive" }[] = [];

    if (service.contactPhone) {
      options.push({
        text: `Call (${service.contactPhone})`,
        onPress: () => Linking.openURL(`tel:${service.contactPhone}`).catch(() => {}),
      });
    }
    if (service.contactEmail) {
      options.push({
        text: `Email (${service.contactEmail})`,
        onPress: () => Linking.openURL(`mailto:${service.contactEmail}`).catch(() => {}),
      });
    }
    if (service.contactUrl) {
      options.push({
        text: "Open Website / Portal",
        onPress: () => WebBrowser.openBrowserAsync(service.contactUrl!).catch(() => {}),
      });
    }

    if (options.length === 0) {
      Alert.alert("Contact Provider", `You can reach out to ${service.name} at their location: ${service.location}`);
      return;
    }

    if (options.length === 1 && options[0].onPress) {
      options[0].onPress();
      return;
    }

    options.push({ text: "Cancel", style: "cancel" });
    Alert.alert(`Contact ${service.name}`, "Choose contact option:", options);
  };

  const filteredServices = services.filter(
    s => activeCategory === "all" || s.category.toLowerCase() === activeCategory.toLowerCase()
  );

  return (
    <ScreenWrapper>
      <AppHeader title="Professional Services" hideBackButton={true} />

      <View style={[styles.categoriesContainer, { backgroundColor: colors.background }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryBtn,
                  { backgroundColor: isActive ? (highContrast ? "#000000" : "#E2D3FD") : colors.card },
                  isActive && { borderColor: colors.primary, borderWidth: highContrast ? 2 : 1 }
                ]}
                onPress={() => setActiveCategory(cat.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={cat.label}
                accessibilityHint={`Filters services by ${cat.label}`}
              >
                <AccessibleText style={{
                  color: isActive ? (highContrast ? "#FFFFFF" : colors.primary) : colors.text,
                  fontWeight: isActive ? "700" : "500",
                  fontSize: 14
                }}>
                  {cat.label}
                </AccessibleText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === "ios" ? 150 : 120 }]}
      >
        {filteredServices.map(service => (
          <View key={service.id} style={[styles.serviceCard, { backgroundColor: colors.card }, highContrast && { borderWidth: 2, borderColor: "#000000" }]}>
            <View style={styles.serviceHeader}>
              <View style={[styles.providerLogo, { backgroundColor: colors.surface }]}>
                {service.image && service.image.startsWith("http") ? (
                  <Image source={{ uri: service.image }} style={{ width: 44, height: 44, borderRadius: 12 }} resizeMode="cover" />
                ) : (
                  <AccessibleText style={{ fontSize: 24 }}>{service.logo || "🏢"}</AccessibleText>
                )}
              </View>
              <View style={styles.providerInfo}>
                <View style={styles.nameRow}>
                  <AccessibleText variant="title" style={{ fontSize: 16, flexShrink: 1 }}>{service.name}</AccessibleText>
                  {service.verified && <ShieldCheck size={16} color={highContrast ? colors.text : "#059669"} style={{ marginLeft: 4 }} />}
                </View>
                <View style={[styles.typeBadge, { backgroundColor: highContrast ? colors.surface : "#F3E8FF" }, highContrast && { borderWidth: 1, borderColor: "#000000" }]}>
                  <AccessibleText style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>{service.type}</AccessibleText>
                </View>
              </View>
            </View>

            <AccessibleText style={{ color: colors.subtext, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
              {service.description}
            </AccessibleText>

            <View style={styles.metaContainer}>
              <View style={styles.metaRow}>
                <MapPin size={14} color={iconMuted} />
                <AccessibleText style={{ color: colors.subtext, fontSize: 13, marginLeft: 6 }}>{service.location}</AccessibleText>
              </View>
              <View style={styles.metaRow}>
                <Clock size={14} color={iconMuted} />
                <AccessibleText style={{ color: colors.subtext, fontSize: 13, marginLeft: 6 }}>{service.availability}</AccessibleText>
              </View>
              <View style={styles.metaRow}>
                <Star size={14} color={highContrast ? colors.text : "#F59E0B"} fill={highContrast ? colors.text : "#F59E0B"} />
                <AccessibleText style={{ color: colors.text, fontSize: 13, fontWeight: "600", marginLeft: 6 }}>{service.rating ?? 4.9}</AccessibleText>
                <AccessibleText style={{ color: colors.subtext, fontSize: 13, marginLeft: 4 }}>({service.reviews ?? 10} reviews)</AccessibleText>
              </View>
            </View>

            <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
              <AccessibleText style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{service.price}</AccessibleText>
              <TouchableOpacity
                style={[styles.contactBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleContact(service)}
                accessibilityRole="button"
                accessibilityLabel={`Contact ${service.name}`}
                accessibilityHint="Starts contacting this service provider"
              >
                <Phone size={14} color={colors.white} />
                <AccessibleText style={{ color: colors.white, fontSize: 13, fontWeight: "700", marginLeft: 6 }}>Contact</AccessibleText>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenWrapper>
  );
};

export default ServicesScreen;

const styles = StyleSheet.create({
  categoriesContainer: {
    paddingVertical: 12,
  },
  categoriesScroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  categoryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "transparent",
  },
  scrollContent: {
    paddingTop: 8,
    paddingHorizontal: 20,
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
  }
});
