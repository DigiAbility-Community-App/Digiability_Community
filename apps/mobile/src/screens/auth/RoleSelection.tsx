import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

type RoleType = "pwd" | "parent" | "therapist" | "ngo";

const roles = [
  {
    id: "pwd",
    title: "PwD or Individual",
    subtitle: "I have a disability",
  },
  {
    id: "parent",
    title: "Parent or Caregiver",
    subtitle: "I care for someone",
  },
  {
    id: "therapist",
    title: "Educator or Therapist",
    subtitle: "I work with PwDs",
  },
  {
    id: "ngo",
    title: "NGO or Organization",
    subtitle: "We support PwDs",
  },
];

const RoleSelectionScreen = () => {
  const [selected, setSelected] = useState<RoleType>("pwd");
  const navigation = useNavigation<any>();

  // ✅ Clean Role-based Navigation
  const routeMap: Record<RoleType, string> = {
    pwd: "PWDProfile",
    parent: "ParentProfile",
    therapist: "TherapistProfile",
    ngo: "NgoProfile",
  };

  const handleContinue = () => {
    navigation.navigate(routeMap[selected]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress */}
      <View style={styles.progressContainer}>
        <View style={styles.activeDot} />
        <View style={styles.inactiveDot} />
        <View style={styles.inactiveDot} />
      </View>

      <Text style={styles.stepText}>STEP 1</Text>

      {/* Title */}
      <View style={styles.header}>
        <Text style={styles.title}>Choose Your Role</Text>
        <Text style={styles.subtitle}>
          Help us personalize your experience
        </Text>
      </View>

      {/* Role Cards */}
      {roles.map((role) => {
        const isSelected = selected === role.id;

        return (
          <TouchableOpacity
            key={role.id}
            style={[
              styles.card,
              isSelected && styles.selectedCard,
            ]}
            onPress={() => setSelected(role.id as RoleType)}
          >
            {/* Icon Placeholder */}
            <View style={styles.iconBox} />

            {/* Text */}
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{role.title}</Text>
              <Text style={styles.cardSubtitle}>
                {role.subtitle}
              </Text>
            </View>

            {/* Radio Button */}
            <View
              style={[
                styles.radioOuter,
                isSelected && styles.radioSelected,
              ]}
            >
              {isSelected && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Continue Button */}
      <TouchableOpacity style={styles.button} onPress={handleContinue}>
        <Text style={styles.buttonText}>Continue</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default RoleSelectionScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F6F6",
    padding: 20,
  },

  progressContainer: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 10,
  },

  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#8A38F5",
  },

  inactiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#636363",
  },

  stepText: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 5,
    color: "#636363",
  },

  header: {
    marginTop: 30,
    marginBottom: 20,
    alignItems: "center",
  },

  title: {
    fontSize: 22,
    fontWeight: "bold",
  },

  subtitle: {
    color: "#666",
    marginTop: 5,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },

  selectedCard: {
    backgroundColor: "#F3EAFF",
    borderLeftWidth: 4,
    borderLeftColor: "#8A38F5",
  },

  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#eee",
    marginRight: 12,
  },

  cardTitle: {
    fontWeight: "bold",
  },

  cardSubtitle: {
    color: "#666",
    fontSize: 12,
  },

  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
  },

  radioSelected: {
    borderColor: "#8A38F5",
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#8A38F5",
  },

  button: {
    marginTop: "auto",
    backgroundColor: "#8A38F5",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});