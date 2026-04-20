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
  normalizeUsername,
  optionalNumber,
  optionalString,
  parseDateInput,
  submitTherapistProfile,
} from "@services/profileService";

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, "EducatorProfile">;
};

const EducatorProfileScreen = ({ navigation }: Props) => {
  const [form, setForm] = useState<any>({});
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const handleChange = (key: string, value: string) => {
    setForm({ ...form, [key]: value });
  };

  const toggleArea = (area: string) => {
    if (selectedAreas.includes(area)) {
      setSelectedAreas(selectedAreas.filter((a) => a !== area));
    } else {
      setSelectedAreas([...selectedAreas, area]);
    }
  };

  const areas = ["Visual", "Hearing", "Physical", "Cognitive", "Multiple"];

  const handleContinue = async () => {
    if (!user) return;

    setLoading(true);
    try {
      await submitTherapistProfile(user.id, {
        username: normalizeUsername(form.username),
        dob: parseDateInput(form.dob, "DMY"),
        specialty: optionalString(form.specialty),
        institution: optionalString(form.institution),
        yearsOfExperience: optionalNumber(form.experience),
        focusAreas: selectedAreas.length ? selectedAreas : undefined,
        city: optionalString(form.city),
        district: optionalString(form.district),
        state: optionalString(form.state),
      });

      setUser({ ...user, role: "therapist", profileComplete: true });
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
          <Text style={styles.step}>STEP 2</Text>
          <Text style={styles.title}>Tell us about yourself</Text>
        </View>

        {/* PERSONAL INFO CARD */}
        <View style={styles.card}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            placeholder="@username"
            style={styles.underlineInput}
            onChangeText={(v) => handleChange("username", v)}
          />

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            placeholder="Enter your full name"
            style={styles.underlineInput}
            onChangeText={(v) => handleChange("name", v)}
          />

          <Text style={styles.label}>Date of Birth</Text>
          <TextInput
            placeholder="DD/MM/YYYY"
            style={styles.underlineInput}
            onChangeText={(v) => handleChange("dob", v)}
          />
        </View>

        {/* PROFESSIONAL INFO */}
        <View style={styles.card}>
          <Text style={styles.label}>Specialty</Text>
          <TextInput
            placeholder="Select specialty"
            style={styles.underlineInput}
            onChangeText={(v) => handleChange("specialty", v)}
          />

          <Text style={styles.label}>Institution</Text>
          <TextInput
            placeholder="Organization name"
            style={styles.underlineInput}
            onChangeText={(v) => handleChange("institution", v)}
          />

          <Text style={styles.label}>Experience</Text>
          <TextInput
            placeholder="Years of experience"
            style={styles.underlineInput}
            onChangeText={(v) => handleChange("experience", v)}
          />
        </View>

        {/* LOCATION */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>City</Text>
              <TextInput
                placeholder="e.g. Mumbai"
                style={styles.underlineInput}
                onChangeText={(v) => handleChange("city", v)}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.label}>District</Text>
              <TextInput
                placeholder="District"
                style={styles.underlineInput}
                onChangeText={(v) => handleChange("district", v)}
              />
            </View>
          </View>

          <Text style={styles.label}>State</Text>
          <TextInput
            placeholder="State"
            style={styles.underlineInput}
            onChangeText={(v) => handleChange("state", v)}
          />
        </View>

        {/* FOCUS AREAS */}
        <View style={styles.focusContainer}>
          <Text style={styles.sectionTitle}>
            Disabilities You Work With
          </Text>

          <View style={styles.chipsContainer}>
            {areas.map((area) => {
              const selected = selectedAreas.includes(area);
              return (
                <TouchableOpacity
                  key={area}
                  style={[
                    styles.chip,
                    selected && styles.chipSelected,
                  ]}
                  onPress={() => toggleArea(area)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextSelected,
                    ]}
                  >
                    {area}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* BUTTON */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue →</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default EducatorProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F6F6",
  },

  header: {
    padding: 20,
  },

  step: {
    fontSize: 12,
    color: "#7D7387",
    fontWeight: "bold",
  },

  title: {
    fontSize: 22,
    fontWeight: "bold",
  },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    padding: 16,
  },

  label: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#7D7387",
    marginTop: 10,
  },

  underlineInput: {
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
    paddingVertical: 6,
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    gap: 10,
  },

  focusContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#7D7387",
    marginBottom: 10,
  },

  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  },

  chipSelected: {
    backgroundColor: "#F3EAFF",
    borderColor: "#7004DC",
  },

  chipText: {
    fontWeight: "600",
  },

  chipTextSelected: {
    color: "#7004DC",
  },

  footer: {
    padding: 20,
  },

  button: {
    backgroundColor: "#8A38F5",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
