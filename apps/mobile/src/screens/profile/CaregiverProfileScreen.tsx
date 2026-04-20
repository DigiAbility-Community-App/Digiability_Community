import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MainStackParamList } from "@navigation/MainNavigator";
import { useAuthStore } from "@store/authStore";
import {
  optionalNumber,
  optionalString,
  parseDateInput,
  submitCaregiverProfile,
} from "@services/profileService";

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, "CaregiverProfile">;
};

const CaregiverProfileScreen = ({ navigation }: Props) => {
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const handleChange = (key: string, value: string) => {
    setForm({ ...form, [key]: value });
  };

  const handleContinue = async () => {
    if (!user) return;

    setLoading(true);
    try {
      await submitCaregiverProfile(user.id, {
        careeName: optionalString(form.name),
        relation: optionalString(form.relation),
        careeDob: parseDateInput(form.dob, "MDY"),
        careDisability: optionalString(form.disability),
        careSince: optionalNumber(form.since),
      });

      setUser({ ...user, role: "caregiver", profileComplete: true });
      navigation.replace("Accessibility");
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "We could not save your profile.";
      Alert.alert("Unable to continue", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.bigTitle}>Who do you care for?</Text>
          <Text style={styles.step}>STEP 2 OF 3</Text>

          {/* Progress Bar */}
          <View style={styles.progressBg}>
            <View style={styles.progressFill} />
          </View>
        </View>

        {/* FORM */}
        <View style={styles.form}>
          
          {/* Name */}
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            placeholder="Enter their full name"
            style={styles.input}
            onChangeText={(v) => handleChange("name", v)}
          />

          {/* Relation */}
          <Text style={styles.label}>Relation</Text>
          <TextInput
            placeholder="e.g. Son, Daughter"
            style={styles.input}
            onChangeText={(v) => handleChange("relation", v)}
          />

          {/* DOB */}
          <Text style={styles.label}>Date of Birth</Text>
          <TextInput
            placeholder="MM/DD/YYYY"
            style={styles.input}
            onChangeText={(v) => handleChange("dob", v)}
          />

          {/* Disability */}
          <Text style={styles.label}>Disability Type</Text>
          <TextInput
            placeholder="Select type"
            style={styles.input}
            onChangeText={(v) => handleChange("disability", v)}
          />

          {/* Since */}
          <Text style={styles.label}>Disability Since</Text>
          <TextInput
            placeholder="Year or age"
            style={styles.input}
            onChangeText={(v) => handleChange("since", v)}
          />

          {/* NOTE */}
          <Text style={styles.note}>
            This helps us tailor support and recommendations.
          </Text>
        </View>
      </ScrollView>

      {/* FOOTER BUTTON */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>CONTINUE →</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default CaregiverProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF9F8",
  },

  header: {
    padding: 20,
  },

  bigTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
  },

  step: {
    color: "#7004DC",
    fontWeight: "600",
    marginBottom: 10,
  },

  progressBg: {
    height: 6,
    backgroundColor: "#E5E5E5",
    borderRadius: 10,
  },

  progressFill: {
    height: 6,
    width: "60%",
    backgroundColor: "#D2A500",
    borderRadius: 10,
  },

  form: {
    paddingHorizontal: 20,
  },

  label: {
    marginTop: 20,
    fontSize: 14,
    fontWeight: "600",
    color: "#4B4355",
  },

  input: {
    marginTop: 8,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
  },

  note: {
    marginTop: 20,
    textAlign: "center",
    color: "#7D7387",
  },

  footer: {
    padding: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
  },

  button: {
    backgroundColor: "#8A38F5",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    letterSpacing: 1,
  },
});
