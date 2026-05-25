import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "@store/authStore";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import AppFooter from "../../components/layout/AppFooter";

// ----------------------
// TYPES
// ----------------------

type EventType = {
  id: string;
  title: string;
  location: string;
  date: string;
};

type CommunityPostType = {
  id: string;
  user: string;
  title: string;
  description: string;
  likes: number;
  comments: number;
};

const HomeScreen = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((state) => state.user);
  const { colors, spacing, highContrast } = useTheme();

  // ----------------------
  // STATES
  // ----------------------

  const [loading, setLoading] = useState(true);

  const [events, setEvents] = useState<EventType[]>([]);

  const [communityPosts, setCommunityPosts] = useState<
    CommunityPostType[]
  >([]);

  // ----------------------
  // FETCH DATA
  // ----------------------

  useEffect(() => {
    fetchHomeData();
  }, []);

  const fetchHomeData = async () => {
    try {
      setLoading(true);

      // ----------------------
      // DUMMY DATA
      // Replace with API later
      // ----------------------

      setTimeout(() => {
        setEvents([
          {
            id: "1",
            title:
              "Adaptive Sports Workshop",
            location: "Pune, Maharashtra",
            date: "24 AUG",
          },

          {
            id: "2",
            title:
              "Accessibility Awareness Camp",
            location: "Mumbai",
            date: "30 AUG",
          },
        ]);

        setCommunityPosts([
          {
            id: "1",
            user: "Priya Sharma",
            title:
              "Best physiotherapy clinics?",
            description:
              "Looking for accessible clinics in Pune.",
            likes: 12,
            comments: 8,
          },

          {
            id: "2",
            user: "Rahul",
            title:
              "Scholarship schemes for students",
            description:
              "Anyone aware of 2026 disability scholarships?",
            likes: 20,
            comments: 14,
          },
        ]);

        setLoading(false);
      }, 1500);

      // ----------------------
      // REAL API EXAMPLE
      // ----------------------

      /*
      const response = await fetch(
        "https://your-api.com/home"
      );

      const data = await response.json();

      setEvents(data.events);
      setCommunityPosts(data.communityPosts);
      */

    } catch (error) {
      console.log(error);
      setLoading(false);
    }
  };

  // ----------------------
  // LOADING SCREEN
  // ----------------------

  if (loading) {
    return (
      <ScreenWrapper style={styles.loaderContainer}>
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />

        <AccessibleText variant="body" style={{ color: colors.primary, marginTop: spacing.xs, textAlign: 'center' }}>
          Loading Home...
        </AccessibleText>
      </ScreenWrapper>
    );
  }

  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: '#000000' }
    : { borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' };

  return (
    <ScreenWrapper>
      <AppHeader showLogo title="DigiAbility" showNotification hasUnreadNotifications={true} />

      {/* BODY */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* GREETING */}
        <View style={[styles.greetingCard, { backgroundColor: colors.card }, cardBorder]}>
          <AccessibleText variant="body" style={{ color: colors.subtext }}>
            Welcome 👋
          </AccessibleText>

          <AccessibleText variant="heroTitle" style={{ color: colors.primary }}>
            {user?.name || "User"}
          </AccessibleText>
        </View>

        {/* QUICK ACTIONS */}
        <View style={styles.quickGrid}>
          {/* CARE CIRCLE */}
          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.card }, cardBorder]}
            onPress={() =>
              navigation.navigate(
                "CareCircle"
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Care Circle Card"
            accessibilityHint="Double tap to view members in your care circle"
          >
            <View
              style={[
                styles.quickIconWrap,
                { backgroundColor: highContrast ? '#FFFFFF' : '#F1DBFF' },
                highContrast && { borderWidth: 2, borderColor: '#000000' }
              ]}
            >
              <AccessibleText style={styles.quickEmoji}>
                👨‍👩‍👧
              </AccessibleText>
            </View>

            <AccessibleText variant="title" style={{ fontSize: 16 }}>
              Care Circle
            </AccessibleText>

            <AccessibleText variant="caption">
              View members
            </AccessibleText>
          </TouchableOpacity>

          {/* PROFILE */}
          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.card }, cardBorder]}
            onPress={() =>
              navigation.navigate("HomeProfile")
            }
            accessibilityRole="button"
            accessibilityLabel="Profile Card"
            accessibilityHint="Double tap to navigate to profile details"
          >
            <View
              style={[
                styles.quickIconWrap,
                { backgroundColor: highContrast ? '#FFFFFF' : '#FFDAD6' },
                highContrast && { borderWidth: 2, borderColor: '#000000' }
              ]}
            >
              <AccessibleText style={styles.quickEmoji}>
                👤
              </AccessibleText>
            </View>

            <AccessibleText variant="title" style={{ fontSize: 16 }}>
              Profile
            </AccessibleText>

            <AccessibleText variant="caption">
              View your profile
            </AccessibleText>
          </TouchableOpacity>

          {/* EVENTS */}
          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.card }, cardBorder]}
            onPress={() =>
              navigation.navigate("Events")
            }
            accessibilityRole="button"
            accessibilityLabel="Events Card"
            accessibilityHint="Double tap to view upcoming community programs"
          >
            <View
              style={[
                styles.quickIconWrap,
                { backgroundColor: highContrast ? '#FFFFFF' : '#FFDDB8' },
                highContrast && { borderWidth: 2, borderColor: '#000000' }
              ]}
            >
              <AccessibleText style={styles.quickEmoji}>
                📅
              </AccessibleText>
            </View>

            <AccessibleText variant="title" style={{ fontSize: 16 }}>
              Events
            </AccessibleText>

            <AccessibleText variant="caption">
              Upcoming programs
            </AccessibleText>
          </TouchableOpacity>

          {/* COMMUNITY */}
          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.card }, cardBorder]}
            onPress={() =>
              navigation.navigate(
                "Community"
              )
            }
            accessibilityRole="button"
            accessibilityLabel="Community Card"
            accessibilityHint="Double tap to explore community discussions"
          >
            <View
              style={[
                styles.quickIconWrap,
                { backgroundColor: highContrast ? '#FFFFFF' : '#DCFCE7' },
                highContrast && { borderWidth: 2, borderColor: '#000000' }
              ]}
            >
              <AccessibleText style={styles.quickEmoji}>
                💬
              </AccessibleText>
            </View>

            <AccessibleText variant="title" style={{ fontSize: 16 }}>
              Community
            </AccessibleText>

            <AccessibleText variant="caption">
              Explore discussions
            </AccessibleText>
          </TouchableOpacity>
        </View>

        {/* EVENTS SECTION */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <AccessibleText variant="title">
              Upcoming Events
            </AccessibleText>

            <TouchableOpacity
              onPress={() =>
                navigation.navigate("Events")
              }
              accessibilityRole="button"
              accessibilityLabel="View All Upcoming Events"
            >
              <AccessibleText variant="body" style={{ color: colors.primary, fontWeight: '700' }}>
                View All
              </AccessibleText>
            </TouchableOpacity>
          </View>

          {/* NO EVENTS */}
          {events.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card }, cardBorder]}>
              <AccessibleText style={styles.emptyEmoji}>
                📭
              </AccessibleText>

              <AccessibleText variant="title" style={{ fontSize: 18 }}>
                No Events Available
              </AccessibleText>

              <AccessibleText variant="body" style={{ color: colors.subtext, textAlign: 'center', marginTop: 4 }}>
                Currently no event is available.
              </AccessibleText>
            </View>
          ) : (
            events.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={[styles.eventCard, { backgroundColor: colors.card }, cardBorder]}
                onPress={() =>
                  navigation.navigate(
                    "EventDetails",
                    {
                      eventId: event.id,
                    }
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={`Event: ${event.title}`}
                accessibilityHint="Double tap to view event details"
              >
                {/* DATE */}
                <LinearGradient
                  colors={highContrast ? ["#000000", "#000000"] : ["#500088", "#6B21A8"]}
                  style={[styles.eventDate, highContrast && { borderWidth: 2, borderColor: '#FFFFFF' }]}
                >
                  <AccessibleText
                    variant="body"
                    style={{ color: '#FFFFFF', fontWeight: '700', textAlign: 'center' }}
                  >
                    {event.date}
                  </AccessibleText>
                </LinearGradient>

                {/* CONTENT */}
                <View
                  style={
                    styles.eventContent
                  }
                >
                  <AccessibleText variant="title" style={{ fontSize: 16 }}>
                    {event.title}
                  </AccessibleText>

                  <AccessibleText variant="body" style={{ color: colors.subtext, marginTop: 4 }}>
                    📍 {event.location}
                  </AccessibleText>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* COMMUNITY SECTION */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <AccessibleText variant="title">
              Community Updates
            </AccessibleText>

            <TouchableOpacity
              onPress={() =>
                navigation.navigate(
                  "Community"
                )
              }
              accessibilityRole="button"
              accessibilityLabel="View All Community Updates"
            >
              <AccessibleText variant="body" style={{ color: colors.primary, fontWeight: '700' }}>
                View All
              </AccessibleText>
            </TouchableOpacity>
          </View>

          {/* NO POSTS */}
          {communityPosts.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card }, cardBorder]}>
              <AccessibleText style={styles.emptyEmoji}>
                💬
              </AccessibleText>

              <AccessibleText variant="title" style={{ fontSize: 18 }}>
                No Posts Yet
              </AccessibleText>

              <AccessibleText variant="body" style={{ color: colors.subtext, textAlign: 'center', marginTop: 4 }}>
                Community discussions will appear here.
              </AccessibleText>
            </View>
          ) : (
            communityPosts.map((post) => (
              <TouchableOpacity
                key={post.id}
                style={[
                  styles.communityCard,
                  { backgroundColor: colors.card },
                  cardBorder
                ]}
                onPress={() =>
                  navigation.navigate(
                    "CommunityPost",
                    {
                      postId: post.id,
                    }
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={`Post by ${post.user}: ${post.title}`}
                accessibilityHint="Double tap to read post comments"
              >
                <AccessibleText variant="caption">
                  {post.user}
                </AccessibleText>

                <AccessibleText variant="title" style={{ fontSize: 18, marginTop: 2 }}>
                  {post.title}
                </AccessibleText>

                <AccessibleText variant="body" style={{ color: colors.subtext, marginTop: 4 }}>
                  {post.description}
                </AccessibleText>

                <View
                  style={
                    styles.communityFooter
                  }
                >
                  <AccessibleText variant="body" style={{ color: colors.subtext, marginRight: spacing.md }}>
                    ❤️ {post.likes}
                  </AccessibleText>

                  <AccessibleText variant="body" style={{ color: colors.subtext }}>
                    💬 {post.comments}
                  </AccessibleText>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <AppFooter activeTab="Home" />
    </ScreenWrapper>
  );
};

export default HomeScreen;

// ----------------------
// STYLES
// ----------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF8FF",
  },

  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAF8FF",
  },

  loadingText: {
    marginTop: 12,
    color: "#500088",
    fontWeight: "700",
  },

  scrollContent: {
    paddingTop: 16,
    paddingHorizontal: 24,
    paddingBottom: 120,
  },

  // GREETING
  greetingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,

    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  welcomeText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },

  userName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#500088",
  },

  // QUICK GRID
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  quickCard: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,

    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  quickIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },

  quickEmoji: {
    fontSize: 22,
  },

  quickTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
    color: "#1A1B20",
  },

  quickSubtitle: {
    fontSize: 12,
    color: "#666",
  },

  // SECTIONS
  section: {
    marginTop: 24,
  },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1B20",
  },

  viewAll: {
    fontSize: 14,
    fontWeight: "700",
    color: "#500088",
  },

  // EMPTY
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
  },

  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1B20",
    marginBottom: 6,
  },

  emptyDesc: {
    textAlign: "center",
    color: "#666",
    lineHeight: 22,
  },

  // EVENTS
  eventCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,

    flexDirection: "row",

    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  eventDate: {
    width: 72,
    height: 72,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },

  eventDateText: {
    color: "#FFFFFF",
    fontWeight: "800",
    textAlign: "center",
  },

  eventContent: {
    flex: 1,
    justifyContent: "center",
  },

  eventTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    color: "#1A1B20",
  },

  eventLocation: {
    color: "#666",
  },

  // COMMUNITY
  communityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,

    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  communityUser: {
    fontWeight: "700",
    color: "#500088",
    marginBottom: 12,
  },

  communityTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
    color: "#1A1B20",
  },

  communityDescription: {
    lineHeight: 22,
    color: "#666",
    marginBottom: 16,
  },

  communityFooter: {
    flexDirection: "row",
  },

  footerItem: {
    marginRight: 16,
    fontWeight: "700",
    color: "#666",
  },

  // Legacy navbar styles removed
});