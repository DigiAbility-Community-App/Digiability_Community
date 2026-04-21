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
  optionalString,
  submitNGOProfile,
} from "@services/profileService";

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, "NGOProfile">;
};

const servicesList = [
  "Therapy",
  "Education",
  "Training",
  "Assistive Tech",
  "Counselling",
  "Other",
];

const NGOProfileScreen = ({ navigation }: Props) => {
  const [form, setForm] = useState<any>({});
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const handleChange = (key: string, value: string) => {
    setForm({ ...form, [key]: value });
  };

  const toggleService = (service: string) => {
    if (selectedServices.includes(service)) {
      setSelectedServices(selectedServices.filter((s) => s !== service));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const handleContinue = async () => {
    if (!user) return;

    setLoading(true);
    try {
      await submitNGOProfile(user.id, {
        contactPersonName: optionalString(form.contact),
        username: normalizeUsername(form.username),
        organizationName: optionalString(form.orgName),
        registrationNumber: optionalString(form.regNo),
        organizationType: optionalString(form.type),
        servicesOffered: selectedServices.length ? selectedServices : undefined,
        city: optionalString(form.city),
        pincode: optionalString(form.pincode),
        website: optionalString(form.website),
      });

      setUser({ ...user, role: "ngo", profileComplete: true });
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
        
        {/* TITLE */}
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.step}>STEP 2</Text>
          <Text style={styles.title}>Tell us about yourself</Text>
        </View>

        {/* BASIC INFO */}
        <View style={styles.section}>
          <Text style={styles.label}>Contact Person Name</Text>
          <TextInput
            placeholder="John Doe"
            style={styles.input}
            onChangeText={(v) => handleChange("contact", v)}
          />

          <Text style={styles.label}>Username</Text>
          <TextInput
            placeholder="ngo_username"
            style={styles.input}
            onChangeText={(v) => handleChange("username", v)}
          />

          <Text style={styles.label}>Organization Name</Text>
          <TextInput
            placeholder="Enter full name"
            style={styles.input}
            onChangeText={(v) => handleChange("orgName", v)}
          />

          <Text style={styles.label}>Registration Number</Text>
          <TextInput
            placeholder="REG/12345"
            style={styles.input}
            onChangeText={(v) => handleChange("regNo", v)}
          />

          <Text style={styles.label}>Organization Type</Text>
          <TextInput
            placeholder="Trust / NGO / Foundation"
            style={styles.input}
            onChangeText={(v) => handleChange("type", v)}
          />
        </View>

        {/* LOCATION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>

          <View style={styles.row}>
            <TextInput
              placeholder="City"
              style={[styles.input, { flex: 1 }]}
              onChangeText={(v) => handleChange("city", v)}
            />
            <TextInput
              placeholder="Pincode"
              style={[styles.input, { flex: 1 }]}
              onChangeText={(v) => handleChange("pincode", v)}
            />
          </View>
        </View>

        {/* SERVICES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services Offered</Text>

          {servicesList.map((service) => {
            const selected = selectedServices.includes(service);
            return (
              <TouchableOpacity
                key={service}
                style={styles.serviceItem}
                onPress={() => toggleService(service)}
              >
                <View
                  style={[
                    styles.checkbox,
                    selected && styles.checkboxSelected,
                  ]}
                />
                <Text style={styles.serviceText}>{service}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* WEBSITE */}
        <View style={styles.section}>
          <Text style={styles.label}>Website (Optional)</Text>
          <TextInput
            placeholder="https://example.org"
            style={styles.input}
            onChangeText={(v) => handleChange("website", v)}
          />
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

export default NGOProfileScreen;

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
    padding: 20,
  },

  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },

  label: {
    marginTop: 15,
    fontSize: 12,
    fontWeight: "bold",
    color: "#7D7387",
  },

  input: {
    marginTop: 8,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    gap: 10,
  },

  serviceItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#ccc",
    marginRight: 10,
  },

  checkboxSelected: {
    backgroundColor: "#7004DC",
  },

  serviceText: {
    fontSize: 16,
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
