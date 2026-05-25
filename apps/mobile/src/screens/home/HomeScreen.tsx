import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";

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
      <SafeAreaView style={styles.loaderContainer}>
        <ActivityIndicator
          size="large"
          color="#500088"
        />

        <Text style={styles.loadingText}>
          Loading Home...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerContainer}>
          {/* LEFT */}
          <View style={styles.logoSection}>
            <Text style={styles.logo}>♿</Text>

            <Text style={styles.headerTitle}>
              DigiAbility
            </Text>
          </View>

          {/* RIGHT */}
          <TouchableOpacity
            style={styles.notificationBtn}
            onPress={() =>
              navigation.navigate(
                "Notifications"
              )
            }
          >
            <Text style={styles.notificationIcon}>
              🔔
            </Text>

            <View style={styles.badge} />
          </TouchableOpacity>
        </View>
      </View>

      {/* BODY */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* GREETING */}
        <View style={styles.greetingCard}>
          <Text style={styles.welcomeText}>
            Welcome back 👋
          </Text>

          <Text style={styles.userName}>
            Prathmesh
          </Text>
        </View>

        {/* QUICK ACTIONS */}
        <View style={styles.quickGrid}>
          {/* CARE CIRCLE */}
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() =>
              navigation.navigate(
                "CareCircle"
              )
            }
          >
            <View
              style={[
                styles.quickIconWrap,
                { backgroundColor: "#F1DBFF" },
              ]}
            >
              <Text style={styles.quickEmoji}>
                👨‍👩‍👧
              </Text>
            </View>

            <Text style={styles.quickTitle}>
              Care Circle
            </Text>

            <Text style={styles.quickSubtitle}>
              View members
            </Text>
          </TouchableOpacity>

          {/* PROFILE */}
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() =>
              navigation.navigate("HomeProfile")
            }
          >
            <View
              style={[
                styles.quickIconWrap,
                { backgroundColor: "#FFDAD6" },
              ]}
            >
              <Text style={styles.quickEmoji}>
                👤
              </Text>
            </View>

            <Text style={styles.quickTitle}>
              Profile
            </Text>

            <Text style={styles.quickSubtitle}>
              View your profile
            </Text>
          </TouchableOpacity>

          {/* EVENTS */}
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() =>
              navigation.navigate("Events")
            }
          >
            <View
              style={[
                styles.quickIconWrap,
                { backgroundColor: "#FFDDB8" },
              ]}
            >
              <Text style={styles.quickEmoji}>
                📅
              </Text>
            </View>

            <Text style={styles.quickTitle}>
              Events
            </Text>

            <Text style={styles.quickSubtitle}>
              Upcoming programs
            </Text>
          </TouchableOpacity>

          {/* COMMUNITY */}
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() =>
              navigation.navigate(
                "Community"
              )
            }
          >
            <View
              style={[
                styles.quickIconWrap,
                { backgroundColor: "#DCFCE7" },
              ]}
            >
              <Text style={styles.quickEmoji}>
                💬
              </Text>
            </View>

            <Text style={styles.quickTitle}>
              Community
            </Text>

            <Text style={styles.quickSubtitle}>
              Explore discussions
            </Text>
          </TouchableOpacity>
        </View>

        {/* EVENTS SECTION */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>
              Upcoming Events
            </Text>

            <TouchableOpacity
              onPress={() =>
                navigation.navigate("Events")
              }
            >
              <Text style={styles.viewAll}>
                View All
              </Text>
            </TouchableOpacity>
          </View>

          {/* NO EVENTS */}
          {events.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>
                📭
              </Text>

              <Text style={styles.emptyTitle}>
                No Events Available
              </Text>

              <Text style={styles.emptyDesc}>
                Currently no event is
                available.
              </Text>
            </View>
          ) : (
            events.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.eventCard}
                onPress={() =>
                  navigation.navigate(
                    "EventDetails",
                    {
                      eventId: event.id,
                    }
                  )
                }
              >
                {/* DATE */}
                <LinearGradient
                  colors={[
                    "#500088",
                    "#6B21A8",
                  ]}
                  style={styles.eventDate}
                >
                  <Text
                    style={
                      styles.eventDateText
                    }
                  >
                    {event.date}
                  </Text>
                </LinearGradient>

                {/* CONTENT */}
                <View
                  style={
                    styles.eventContent
                  }
                >
                  <Text
                    style={
                      styles.eventTitle
                    }
                  >
                    {event.title}
                  </Text>

                  <Text
                    style={
                      styles.eventLocation
                    }
                  >
                    📍 {event.location}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* COMMUNITY SECTION */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>
              Community Updates
            </Text>

            <TouchableOpacity
              onPress={() =>
                navigation.navigate(
                  "Community"
                )
              }
            >
              <Text style={styles.viewAll}>
                View All
              </Text>
            </TouchableOpacity>
          </View>

          {/* NO POSTS */}
          {communityPosts.length ===
            0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>
                💬
              </Text>

              <Text style={styles.emptyTitle}>
                No Posts Yet
              </Text>

              <Text style={styles.emptyDesc}>
                Community discussions
                will appear here.
              </Text>
            </View>
          ) : (
            communityPosts.map((post) => (
              <TouchableOpacity
                key={post.id}
                style={
                  styles.communityCard
                }
                onPress={() =>
                  navigation.navigate(
                    "CommunityPost",
                    {
                      postId: post.id,
                    }
                  )
                }
              >
                <Text
                  style={
                    styles.communityUser
                  }
                >
                  {post.user}
                </Text>

                <Text
                  style={
                    styles.communityTitle
                  }
                >
                  {post.title}
                </Text>

                <Text
                  style={
                    styles.communityDescription
                  }
                >
                  {post.description}
                </Text>

                <View
                  style={
                    styles.communityFooter
                  }
                >
                  <Text
                    style={
                      styles.footerItem
                    }
                  >
                    ❤️ {post.likes}
                  </Text>

                  <Text
                    style={
                      styles.footerItem
                    }
                  >
                    💬 {post.comments}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* BOTTOM NAV */}
      <View style={styles.navbar}>
        <TouchableOpacity>
          <Text style={styles.activeNavText}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            navigation.navigate(
              "Community"
            )
          }
        >
          <Text style={styles.navText}>
            Community
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            navigation.navigate(
              "Services"
            )
          }
        >
          <Text style={styles.navText}>
            Services
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            navigation.navigate("Chats")
          }
        >
          <Text style={styles.navText}>
            Learn
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            navigation.navigate("HomeProfile")
          }
        >
          <Text style={styles.navText}>
            Profile
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
    paddingTop: 90,
    paddingHorizontal: 24,
  },

  // HEADER
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    height: 64,
    backgroundColor: "#500088",
  },

  headerContainer: {
    flex: 1,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  logoSection: {
    flexDirection: "row",
    alignItems: "center",
  },

  logo: {
    fontSize: 22,
    marginRight: 12,
    color: "#FFFFFF",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  notificationBtn: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },

  notificationIcon: {
    fontSize: 18,
  },

  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#F59E0B",
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

  // NAVBAR
  navbar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,

    height: 75,
    backgroundColor: "#FFFFFF",

    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",

    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },

  activeNavText: {
    color: "#500088",
    fontWeight: "700",
  },

  navText: {
    color: "#64748B",
    fontWeight: "500",
  },
});