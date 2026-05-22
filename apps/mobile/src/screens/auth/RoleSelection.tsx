import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  BackHandler,
  StatusBar,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useAuthStore } from "@store/authStore";

type RoleType =
  | "pwd"
  | "caregiver"
  | "therapist"
  | "ngo"
  | "volunteer"
  | "student";

const roles = [
  {
    id: "pwd",
    title: "PwD",
    subtitle: "I have a disability",
    icon: "♿",
  },
  {
    id: "caregiver",
    title: "Caregiver",
    subtitle: "I care for someone",
    icon: "👨‍👩‍👧",
  },
  {
    id: "therapist",
    title: "Therapist",
    subtitle: "I work with PwDs",
    icon: "🩺",
  },
  {
    id: "ngo",
    title: "NGO",
    subtitle: "We support PwDs",
    icon: "🏢",
  },
  {
    id: "volunteer",
    title: "Volunteer",
    subtitle: "I want to help",
    icon: "🤝",
  },
  {
    id: "student",
    title: "Student",
    subtitle: "Learning & supporting",
    icon: "🎓",
  },
];

const RoleSelectionScreen = () => {
  const [selected, setSelected] = useState<RoleType>("pwd");
  const [loading, setLoading] = useState(false);

  const navigation = useNavigation<any>();
  const setPendingRole = useAuthStore((s) => s.setPendingRole);

  // ── Back Guard ────────────────────────────────────────────
  // Block hardware back button — role screen is the first
  // post-auth step; going back would return to the auth flow.
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert(
          "Leave Onboarding?",
          "Are you sure you want to go back? You'll need to start over.",
          [
            { text: "Stay", style: "cancel" },
            {
              text: "Go Back",
              style: "destructive",
              onPress: () => navigation.goBack(),
            },
          ]
        );
        return true; // intercept the back press
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress
      );

      return () => subscription.remove();
    }, [navigation])
  );

  const handleContinue = () => {
    setLoading(true);
    // Store role locally — NOT saved to DB yet.
    // DB write happens atomically in ProfileDetailsScreen.
    setPendingRole(selected);
    setLoading(false);
    navigation.navigate("Profile");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6F6F6" />

      {/* HEADER */}
      <View style={styles.topHeader}>
        <View style={styles.progressWrapper}>
          <View style={styles.inactiveProgress} />
          <View style={styles.activeProgress} />
          <View style={styles.inactiveProgress} />
          <View style={styles.inactiveProgress} />
        </View>
      </View>

      {/* MAIN */}
      <View style={styles.main}>
        {/* Heading */}
        <View style={styles.headingSection}>
          <Text style={styles.title}>I am a...</Text>

          <Text style={styles.subtitle}>
            Select the role that best describes you.
          </Text>
        </View>

        {/* GRID */}
        <View style={styles.grid}>
          {roles.map((role) => {
            const isSelected = selected === role.id;

            return (
              <TouchableOpacity
                key={role.id}
                activeOpacity={0.85}
                style={[
                  styles.card,
                  isSelected && styles.selectedCard,
                ]}
                onPress={() => setSelected(role.id as RoleType)}
              >
                {/* Tick */}
                {isSelected && (
                  <View style={styles.tickContainer}>
                    <Text style={styles.tick}>✓</Text>
                  </View>
                )}

                {/* Icon */}
                <View style={styles.iconWrapper}>
                  <Text style={styles.icon}>{role.icon}</Text>
                </View>

                {/* Text */}
                <Text style={styles.cardTitle}>
                  {role.title}
                </Text>

                <Text style={styles.cardSubtitle}>
                  {role.subtitle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Note */}
        <Text style={styles.note}>
          Your role can be changed later in Settings.
        </Text>
      </View>

      {/* FOOTER */}
      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.9}
          disabled={loading}
          onPress={handleContinue}
          style={styles.buttonContainer}
        >
          <LinearGradient
            colors={["#500088", "#6B21A8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                Continue
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default RoleSelectionScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F6F6",
  },

  // HEADER
  topHeader: {
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 10,
    alignItems: "center",
  },

  progressWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  activeProgress: {
    width: 24,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#6B21A8",
  },

  inactiveProgress: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(207,194,212,0.5)",
  },

  // MAIN
  main: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },

  headingSection: {
    marginBottom: 32,
  },

  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#232222",
    marginBottom: 6,
    fontFamily: "PlusJakartaSans-Bold",
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#636363",
    fontFamily: "PlusJakartaSans-Regular",
  },

  // GRID
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 18,
  },

  card: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",

    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,

    minHeight: 155,
  },

  selectedCard: {
    backgroundColor: "#F3EAFF",
    borderWidth: 2,
    borderColor: "#8A38F5",
  },

  tickContainer: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#8A38F5",
    justifyContent: "center",
    alignItems: "center",
  },

  tick: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  iconWrapper: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "rgba(138,56,245,0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },

  icon: {
    fontSize: 28,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#232222",
    textAlign: "center",
    marginBottom: 8,
    fontFamily: "PlusJakartaSans-Bold",
  },

  cardSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: "#636363",
    textAlign: "center",
    fontFamily: "PlusJakartaSans-Regular",
  },

  // NOTE
  note: {
    textAlign: "center",
    marginTop: 34,
    fontSize: 12,
    fontStyle: "italic",
    color: "#636363",
  },

  // FOOTER
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 12,
    backgroundColor: "#F6F6F6",
  },

  buttonContainer: {
    borderRadius: 14,
    overflow: "hidden",

    shadowColor: "#500088",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },

  button: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Nunito-Bold",
  },
});