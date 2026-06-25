import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Star, MapPin, MessageCircle, Search, UserCheck } from "lucide-react-native";
import apiClient from "@services/apiClient";
import { chatService } from "@services/chatService";

// ─── Types ────────────────────────────────────────────────

interface MentorMatch {
  mentorId: string;
  userId: string;
  name: string;
  bio: string | null;
  skills: string[];
  disabilitySpecialties: string[];
  city: string | null;
  state: string | null;
  avgRating: number;
  reviewCount: number;
  matchPercentage: number;
}

// ─── Specialty badge colors ───────────────────────────────

const SPECIALTY_COLORS: Record<string, { bg: string; text: string }> = {
  visual:     { bg: "#EEF2FF", text: "#4338CA" },
  hearing:    { bg: "#FEF3C7", text: "#92400E" },
  physical:   { bg: "#ECFDF5", text: "#065F46" },
  cognitive:  { bg: "#FFF1F2", text: "#9F1239" },
  multiple:   { bg: "#F3E8FF", text: "#6B21A8" },
};

const getSpecialtyColor = (specialty: string) => {
  const key = specialty.toLowerCase().trim();
  return SPECIALTY_COLORS[key] || { bg: "#F1F5F9", text: "#475569" };
};

// ─── Component ────────────────────────────────────────────

const MentorsTab = () => {
  const navigation = useNavigation<any>();
  const [mentors, setMentors] = useState<MentorMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectingUserId, setConnectingUserId] = useState<string | null>(null);

  const fetchMentors = useCallback(async () => {
    try {
      const res = await apiClient.get("/api/users/mentors/match");
      setMentors(res.data.data || []);
    } catch (err) {
      console.warn("Failed to fetch mentors:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMentors();
  }, [fetchMentors]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchMentors();
  };

  const handleConnect = async (mentor: MentorMatch) => {
    setConnectingUserId(mentor.userId);
    try {
      const conversation = await chatService.createDirectChat(mentor.userId);
      navigation.navigate("Chat", {
        conversationId: conversation.id,
        otherUser: { id: mentor.userId, name: mentor.name },
      });
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to start conversation");
    } finally {
      setConnectingUserId(null);
    }
  };

  // ─── Star Rating Component ──────────────────────────────

  const StarRating = ({ rating, count }: { rating: number; count: number }) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          size={14}
          color={i <= Math.round(rating) ? "#F59E0B" : "#D1D5DB"}
          fill={i <= Math.round(rating) ? "#F59E0B" : "transparent"}
        />
      );
    }
    return (
      <View style={styles.ratingRow}>
        {stars}
        <Text style={styles.ratingText}>
          {rating > 0 ? rating.toFixed(1) : "—"}
        </Text>
        <Text style={styles.reviewCount}>
          ({count} {count === 1 ? "review" : "reviews"})
        </Text>
      </View>
    );
  };

  // ─── Match Badge ────────────────────────────────────────

  const MatchBadge = ({ percentage }: { percentage: number }) => {
    const color =
      percentage >= 70 ? "#059669" :
      percentage >= 40 ? "#D97706" :
      "#6B7280";
    const bgColor =
      percentage >= 70 ? "#ECFDF5" :
      percentage >= 40 ? "#FFFBEB" :
      "#F3F4F6";

    return (
      <View style={[styles.matchBadge, { backgroundColor: bgColor }]}>
        <Text style={[styles.matchText, { color }]}>
          {percentage}% match
        </Text>
      </View>
    );
  };

  // ─── Mentor Card ────────────────────────────────────────

  const renderMentorCard = ({ item }: { item: MentorMatch }) => (
    <View style={styles.mentorCard}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {item.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.mentorName} numberOfLines={1}>
              {item.name}
            </Text>
            <MatchBadge percentage={item.matchPercentage} />
          </View>
          {(item.city || item.state) && (
            <View style={styles.locationRow}>
              <MapPin size={12} color="#94A3B8" />
              <Text style={styles.locationText}>
                {[item.city, item.state].filter(Boolean).join(", ")}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Bio */}
      {item.bio && (
        <Text style={styles.bio} numberOfLines={2}>
          {item.bio}
        </Text>
      )}

      {/* Specialty Badges */}
      {item.disabilitySpecialties.length > 0 && (
        <View style={styles.badgeRow}>
          {item.disabilitySpecialties.map((spec, idx) => {
            const colors = getSpecialtyColor(spec);
            return (
              <View key={idx} style={[styles.specialtyBadge, { backgroundColor: colors.bg }]}>
                <Text style={[styles.specialtyText, { color: colors.text }]}>
                  {spec}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Skills */}
      {item.skills.length > 0 && (
        <View style={styles.skillsRow}>
          {item.skills.slice(0, 3).map((skill, idx) => (
            <View key={idx} style={styles.skillChip}>
              <Text style={styles.skillText}>{skill}</Text>
            </View>
          ))}
          {item.skills.length > 3 && (
            <Text style={styles.moreSkills}>+{item.skills.length - 3} more</Text>
          )}
        </View>
      )}

      {/* Footer: Rating + Connect */}
      <View style={styles.cardFooter}>
        <StarRating rating={item.avgRating} count={item.reviewCount} />
        <TouchableOpacity
          style={styles.connectBtn}
          onPress={() => handleConnect(item)}
          disabled={connectingUserId === item.userId}
        >
          {connectingUserId === item.userId ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MessageCircle size={14} color="#fff" />
              <Text style={styles.connectText}>Connect</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── Loading State ──────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#500088" />
        <Text style={styles.loadingText}>Finding your best mentors...</Text>
      </View>
    );
  }

  // ─── Empty State ────────────────────────────────────────

  if (mentors.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.emptyIconBox}>
          <UserCheck size={44} color="#500088" />
        </View>
        <Text style={styles.emptyTitle}>No Mentors Available</Text>
        <Text style={styles.emptySubtitle}>
          There are currently no mentors matching your profile.
        </Text>
        <Text style={styles.emptySubtitle}>
          Check back later or update your profile for better matches.
        </Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
          <Search size={16} color="#fff" />
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Mentor List ────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Suggested Mentors</Text>
        <Text style={styles.listSubtitle}>
          Matched based on your disability, location & reviews
        </Text>
      </View>
      <FlatList
        data={mentors}
        keyExtractor={(item) => item.mentorId}
        renderItem={renderMentorCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#500088"
            colors={["#500088"]}
          />
        }
      />
    </View>
  );
};

export default MentorsTab;

// ─── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF8FF",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#FAF8FF",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: "#6B21A8",
    fontWeight: "500",
  },

  // ── List Header ──────────────────────────
  listHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  listTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1B20",
  },
  listSubtitle: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 4,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },

  // ── Mentor Card ──────────────────────────
  mentorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#500088",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#F3E8FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#6B21A8",
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mentorName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1B20",
    flex: 1,
    marginRight: 8,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  locationText: {
    fontSize: 13,
    color: "#94A3B8",
    marginLeft: 4,
  },

  // ── Bio ──────────────────────────────────
  bio: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
    marginTop: 12,
  },

  // ── Match Badge ──────────────────────────
  matchBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  matchText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // ── Specialty Badges ─────────────────────
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 6,
  },
  specialtyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  specialtyText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // ── Skills ───────────────────────────────
  skillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 10,
    gap: 6,
  },
  skillChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  skillText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  moreSkills: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
  },

  // ── Rating ───────────────────────────────
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1A1B20",
    marginLeft: 4,
  },
  reviewCount: {
    fontSize: 12,
    color: "#94A3B8",
    marginLeft: 2,
  },

  // ── Footer ───────────────────────────────
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  connectBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#500088",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    gap: 6,
  },
  connectText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // ── Empty State ──────────────────────────
  emptyIconBox: {
    width: 92,
    height: 92,
    borderRadius: 24,
    backgroundColor: "#F3E8FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1B20",
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 6,
  },
  refreshBtn: {
    marginTop: 28,
    backgroundColor: "#500088",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
