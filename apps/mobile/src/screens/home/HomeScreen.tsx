import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { logout } from "@services/authService";
import { useAuthStore } from "@store/authStore";

const HomeScreen = () => {
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation<any>();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.profile}>
            <View style={styles.avatar} />

            <View>
              <Text style={styles.welcome}>Welcome back</Text>
              <Text style={styles.name}>
                {user?.name ?? "User"} 👋
              </Text>
            </View>
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* QUICK ACTIONS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickActions}
        >
          {["Support", "Jobs", "Events", "Schemes", "SOS"].map(
            (item, i) => (
              <View key={i} style={styles.quickCard}>
                <View style={styles.quickIcon} />
                <Text style={styles.quickText}>{item}</Text>
              </View>
            )
          )}
        </ScrollView>

        {/* TODAY SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today</Text>

          {[
            "2 new replies in your post",
            "Therapist shared file",
            "Legal Aid Camp tomorrow",
          ].map((item, i) => (
            <View key={i} style={styles.card}>
              <View style={styles.cardIcon} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item}</Text>
                <Text style={styles.cardTime}>10 mins ago</Text>
              </View>
            </View>
          ))}
        </View>

        {/* COMMUNITY */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Community</Text>
            <Text style={styles.viewAll}>View All</Text>
          </View>

          <View style={styles.communityCard}>
            <Text style={styles.cardTitle}>
              Best exercises for mobility?
            </Text>
            <Text style={styles.cardTime}>Forum • 24 replies</Text>
          </View>

          <View style={styles.communityCard}>
            <Text style={styles.cardTitle}>
              Government schemes discussion
            </Text>
            <Text style={styles.cardTime}>Forum • 12 replies</Text>
          </View>
        </View>
      </ScrollView>

      {/* BOTTOM NAV */}
      <View style={styles.navbar}>
        <TouchableOpacity>
          <Text style={styles.activeTab}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text style={styles.tab}>Explore</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Chats')}>
          <Text style={styles.tab}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text style={styles.tab}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F6F6",
  },

  header: {
    backgroundColor: "#8A38F5",
    padding: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
  },

  welcome: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },

  name: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },

  logoutBtn: {
    backgroundColor: "#ffffff33",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },

  logoutText: {
    color: "#fff",
    fontWeight: "600",
  },

  quickActions: {
    padding: 16,
  },

  quickCard: {
    width: 90,
    height: 90,
    backgroundColor: "#fff",
    borderRadius: 16,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  quickIcon: {
    width: 24,
    height: 24,
    backgroundColor: "#8A38F5",
    marginBottom: 6,
  },

  quickText: {
    fontSize: 12,
    fontWeight: "bold",
  },

  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },

  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    alignItems: "center",
  },

  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eee",
    marginRight: 10,
  },

  cardTitle: {
    fontWeight: "bold",
  },

  cardTime: {
    fontSize: 12,
    color: "#666",
  },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  viewAll: {
    color: "#8A38F5",
    fontWeight: "bold",
  },

  communityCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
  },

  navbar: {
    height: 60,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },

  activeTab: {
    color: "#8A38F5",
    fontWeight: "bold",
  },

  tab: {
    color: "#666",
  },
});