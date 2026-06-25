import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { MapPin, Phone, Star, ShieldCheck, Clock } from "lucide-react-native";

const MOCK_SERVICES = [
  {
    id: "srv-1",
    name: "Dr. Sarah Jenkins",
    type: "Occupational Therapist",
    category: "therapists",
    logo: "👩‍⚕️",
    description: "Specialized in pediatric occupational therapy and sensory integration for children with autism and developmental delays.",
    location: "Downtown Clinic & Home Visits",
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

  const filteredServices = MOCK_SERVICES.filter(
    s => activeCategory === "all" || s.category === activeCategory
  );

  return (
    <ScreenWrapper>
      <AppHeader title="Professional Services" hideBackButton={true} />

      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryBtn,
                  { backgroundColor: isActive ? "#E2D3FD" : colors.card },
                  isActive && { borderColor: "#9333EA", borderWidth: 1 }
                ]}
                onPress={() => setActiveCategory(cat.id)}
              >
                <AccessibleText style={{ 
                  color: isActive ? "#500088" : colors.text, 
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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === "ios" ? 150 : 120 }]}
      >
        {filteredServices.map(service => (
          <View key={service.id} style={[styles.serviceCard, { backgroundColor: colors.card }]}>
            <View style={styles.serviceHeader}>
              <View style={styles.providerLogo}>
                <AccessibleText style={{ fontSize: 24 }}>{service.logo}</AccessibleText>
              </View>
              <View style={styles.providerInfo}>
                <View style={styles.nameRow}>
                  <AccessibleText variant="title" style={{ fontSize: 16, flexShrink: 1 }}>{service.name}</AccessibleText>
                  {service.verified && <ShieldCheck size={16} color="#059669" style={{ marginLeft: 4 }} />}
                </View>
                <View style={styles.typeBadge}>
                  <AccessibleText style={{ color: "#500088", fontSize: 11, fontWeight: "700" }}>{service.type}</AccessibleText>
                </View>
              </View>
            </View>

            <AccessibleText style={{ color: colors.subtext, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
              {service.description}
            </AccessibleText>

            <View style={styles.metaContainer}>
              <View style={styles.metaRow}>
                <MapPin size={14} color="#94A3B8" />
                <AccessibleText style={{ color: colors.subtext, fontSize: 13, marginLeft: 6 }}>{service.location}</AccessibleText>
              </View>
              <View style={styles.metaRow}>
                <Clock size={14} color="#94A3B8" />
                <AccessibleText style={{ color: colors.subtext, fontSize: 13, marginLeft: 6 }}>{service.availability}</AccessibleText>
              </View>
              <View style={styles.metaRow}>
                <Star size={14} color="#F59E0B" fill="#F59E0B" />
                <AccessibleText style={{ color: colors.text, fontSize: 13, fontWeight: "600", marginLeft: 6 }}>{service.rating}</AccessibleText>
                <AccessibleText style={{ color: colors.subtext, fontSize: 13, marginLeft: 4 }}>({service.reviews} reviews)</AccessibleText>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <AccessibleText style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{service.price}</AccessibleText>
              <TouchableOpacity 
                style={styles.contactBtn}
                onPress={() => Alert.alert("Contact", `Initiating contact with ${service.name}...`)}
              >
                <Phone size={14} color="#fff" />
                <AccessibleText style={{ color: "#fff", fontSize: 13, fontWeight: "700", marginLeft: 6 }}>Contact</AccessibleText>
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
    backgroundColor: "#FAF8FF",
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
    backgroundColor: "#F1F5F9",
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
    backgroundColor: "#F3E8FF",
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
    borderTopColor: "#F1F5F9",
    paddingTop: 16,
  },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#500088",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  }
});
