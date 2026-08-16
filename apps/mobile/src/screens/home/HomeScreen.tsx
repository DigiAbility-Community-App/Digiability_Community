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
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useAuthStore } from "@store/authStore";
import { useForumStore } from "@store/forumStore";
import { useChatStore } from "@store/chatStore";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { fetchAllEvents } from "../../services/eventService";
import { forumService } from "../../services/forumService";

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

  // ── Notification bell indicator ──
  // Mirrors NotificationScreen: unread = any unread forum notification OR any
  // pending chat invite (invites are always shown as unread there).
  const forumNotifications = useForumStore((s) => s.notifications);
  const fetchNotifications = useForumStore((s) => s.fetchNotifications);
  const pendingInvites = useChatStore((s) => s.pendingInvites);
  const hasUnreadNotifications =
    pendingInvites.length > 0 || forumNotifications.some((n) => !n.read);

  // Refresh forum notifications each time Home regains focus so the dot
  // reflects current state (socket pushes keep it live in between).
  useFocusEffect(
    React.useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  // ----------------------
  // STATES
  // ----------------------

  const [loading, setLoading] = useState(true);

  const [events, setEvents] = useState<EventType[]>([]);

  const [communityPosts, setCommunityPosts] = useState<any[]>([]);

  // ----------------------
  // FETCH DATA
  // ----------------------

  useEffect(() => {
    fetchHomeData();
  }, []);

  const fetchHomeData = async () => {
    try {
      setLoading(true);

      // Fetch real events from user-svc
      let fetchedEvents = [];
      try {
        fetchedEvents = await fetchAllEvents();
      } catch (err) {
        console.log("Failed to fetch events, using dummy fallback:", err);
        fetchedEvents = [
          {
            id: "1",
            title: "Adaptive Sports Workshop",
            location: "Pune, Maharashtra",
            date: "24 AUG",
          },
          {
            id: "2",
            title: "Accessibility Awareness Camp",
            location: "Mumbai",
            date: "30 AUG",
          },
        ];
      }

      setEvents(fetchedEvents.slice(0, 3));

      // Fetch popular forum posts
      try {
        const forumRes = await forumService.listQuestions({
          sort: "popular",
          limit: 3,
        });
        if (forumRes && forumRes.data) {
          setCommunityPosts(forumRes.data);
        } else {
          setCommunityPosts([]);
        }
      } catch (err) {
        console.log("Failed to fetch popular forum questions:", err);
        // Fallback dummy data if service offline
        setCommunityPosts([
          {
            id: "1",
            author: { name: "Priya Sharma" },
            title: "Best physiotherapy clinics?",
            description: "Looking for accessible clinics in Pune.",
            views: 124,
            answerCount: 8,
          },
          {
            id: "2",
            author: { name: "Rahul" },
            title: "Scholarship schemes for students",
            description: "Anyone aware of 2026 disability scholarships?",
            views: 95,
            answerCount: 14,
          },
        ]);
      }

      setLoading(false);
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
      <ScreenWrapper style={[styles.loaderContainer, { backgroundColor: colors.background }]}>
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
      <AppHeader showLogo title="DigiAbility" showNotification hasUnreadNotifications={hasUnreadNotifications} hideBackButton={true} />

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
                "CommunityDetail"
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
                  "CommunityDetail"
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
                    "QuestionDetails",
                    {
                      questionId: post.id,
                    }
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={`Post by ${post.author?.name || "Anonymous"}: ${post.title}`}
                accessibilityHint="Double tap to read post answers"
              >
                <AccessibleText variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>
                  {post.author?.name || "Anonymous"}
                </AccessibleText>

                <AccessibleText variant="title" style={{ fontSize: 18, marginTop: 4 }}>
                  {post.title}
                </AccessibleText>

                <AccessibleText variant="body" style={{ color: colors.subtext, marginTop: 4 }} numberOfLines={2}>
                  {post.description}
                </AccessibleText>

                <View
                  style={
                    styles.communityFooter
                  }
                >
                  <AccessibleText variant="body" style={{ color: colors.subtext, marginRight: spacing.md }}>
                    👁️ {post.views || 0} views
                  </AccessibleText>

                  <AccessibleText variant="body" style={{ color: colors.subtext }}>
                    💬 {post.answerCount || 0} answers
                  </AccessibleText>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

    </ScreenWrapper>
  );
};

export default HomeScreen;

// ----------------------
// STYLES
// ----------------------

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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

  // EMPTY
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
  },

  emptyEmoji: {
    fontSize: 40,
    lineHeight: 52,
    marginBottom: 12,
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

  eventContent: {
    flex: 1,
    justifyContent: "center",
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

  communityFooter: {
    flexDirection: "row",
  },
});