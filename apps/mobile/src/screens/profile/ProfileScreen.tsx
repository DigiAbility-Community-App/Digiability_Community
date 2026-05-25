import React, {
  useState,
  useRef,
  useCallback,
} from "react";

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

import {
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";

import { useAuthStore } from "@store/authStore";

import {
  checkUsernameAvailability,
  normalizeUsername,
  parseDateInput,
  optionalString,
} from "@services/profileService";

// --------------------------------------------------
// CONSTANTS
// --------------------------------------------------

const GENDERS = [
  "Male",
  "Female",
  "Non-binary",
  "Prefer not to say",
];

const ROLE_LABELS: Record<
  string,
  string
> = {
  pwd: "PwD",
  caregiver: "Caregiver",
  educator: "Educator",
  ngo_worker: "NGO Worker",
  skill_trainer: "Skill Trainer",
  community_member:
    "Community Member",
};

const USERNAME_REGEX =
  /^[a-z0-9_.]{3,20}$/;

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type FieldErrors = {
  fullName?: string;
  username?: string;
  dob?: string;
};

type UsernameStatus =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid";

// --------------------------------------------------
// SCREEN
// --------------------------------------------------

const ProfileScreen = () => {
  const navigation =
    useNavigation<any>();

  const user = useAuthStore(
    (s) => s.user
  );

  const pendingRole =
    useAuthStore(
      (s) => s.pendingRole
    );

  const setPendingProfile =
    useAuthStore(
      (s) => s.setPendingProfile
    );

  // --------------------------------------------------
  // STATES
  // --------------------------------------------------

  const [fullName, setFullName] =
    useState("");

  const [username, setUsername] =
    useState("");

  const [dob, setDob] =
    useState("");

  const [gender, setGender] =
    useState("");

  const [houseNo, setHouseNo] =
    useState("");

  const [pincode, setPincode] =
    useState("");

  const [streetArea, setStreetArea] =
    useState("");

  const [city, setCity] =
    useState("");

  const [district, setDistrict] =
    useState("");

  const [state, setState] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [errors, setErrors] =
    useState<FieldErrors>({});

  const [
    usernameStatus,
    setUsernameStatus,
  ] =
    useState<UsernameStatus>(
      "idle"
    );

  const [
    usernameMessage,
    setUsernameMessage,
  ] = useState("");

  const debounceRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  // --------------------------------------------------
  // ROLE BADGE
  // --------------------------------------------------

  const roleLabel = pendingRole
    ? ROLE_LABELS[pendingRole] ??
    pendingRole
    : user?.role
      ? ROLE_LABELS[user.role] ??
      user.role
      : "";

  // --------------------------------------------------
  // BACK HANDLER
  // --------------------------------------------------

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert(
          "Go Back?",
          "Your role selection will be kept.",
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
        );

        return true;
      };

      const subscription =
        BackHandler.addEventListener(
          "hardwareBackPress",
          onBackPress
        );

      return () =>
        subscription.remove();
    }, [navigation])
  );

  // --------------------------------------------------
  // USERNAME CHECK
  // --------------------------------------------------

  const handleUsernameChange = (
    value: string
  ) => {
    setUsername(value);

    const normalized =
      normalizeUsername(
        value
      ) ?? "";

    if (!normalized) {
      setUsernameStatus("idle");
      setUsernameMessage("");
      return;
    }

    if (
      !USERNAME_REGEX.test(
        normalized
      )
    ) {
      setUsernameStatus(
        "invalid"
      );

      setUsernameMessage(
        "3–20 lowercase letters, numbers, _ or ."
      );

      return;
    }

    setUsernameStatus(
      "checking"
    );

    setUsernameMessage(
      "Checking..."
    );

    if (debounceRef.current)
      clearTimeout(
        debounceRef.current
      );

    debounceRef.current =
      setTimeout(async () => {
        const result =
          await checkUsernameAvailability(
            normalized
          );

        setUsernameStatus(
          result.available
            ? "available"
            : "taken"
        );

        setUsernameMessage(
          result.message
        );
      }, 500);
  };

  // --------------------------------------------------
  // VALIDATION
  // --------------------------------------------------

  const validate = () => {
    const newErrors: FieldErrors =
      {};

    if (!fullName.trim()) {
      newErrors.fullName =
        "Full name is required.";
    }

    const normalizedUser =
      normalizeUsername(
        username
      );

    if (!normalizedUser) {
      newErrors.username =
        "Username is required.";
    }

    if (
      usernameStatus === "taken"
    ) {
      newErrors.username =
        "Username already taken.";
    }

    if (dob.trim()) {
      const parsed =
        parseDateInput(
          dob.trim(),
          "DMY"
        );

      if (!parsed) {
        newErrors.dob =
          "Invalid date format.";
      }
    }

    setErrors(newErrors);

    return (
      Object.keys(newErrors)
        .length === 0
    );
  };

  // --------------------------------------------------
  // CONTINUE
  // --------------------------------------------------

  const handleContinue = () => {
    if (!validate()) return;

    setLoading(true);

    const parsedDob = dob.trim()
      ? parseDateInput(
        dob.trim(),
        "DMY"
      )
      : undefined;

    setPendingProfile({
      fullName:
        optionalString(
          fullName
        ),

      username:
        normalizeUsername(
          username
        ),

      dob: parsedDob,

      gender:
        optionalString(
          gender
        ),

      city:
        optionalString(city),

      state:
        optionalString(state),
    });

    setTimeout(() => {
      setLoading(false);

      navigation.navigate(
        "ProfileDetails"
      );
    }, 600);
  };

  // --------------------------------------------------
  // USERNAME STATUS
  // --------------------------------------------------

  const renderUsernameIndicator =
    () => {
      if (
        usernameStatus ===
        "idle"
      )
        return null;

      if (
        usernameStatus ===
        "checking"
      ) {
        return (
          <ActivityIndicator
            size="small"
            color="#7C3AED"
            style={
              styles.indicator
            }
          />
        );
      }

      const color =
        usernameStatus ===
          "available"
          ? "#2E7D32"
          : "#DC2626";

      const icon =
        usernameStatus ===
          "available"
          ? "✓"
          : "✗";

      return (
        <Text
          style={[
            styles.usernameStatus,
            { color },
          ]}
        >
          {icon}{" "}
          {usernameMessage}
        </Text>
      );
    };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <SafeAreaView
      style={styles.container}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FAF8FF"
      />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={
            styles.backButton
          }
          onPress={() =>
            navigation.goBack()
          }
        >
          <Text
            style={
              styles.backText
            }
          >
            ←
          </Text>
        </TouchableOpacity>

        <View
          style={
            styles.progressWrapper
          }
        >
          <View
            style={
              styles.inactiveDot
            }
          />

          <View
            style={
              styles.inactiveDot
            }
          />

          <View
            style={
              styles.activeBar
            }
          />

          <View
            style={
              styles.inactiveDot
            }
          />
        </View>
      </View>

      {/* CONTENT */}
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        {/* HERO */}
        <View
          style={
            styles.heroSection
          }
        >
          <Text
            style={
              styles.heroTitle
            }
          >
            Tell us about
            yourself
          </Text>

          <Text
            style={
              styles.heroSubtitle
            }
          >
            Only share what
            you are comfortable
            with
          </Text>

          {!!roleLabel && (
            <View
              style={
                styles.roleBadge
              }
            >
              <Text
                style={
                  styles.roleBadgeText
                }
              >
                {roleLabel}
              </Text>
            </View>
          )}
        </View>

        {/* BASIC INFO */}
        <View style={styles.card}>
          <Text
            style={
              styles.sectionLabel
            }
          >
            BASIC INFO
          </Text>

          {/* FULL NAME */}
          <View
            style={
              styles.inputContainer
            }
          >
            <Text
              style={
                styles.inputIcon
              }
            >
              👤
            </Text>

            <TextInput
              placeholder="Full Name"
              placeholderTextColor="#7E7383"
              style={styles.input}
              value={fullName}
              onChangeText={
                setFullName
              }
            />
          </View>

          {errors.fullName && (
            <Text
              style={
                styles.errorText
              }
            >
              {
                errors.fullName
              }
            </Text>
          )}

          {/* DOB */}
          <View
            style={
              styles.inputContainer
            }
          >
            <Text
              style={
                styles.inputIcon
              }
            >
              📅
            </Text>

            <TextInput
              placeholder="Date of Birth (DD/MM/YYYY)"
              placeholderTextColor="#7E7383"
              style={styles.input}
              value={dob}
              onChangeText={
                setDob
              }
            />
          </View>

          {/* GENDER */}
          <TouchableOpacity
            style={
              styles.inputContainer
            }
          >
            <Text
              style={
                styles.inputIcon
              }
            >
              ⚧
            </Text>

            <Text
              style={
                styles.dropdownText
              }
            >
              {gender ||
                "Select Gender"}
            </Text>

            <Text
              style={
                styles.dropdownArrow
              }
            >
              ▼
            </Text>
          </TouchableOpacity>

          {/* GENDER OPTIONS */}
          <View
            style={
              styles.genderGrid
            }
          >
            {GENDERS.map(
              (g) => {
                const selected =
                  gender === g;

                return (
                  <TouchableOpacity
                    key={g}
                    onPress={() =>
                      setGender(
                        g
                      )
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
              }
            )}
          </View>
        </View>

        {/* USERNAME */}
        <View style={styles.card}>
          <Text
            style={
              styles.sectionLabel
            }
          >
            CHOOSE YOUR
            USERNAME
          </Text>

          <View
            style={
              styles.usernameContainer
            }
          >
            <Text
              style={
                styles.usernameAt
              }
            >
              @
            </Text>

            <TextInput
              placeholder="username"
              placeholderTextColor="#7E7383"
              style={
                styles.usernameInput
              }
              value={username}
              onChangeText={
                handleUsernameChange
              }
              autoCapitalize="none"
            />
          </View>

          {renderUsernameIndicator()}

          {/* SUGGESTIONS */}
          <Text
            style={
              styles.suggestionLabel
            }
          >
            Suggestions:
          </Text>

          <View
            style={
              styles.suggestionRow
            }
          >
            {[
              "priya.dev",
              "priya_01",
              "priya123",
            ].map((item) => (
              <TouchableOpacity
                key={item}
                style={
                  styles.suggestionChip
                }
                onPress={() =>
                  handleUsernameChange(
                    item
                  )
                }
              >
                <Text
                  style={
                    styles.suggestionText
                  }
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text
            style={
              styles.helperText
            }
          >
            ℹ Username can be
            changed later
          </Text>
        </View>

        {/* LOCATION */}
        <View style={styles.card}>
          <Text
            style={
              styles.sectionLabel
            }
          >
            YOUR LOCATION
          </Text>

          {/* ROW 1 */}
          <View style={styles.row}>
            <View
              style={
                styles.halfInput
              }
            >
              <TextInput
                placeholder="House/Flat No."
                placeholderTextColor="#7E7383"
                style={
                  styles.input
                }
                value={houseNo}
                onChangeText={
                  setHouseNo
                }
              />
            </View>

            <View
              style={
                styles.halfInput
              }
            >
              <TextInput
                placeholder="Pincode"
                placeholderTextColor="#7E7383"
                style={
                  styles.input
                }
                value={pincode}
                onChangeText={
                  setPincode
                }
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* STREET */}
          <View
            style={
              styles.fullInput
            }
          >
            <TextInput
              placeholder="Street / Area"
              placeholderTextColor="#7E7383"
              style={styles.input}
              value={streetArea}
              onChangeText={
                setStreetArea
              }
            />
          </View>

          {/* ROW 2 */}
          <View style={styles.row}>
            <View
              style={
                styles.halfInput
              }
            >
              <TextInput
                placeholder="City"
                placeholderTextColor="#7E7383"
                style={
                  styles.input
                }
                value={city}
                onChangeText={
                  setCity
                }
              />
            </View>

            <View
              style={
                styles.halfInput
              }
            >
              <TextInput
                placeholder="District"
                placeholderTextColor="#7E7383"
                style={
                  styles.input
                }
                value={district}
                onChangeText={
                  setDistrict
                }
              />
            </View>
          </View>

          {/* STATE */}
          <View
            style={
              styles.fullInput
            }
          >
            <TextInput
              placeholder="State"
              placeholderTextColor="#7E7383"
              style={styles.input}
              value={state}
              onChangeText={
                setState
              }
            />
          </View>

          {/* NOTICE */}
          <View
            style={
              styles.locationNotice
            }
          >
            <Text
              style={
                styles.locationNoticeText
              }
            >
              📍 Helps us show
              nearby services
            </Text>
          </View>
        </View>

        {/* BUTTON */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={
            handleContinue
          }
          disabled={loading}
          style={
            styles.buttonWrapper
          }
        >
          <LinearGradient
            colors={[
              "#500088",
              "#6B21A8",
            ]}
            style={styles.button}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={
                  styles.buttonText
                }
              >
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

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#FAF8FF",
    },

    header: {
      height: 64,

      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",

      paddingHorizontal: 24,
    },

    backButton: {
      width: 32,
      height: 32,

      borderRadius: 999,

      justifyContent:
        "center",

      alignItems: "center",
    },

    backText: {
      fontSize: 24,
      color: "#581C87",
      fontWeight: "700",
    },

    progressWrapper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    activeBar: {
      width: 24,
      height: 8,
      borderRadius: 999,
      backgroundColor:
        "#6B21A8",
    },

    inactiveDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor:
        "rgba(207,194,212,0.4)",
    },

    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 120,
    },

    heroSection: {
      marginTop: 24,
      marginBottom: 32,
    },

    heroTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: "#500088",
      marginBottom: 4,
    },

    heroSubtitle: {
      fontSize: 14,
      color: "#4C4452",
    },

    roleBadge: {
      marginTop: 14,

      alignSelf: "flex-start",

      backgroundColor:
        "#F3EAFF",

      borderRadius: 999,

      paddingHorizontal: 14,
      paddingVertical: 7,
    },

    roleBadgeText: {
      color: "#6B21A8",
      fontWeight: "700",
      fontSize: 12,
    },

    card: {
      backgroundColor:
        "#FFFFFF",

      borderRadius: 24,

      padding: 20,

      marginBottom: 20,

      shadowColor: "#500088",
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

    inputContainer: {
      height: 56,

      backgroundColor:
        "#F4F3FA",

      borderRadius: 24,

      flexDirection: "row",
      alignItems: "center",

      paddingHorizontal: 16,

      marginBottom: 16,
    },

    inputIcon: {
      fontSize: 16,
      marginRight: 12,
    },

    input: {
      flex: 1,

      fontSize: 16,
      color: "#1A1B20",
    },

    dropdownText: {
      flex: 1,
      color: "#1A1B20",
      fontSize: 16,
    },

    dropdownArrow: {
      color: "#7E7383",
      fontSize: 12,
    },

    genderGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },

    genderChip: {
      backgroundColor:
        "#EEEDF4",

      borderRadius: 999,

      paddingHorizontal: 14,
      paddingVertical: 8,
    },

    genderChipSelected: {
      backgroundColor:
        "#F3EAFF",
    },

    genderChipText: {
      color: "#4C4452",
      fontSize: 12,
      fontWeight: "700",
    },

    genderChipTextSelected:
    {
      color: "#6B21A8",
    },

    usernameContainer: {
      height: 56,

      backgroundColor:
        "#F4F3FA",

      borderRadius: 24,

      flexDirection: "row",
      alignItems: "center",

      paddingHorizontal: 16,
    },

    usernameAt: {
      fontSize: 18,
      fontWeight: "700",
      color: "#500088",
      marginRight: 6,
    },

    usernameInput: {
      flex: 1,
      fontSize: 16,
      color: "#1A1B20",
    },

    usernameStatus: {
      marginTop: 10,
      fontSize: 12,
      fontWeight: "700",
    },

    indicator: {
      marginTop: 10,
      alignSelf: "flex-start",
    },

    suggestionLabel: {
      marginTop: 18,
      marginBottom: 10,

      fontSize: 11,
      color: "#4C4452",
    },

    suggestionRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },

    suggestionChip: {
      backgroundColor:
        "#EEEDF4",

      borderRadius: 999,

      paddingHorizontal: 12,
      paddingVertical: 6,
    },

    suggestionText: {
      color: "#500088",
      fontSize: 12,
      fontWeight: "700",
    },

    helperText: {
      marginTop: 18,

      fontSize: 11,
      fontStyle: "italic",

      color:
        "rgba(76,68,82,0.6)",
    },

    row: {
      flexDirection: "row",
      justifyContent:
        "space-between",

      marginBottom: 16,
    },

    halfInput: {
      width: "48%",

      height: 56,

      backgroundColor:
        "#F4F3FA",

      borderRadius: 24,

      paddingHorizontal: 16,

      justifyContent:
        "center",
    },

    fullInput: {
      height: 56,

      backgroundColor:
        "#F4F3FA",

      borderRadius: 24,

      paddingHorizontal: 16,

      justifyContent:
        "center",

      marginBottom: 16,
    },

    locationNotice: {
      backgroundColor:
        "rgba(254,166,25,0.1)",

      borderRadius: 24,

      paddingVertical: 12,
      paddingHorizontal: 14,
    },

    locationNoticeText: {
      color: "#855300",

      fontSize: 11,
      fontWeight: "700",

      textTransform:
        "uppercase",
    },

    buttonWrapper: {
      marginTop: 10,

      borderRadius: 24,

      overflow: "hidden",

      shadowColor: "#500088",
      shadowOpacity: 0.3,
      shadowRadius: 12,

      elevation: 8,
    },

    button: {
      height: 56,

      borderRadius: 24,

      justifyContent:
        "center",

      alignItems: "center",
    },

    buttonText: {
      color: "#FFFFFF",

      fontSize: 16,
      fontWeight: "700",
    },

    errorText: {
      color: "#DC2626",

      fontSize: 12,

      marginBottom: 10,
      marginLeft: 4,
    },
  });