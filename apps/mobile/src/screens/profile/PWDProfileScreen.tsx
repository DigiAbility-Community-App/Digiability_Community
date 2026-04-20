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
  submitPWDProfile,
} from "@services/profileService";

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, "PWDProfile">;
};

const PWDProfileScreen = ({ navigation }: Props) => {
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
      await submitPWDProfile(user.id, {
        username: normalizeUsername(form.username),
        dob: parseDateInput(form.dob, "DMY"),
        disabilityType: optionalString(form.disability),
        disabilitySince: optionalNumber(form.since),
        houseNo: optionalString(form.house),
        street: optionalString(form.street),
        city: optionalString(form.city),
        district: optionalString(form.district),
        state: optionalString(form.state),
      });

      setUser({ ...user, role: "pwd", profileComplete: true });
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

        {/* FORM */}
        <View style={styles.form}>
          {/* Username */}
          <Text style={styles.label}>Username</Text>
          <TextInput
            placeholder="@username"
            style={styles.input}
            onChangeText={(v) => handleChange("username", v)}
          />

          {/* Full Name */}
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            placeholder="John Doe"
            style={styles.input}
            onChangeText={(v) => handleChange("name", v)}
          />

          {/* DOB */}
          <Text style={styles.label}>Date of Birth</Text>
          <TextInput
            placeholder="DD/MM/YYYY"
            style={styles.input}
            onChangeText={(v) => handleChange("dob", v)}
          />

          {/* Disability Type */}
          <Text style={styles.label}>Disability Type</Text>
          <TextInput
            placeholder="Select type"
            style={styles.input}
            onChangeText={(v) => handleChange("disability", v)}
          />

          {/* Disability Since */}
          <Text style={styles.label}>Disability Since</Text>
          <TextInput
            placeholder="YYYY"
            style={styles.input}
            onChangeText={(v) => handleChange("since", v)}
          />

          {/* ADDRESS */}
          <Text style={styles.sectionTitle}>ADDRESS</Text>

          <TextInput
            placeholder="House / Flat No"
            style={styles.input}
            onChangeText={(v) => handleChange("house", v)}
          />

          <TextInput
            placeholder="Street / Area"
            style={styles.input}
            onChangeText={(v) => handleChange("street", v)}
          />

          <View style={styles.row}>
            <TextInput
              placeholder="City"
              style={[styles.input, { flex: 1 }]}
              onChangeText={(v) => handleChange("city", v)}
            />
            <TextInput
              placeholder="District"
              style={[styles.input, { flex: 1 }]}
              onChangeText={(v) => handleChange("district", v)}
            />
          </View>

          <TextInput
            placeholder="State"
            style={styles.input}
            onChangeText={(v) => handleChange("state", v)}
          />

          {/* FOOTER NOTE */}
          <Text style={styles.note}>
            Your information helps us personalize accessibility and connect you
            with relevant support.
          </Text>
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

export default PWDProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBF9F8",
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
    marginTop: 5,
  },

  form: {
    paddingHorizontal: 20,
  },

  label: {
    marginTop: 15,
    fontSize: 14,
    fontWeight: "600",
    color: "#4B4355",
  },

  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#CEC2D8",
  },

  sectionTitle: {
    marginTop: 25,
    fontSize: 12,
    fontWeight: "bold",
    color: "#7D7387",
  },

  row: {
    flexDirection: "row",
    gap: 10,
  },

  note: {
    marginTop: 20,
    fontSize: 13,
    color: "#7D7387",
  },

  footer: {
    padding: 20,
    backgroundColor: "#FBF9F8",
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
