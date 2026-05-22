import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  BackHandler,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useAuthStore } from "@store/authStore";
import {
  checkUsernameAvailability,
  normalizeUsername,
  parseDateInput,
  optionalString,
} from "@services/profileService";

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];

// Role display label map
const ROLE_LABELS: Record<string, string> = {
  pwd: "PwD",
  caregiver: "Caregiver",
  therapist: "Therapist",
  ngo: "NGO",
  volunteer: "Volunteer",
  student: "Student",
};

// Username format regex
const USERNAME_REGEX = /^[a-z0-9_.]{3,20}$/;

type FieldErrors = {
  fullName?: string;
  username?: string;
  dob?: string;
  pincode?: string;
};

type UsernameStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid";

const ProfileScreen = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const setPendingProfile = useAuthStore((s) => s.setPendingProfile);
  const pendingRole = useAuthStore((s) => s.pendingRole);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [dob, setDob] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState("");

  // LOCATION STATES
  const [pincode, setPincode] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);

  const [loading, setLoading] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [usernameStatus, setUsernameStatus] =
    useState<UsernameStatus>("idle");
  const [usernameMessage, setUsernameMessage] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const roleLabel = pendingRole
    ? ROLE_LABELS[pendingRole] ?? pendingRole
    : user?.role
      ? ROLE_LABELS[user.role] ?? user.role
      : "";

  // ── Back Guard ─────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert(
          "Go Back?",
          "Your role selection will be kept. Do you want to go back to role selection?",
          [
            { text: "Stay", style: "cancel" },
            {
              text: "Go Back",
              style: "destructive",
              onPress: () => navigation.goBack(),
            },
          ]
        );
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress
      );

      return () => subscription.remove();
    }, [navigation])
  );

  // ── PINCODE FETCH ──────────────────────────────────────────
  const fetchLocationFromPincode = async (pin: string) => {
    if (pin.length !== 6) return;

    try {
      setLocationLoading(true);

      const response = await fetch(
        `https://api.postalpincode.in/pincode/${pin}`
      );

      const data = await response.json();

      if (
        data[0]?.Status === "Success" &&
        data[0]?.PostOffice?.length > 0
      ) {
        const postOffice = data[0].PostOffice[0];

        setArea(postOffice.Name || "");
        setCity(postOffice.District || "");
        setState(postOffice.State || "");
      } else {
        setArea("");
        setCity("");
        setState("");

        Alert.alert(
          "Invalid Pincode",
          "Please enter a valid pincode."
        );
      }
    } catch (error) {
      console.log("Pincode fetch error:", error);

      Alert.alert(
        "Error",
        "Unable to fetch location. Please try again."
      );
    } finally {
      setLocationLoading(false);
    }
  };

  const handleDateChange = (
    event: any,
    selectedDate?: Date
  ) => {
    setShowDatePicker(false);

    if (selectedDate) {
      const day = String(selectedDate.getDate()).padStart(2, "0");
      const month = String(
        selectedDate.getMonth() + 1
      ).padStart(2, "0");
      const year = selectedDate.getFullYear();

      setDob(`${day}/${month}/${year}`);

      if (errors.dob) {
        setErrors((e) => ({
          ...e,
          dob: undefined,
        }));
      }
    }
  };

  const getPickerDate = (): Date => {
    if (dob) {
      const parsed = parseDateInput(dob, "DMY");

      if (parsed) {
        return new Date(parsed);
      }
    }

    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);

    return d;
  };

  // ── USERNAME CHECK ─────────────────────────────────────────
  const handleUsernameChange = (value: string) => {
    setUsername(value);

    const normalized = normalizeUsername(value) ?? "";

    if (!normalized) {
      setUsernameStatus("idle");
      setUsernameMessage("");
      return;
    }

    if (!USERNAME_REGEX.test(normalized)) {
      setUsernameStatus("invalid");

      setUsernameMessage(
        "3–20 characters: lowercase letters, numbers, _ or . only"
      );

      return;
    }

    setUsernameStatus("checking");
    setUsernameMessage("Checking availability...");

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      const result =
        await checkUsernameAvailability(normalized);

      setUsernameStatus(
        result.available ? "available" : "taken"
      );

      setUsernameMessage(result.message);
    }, 500);
  };

  // ── VALIDATION ─────────────────────────────────────────────
  const validate = (): boolean => {
    const newErrors: FieldErrors = {};

    const trimmedName = fullName.trim();

    if (!trimmedName) {
      newErrors.fullName = "Full name is required.";
    } else if (trimmedName.length < 2) {
      newErrors.fullName =
        "Name must be at least 2 characters.";
    } else if (
      !/^[a-zA-Z\s'-]{2,100}$/.test(trimmedName)
    ) {
      newErrors.fullName =
        "Name may only contain letters, spaces, hyphens, or apostrophes.";
    }

    const normalizedUser =
      normalizeUsername(username);

    if (!normalizedUser) {
      newErrors.username = "Username is required.";
    } else if (
      !USERNAME_REGEX.test(normalizedUser)
    ) {
      newErrors.username =
        "3–20 characters: lowercase letters, numbers, _ or . only";
    } else if (usernameStatus === "taken") {
      newErrors.username =
        "This username is already taken.";
    } else if (usernameStatus === "checking") {
      newErrors.username =
        "Please wait while we verify your username.";
    }

    if (dob.trim()) {
      const parsed = parseDateInput(
        dob.trim(),
        "DMY"
      );

      if (!parsed) {
        newErrors.dob =
          "Invalid date. Use DD/MM/YYYY format.";
      } else {
        const birthDate = new Date(parsed);
        const now = new Date();

        const minAge = new Date(
          now.getFullYear() - 5,
          now.getMonth(),
          now.getDate()
        );

        if (birthDate > now) {
          newErrors.dob =
            "Date of birth cannot be in the future.";
        } else if (birthDate > minAge) {
          newErrors.dob =
            "You must be at least 5 years old.";
        }
      }
    }

    if (pincode.trim() && pincode.trim().length !== 6) {
      newErrors.pincode = "Pincode must be exactly 6 digits.";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (!user) return;

    if (!validate()) return;

    const normalizedUser =
      normalizeUsername(username);

    const parsedDob = dob.trim()
      ? parseDateInput(dob.trim(), "DMY")
      : undefined;

    setPendingProfile({
      fullName: optionalString(fullName),
      username: normalizedUser,
      dob: parsedDob,
      gender: optionalString(gender),

      // LOCATION
      pincode: optionalString(pincode),
      area: optionalString(area),
      city: optionalString(city),
      state: optionalString(state),
    });

    navigation.navigate("ProfileDetails");
  };

  // ── USERNAME INDICATOR ─────────────────────────────────────
  const renderUsernameIndicator = () => {
    if (usernameStatus === "idle") return null;

    if (usernameStatus === "checking") {
      return (
        <ActivityIndicator
          size="small"
          color="#7C3AED"
          style={styles.indicator}
        />
      );
    }

    const color =
      usernameStatus === "available"
        ? "#059669"
        : usernameStatus === "invalid"
          ? "#B45309"
          : "#DC2626";

    const icon =
      usernameStatus === "available"
        ? "✓"
        : "✗";

    return (
      <Text
        style={[
          styles.usernameIndicatorText,
          { color },
        ]}
      >
        {icon} {usernameMessage}
      </Text>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F6F6F6"
      />

      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() =>
            Alert.alert(
              "Go Back?",
              "Your role selection will be kept. Do you want to go back?",
              [
                {
                  text: "Stay",
                  style: "cancel",
                },
                {
                  text: "Go Back",
                  style: "destructive",
                  onPress: () =>
                    navigation.goBack(),
                },
              ]
            )
          }
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <View style={styles.progressWrapper}>
          <View style={styles.inactiveProgress} />
          <View style={styles.inactiveProgress} />
          <View style={styles.activeProgress} />
          <View style={styles.inactiveProgress} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* HERO */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>
            Your Profile
          </Text>

          <Text style={styles.heroSubtitle}>
            Only share what you're comfortable
            with
          </Text>

          {roleLabel ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {roleLabel}
              </Text>
            </View>
          ) : null}
        </View>

        {/* BASIC INFO */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>
            BASIC INFO
          </Text>

          <Text style={styles.fieldLabel}>
            Full Name *
          </Text>

          <View
            style={[
              styles.inputContainer,
              errors.fullName
                ? styles.inputError
                : null,
            ]}
          >
            <TextInput
              placeholder="e.g. Priya Sharma"
              placeholderTextColor="#A89BB0"
              style={styles.input}
              value={fullName}
              onChangeText={(v) => {
                setFullName(v);

                if (errors.fullName) {
                  setErrors((e) => ({
                    ...e,
                    fullName: undefined,
                  }));
                }
              }}
            />
          </View>

          {errors.fullName ? (
            <Text style={styles.fieldError}>
              {errors.fullName}
            </Text>
          ) : null}

          <Text style={styles.fieldLabel}>
            Username *
          </Text>

          <View
            style={[
              styles.usernameInputContainer,
              errors.username
                ? styles.inputError
                : null,
            ]}
          >
            <Text style={styles.atSymbol}>@</Text>

            <TextInput
              placeholder="your_username"
              placeholderTextColor="#A89BB0"
              style={styles.usernameInput}
              value={username}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {renderUsernameIndicator()}

          {errors.username ? (
            <Text style={styles.fieldError}>
              {errors.username}
            </Text>
          ) : null}

          <Text style={styles.fieldLabel}>
            Date of Birth
          </Text>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() =>
              setShowDatePicker(true)
            }
            style={[
              styles.inputContainer,
              styles.dobPressable,
              errors.dob
                ? styles.inputError
                : null,
            ]}
          >
            <Text
              style={[
                styles.dobText,
                !dob &&
                styles.placeholderText,
              ]}
            >
              {dob || "Select Date of Birth"}
            </Text>

            <Text style={styles.calendarIcon}>
              📅
            </Text>
          </TouchableOpacity>

          {errors.dob ? (
            <Text style={styles.fieldError}>
              {errors.dob}
            </Text>
          ) : null}

          {showDatePicker && (
            <DateTimePicker
              value={getPickerDate()}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={handleDateChange}
            />
          )}
        </View>

        {/* GENDER */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>
            GENDER
          </Text>

          <View style={styles.genderGrid}>
            {GENDERS.map((g) => {
              const selected = gender === g;

              return (
                <TouchableOpacity
                  key={g}
                  activeOpacity={0.8}
                  onPress={() =>
                    setGender(g)
                  }
                  style={[
                    styles.genderChip,
                    selected &&
                    styles.genderChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.genderChipText,
                      selected &&
                      styles.genderChipTextSelected,
                    ]}
                  >
                    {g}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* LOCATION */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>
            LOCATION
          </Text>

          {/* PINCODE */}
          <Text style={styles.fieldLabel}>
            Pincode
          </Text>

          <View
            style={[
              styles.inputContainer,
              errors.pincode
                ? styles.inputError
                : null,
            ]}
          >
            <TextInput
              placeholder="e.g. 411033"
              placeholderTextColor="#A89BB0"
              style={styles.input}
              keyboardType="numeric"
              maxLength={6}
              value={pincode}
              onChangeText={(text) => {
                const cleaned =
                  text.replace(
                    /[^0-9]/g,
                    ""
                  );

                setPincode(cleaned);

                if (errors.pincode) {
                  setErrors((e) => ({
                    ...e,
                    pincode: undefined,
                  }));
                }

                if (cleaned.length === 6) {
                  fetchLocationFromPincode(
                    cleaned
                  );
                } else {
                  setArea("");
                  setCity("");
                  setState("");
                }
              }}
            />
          </View>

          {errors.pincode ? (
            <Text style={styles.fieldError}>
              {errors.pincode}
            </Text>
          ) : null}

          {locationLoading && (
            <ActivityIndicator
              size="small"
              color="#6B21A8"
              style={{ marginVertical: 10 }}
            />
          )}

          {/* AREA */}
          <Text style={styles.fieldLabel}>
            Area
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              placeholder="Auto fetched area"
              placeholderTextColor="#A89BB0"
              style={styles.input}
              value={area}
              editable={false}
            />
          </View>

          {/* CITY */}
          <Text style={styles.fieldLabel}>
            City
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              placeholder="Auto fetched city"
              placeholderTextColor="#A89BB0"
              style={styles.input}
              value={city}
              editable={false}
            />
          </View>

          {/* STATE */}
          <Text style={styles.fieldLabel}>
            State
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              placeholder="Auto fetched state"
              placeholderTextColor="#A89BB0"
              style={styles.input}
              value={state}
              editable={false}
            />
          </View>

          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              📍 Your location helps us connect
              you with nearby services
            </Text>
          </View>
        </View>

        <Text style={styles.footnote}>
          Fields marked * are required. You can
          edit your profile anytime.
        </Text>

        {/* BUTTON */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleContinue}
          disabled={loading}
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
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F6F6",
  },

  topHeader: {
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(80,0,136,0.08)",
  },

  backArrow: {
    fontSize: 18,
    color: "#581C87",
    fontWeight: "700",
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
    backgroundColor:
      "rgba(207,194,212,0.5)",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  heroSection: {
    marginTop: 16,
    marginBottom: 24,
  },

  heroTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: "#232222",
    marginBottom: 6,
  },

  heroSubtitle: {
    fontSize: 15,
    color: "#636363",
    marginBottom: 14,
  },

  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F3EAFF",
    borderWidth: 1.5,
    borderColor: "#8A38F5",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },

  roleBadgeText: {
    color: "#6B21A8",
    fontWeight: "700",
    fontSize: 13,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: "#4C4452",
    marginBottom: 16,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4C4452",
    marginBottom: 8,
    marginTop: 4,
  },

  inputContainer: {
    backgroundColor: "#F4F3FA",
    borderRadius: 14,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: "transparent",
  },

  inputError: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },

  input: {
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#1A1B20",
  },

  fieldError: {
    fontSize: 12,
    color: "#DC2626",
    marginBottom: 10,
    marginLeft: 4,
  },

  usernameInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F3FA",
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 4,
    height: 52,
    borderWidth: 1.5,
    borderColor: "transparent",
  },

  atSymbol: {
    fontSize: 18,
    color: "#500088",
    fontWeight: "700",
    marginRight: 4,
  },

  usernameInput: {
    flex: 1,
    fontSize: 15,
    color: "#1A1B20",
  },

  usernameIndicatorText: {
    fontSize: 12,
    marginBottom: 6,
    marginLeft: 4,
  },

  indicator: {
    alignSelf: "flex-start",
    marginBottom: 6,
    marginLeft: 4,
  },

  genderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },

  genderChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F4F3FA",
    borderWidth: 1.5,
    borderColor: "transparent",
  },

  genderChipSelected: {
    backgroundColor: "#F3EAFF",
    borderColor: "#8A38F5",
  },

  genderChipText: {
    fontSize: 13,
    color: "#636363",
    fontWeight: "600",
  },

  genderChipTextSelected: {
    color: "#6B21A8",
  },

  noticeBox: {
    backgroundColor:
      "rgba(138,56,245,0.07)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },

  noticeText: {
    color: "#4C4452",
    fontSize: 12,
    lineHeight: 18,
  },

  footnote: {
    fontSize: 12,
    color: "#A89BB0",
    textAlign: "center",
    marginBottom: 20,
    fontStyle: "italic",
  },

  buttonContainer: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#500088",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 8,
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
  },

  dobPressable: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },

  dobText: {
    fontSize: 15,
    color: "#1A1B20",
  },

  placeholderText: {
    color: "#A89BB0",
  },

  calendarIcon: {
    fontSize: 18,
    color: "#4C4452",
  },
});