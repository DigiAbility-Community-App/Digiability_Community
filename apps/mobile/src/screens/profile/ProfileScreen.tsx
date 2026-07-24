import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
} from "react";

import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  BackHandler,
} from "react-native";
import SafeScreen from "../../components/layout/SafeScreen";

import {
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";

import { useAuthStore } from "@store/authStore";
import { logout } from "@services/authService";

import {
  checkUsernameAvailability,
  normalizeUsername,
  parseDateInput,
  optionalString,
} from "@services/profileService";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import * as Location from "expo-location";
import { reverseGeocodeEnglish } from "../../utils/reverseGeocode";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";

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
  phoneNo?: string;
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

  const { colors, highContrast } = useTheme();

  const user = useAuthStore(
    (s) => s.user
  );

  const pendingRoles =
    useAuthStore(
      (s) => s.pendingRoles
    );

  const setPendingProfile =
    useAuthStore(
      (s) => s.setPendingProfile
    );

  // --------------------------------------------------
  // STATES
  // --------------------------------------------------

  const [fullName, setFullName] = useState(
    user?.name || ""
  );

  const [username, setUsername] =
    useState("");

  const [dob, setDob] =
    useState("");

  const [showDatePicker, setShowDatePicker] =
    useState(false);

  const [gender, setGender] =
    useState("");

  const [showGenderDropdown, setShowGenderDropdown] =
    useState(false);

  const [phoneNo, setPhoneNo] =
    useState(user?.phoneNo ?? "");

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

  const [locationLoading, setLocationLoading] = useState(false);

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

  // M8: Clean up debounce timer on unmount to prevent state update on unmounted component
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // --------------------------------------------------
  // ROLE BADGE
  // --------------------------------------------------

  const rolesList = pendingRoles && pendingRoles.length > 0
    ? pendingRoles
    : (user?.roles && user.roles.length > 0 ? user.roles : (user?.role ? [user.role] : []));

  const roleLabel = rolesList
    .map(r => ROLE_LABELS[r] ?? r)
    .join(", ");

  // --------------------------------------------------
  // BACK HANDLER
  // --------------------------------------------------

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      Alert.alert(
        "Exit Onboarding?",
        "Are you sure you want to go back to the signup/login screen? This will sign you out.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Exit",
            style: "destructive",
            onPress: async () => {
              try {
                await logout();
              } catch (err) {
                Alert.alert("Error", "Failed to log out");
              }
            },
          },
        ]
      );
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleBack();
        return true;
      };

      const subscription =
        BackHandler.addEventListener(
          "hardwareBackPress",
          onBackPress
        );

      return () =>
        subscription.remove();
    }, [handleBack])
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

    if (usernameStatus === "checking") {
      newErrors.username = "Checking availability, please wait…";
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

    const rawPhone = phoneNo.trim();
    if (rawPhone) {
      const digitsOnly = rawPhone.replace(/\D/g, "");
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        newErrors.phoneNo = "Phone number must be 10–15 digits.";
      } else if (!/^[+]?[0-9\s\-()]{10,18}$/.test(rawPhone)) {
        newErrors.phoneNo = "Enter a valid phone number.";
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

      phoneNo:
        optionalString(
          phoneNo
        ),

      city:
        optionalString(city),

      state:
        optionalString(state),

      addressLine1:
        optionalString(houseNo),

      streetArea:
        optionalString(streetArea),

      pincode:
        optionalString(pincode),

      locationDistrict:
        optionalString(district),
    });

    setLoading(false);
    navigation.navigate("ProfileDetails");
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
            color={colors.secondary}
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
        <AccessibleText
          variant="caption"
          style={[
            styles.usernameStatus,
            { color },
          ]}
        >
          {icon}{" "}
          {usernameMessage}
        </AccessibleText>
      );
    };
  // --------------------------------------------------
  // Generate username suggestions
  // --------------------------------------------------

  const usernameSuggestions = useMemo(() => {
    const name = fullName.trim().toLowerCase().replace(/\s+/g, "");
    if (!name) return [];
    return [
      `${name}${Math.floor(Math.random() * 100)}`,
      `${name}_${Math.floor(Math.random() * 999)}`,
      `${name}.${Math.floor(Math.random() * 9999)}`,
    ];
  }, [fullName]);

  // --------------------------------------------------
  //
  // --------------------------------------------------
  const fetchCurrentLocation =
    async () => {
      if (locationLoading) return; // prevent double-tap
      setLocationLoading(true);
      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          Alert.alert(
            "Location Permission Needed",
            "Please allow location access so we can auto-fill your address."
          );
          return;
        }

        // GPS/location services off entirely → getCurrentPositionAsync would
        // hang or throw with no feedback. Tell the user what to do instead.
        const servicesOn = await Location.hasServicesEnabledAsync();
        if (!servicesOn) {
          Alert.alert(
            "Location Is Off",
            "Please turn on your device's location (GPS) and try again."
          );
          return;
        }

        // Fast path: reuse the OS's cached fix, but ONLY if it's recent and
        // reasonably precise. An unconditional getLastKnownPositionAsync()
        // can hand back a coarse, network/cell-tower-triangulated fix that's
        // stale or many km off (this produced a pincode in a different city
        // entirely) — so validate age + accuracy before trusting it.
        const LAST_KNOWN_MAX_AGE_MS = 2 * 60 * 1000; // 2 minutes
        const LAST_KNOWN_MAX_ACCURACY_M = 100;

        let location = await Location.getLastKnownPositionAsync();
        const isFreshAndAccurate =
          !!location &&
          Date.now() - location.timestamp < LAST_KNOWN_MAX_AGE_MS &&
          (location.coords.accuracy == null ||
            location.coords.accuracy <= LAST_KNOWN_MAX_ACCURACY_M);

        if (!isFreshAndAccurate) {
          // Request a fresh, GPS-based fix (High, not Balanced — Balanced
          // can still resolve via network positioning on some devices,
          // which is exactly the imprecise source we're trying to avoid).
          location = await Promise.race([
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
            }),
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), 20000)
            ),
          ]);
        }

        if (!location) {
          Alert.alert(
            "Couldn't Get Location",
            "We couldn't get a GPS fix. Move somewhere with a clearer view of the sky or check that location is enabled, then try again."
          );
          return;
        }

        // Reverse-geocode in English (device-locale geocoder returns Marathi).
        const place = await reverseGeocodeEnglish(
          location.coords.latitude,
          location.coords.longitude
        );

        if (!place) {
          Alert.alert(
            "Couldn't Find Address",
            "We got your location but couldn't turn it into an address. Please fill the fields manually."
          );
          return;
        }

        if (place) {
          setStreetArea(place.streetArea);
          setCity(place.city);
          setDistrict(place.district);
          setState(place.state);
          setPincode(place.pincode);
        }
      } catch (error) {
        console.log("[Location] fetch failed:", error);
        Alert.alert(
          "Location Error",
          "Something went wrong while fetching your location. Please try again or fill the fields manually."
        );
      } finally {
        setLocationLoading(false);
      }
    };

  // --------------------------------------------------
  // THEME HELPERS
  // --------------------------------------------------

  // Hairline border in the default state (near-invisible), a solid
  // 2px black border under High Contrast — same convention used for
  // "card" surfaces across the app (see RoleSelection/HomeProfileScreen).
  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" as const }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" as const };

  const fieldBorder = (hasError?: boolean) => {
    if (hasError) return { borderWidth: 1, borderColor: colors.error };
    return highContrast ? { borderWidth: 2, borderColor: "#000000" as const } : {};
  };

  const placeholderColor = highContrast
    ? "#000000"
    : "rgba(126,115,131,0.6)";

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <SafeScreen style={[styles.container, { backgroundColor: colors.background }]}>

      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the previous screen"
        >
          <AccessibleText style={[styles.backText, { color: colors.secondary }]}>←</AccessibleText>
        </TouchableOpacity>

        <View
          style={
            styles.progressWrapper
          }
        >
          <View
            style={[
              styles.inactiveDot,
              highContrast && { backgroundColor: "#000000" },
            ]}
          />

          <View
            style={[
              styles.inactiveDot,
              highContrast && { backgroundColor: "#000000" },
            ]}
          />

          <View
            style={[styles.activeBar, { backgroundColor: colors.secondary }]}
          />

          <View
            style={[
              styles.inactiveDot,
              highContrast && { backgroundColor: "#000000" },
            ]}
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
          <AccessibleText
            variant="heroTitle"
            style={[styles.heroTitle, { color: colors.primary }]}
          >
            Tell us about
            yourself
          </AccessibleText>

          <AccessibleText
            variant="body"
            style={[styles.heroSubtitle, { color: colors.subtext }]}
          >
            Only share what
            you are comfortable
            with
          </AccessibleText>

          {!!roleLabel && (
            <View
              style={
                styles.roleBadge
              }
            >
              <AccessibleText
                variant="label"
                style={
                  styles.roleBadgeText
                }
              >
                {roleLabel}
              </AccessibleText>
            </View>
          )}
        </View>

        {/* BASIC INFO */}
        <View style={[styles.card, { backgroundColor: colors.card }, cardBorder]}>
          <AccessibleText
            variant="overline"
            style={[styles.sectionLabel, { color: colors.subtext }]}
          >
            BASIC INFO
          </AccessibleText>

          {/* FULL NAME */}
          <View
            style={[styles.inputContainer, { backgroundColor: colors.surface }, cardBorder, fieldBorder(!!errors.fullName)]}
          >
            <AccessibleText
              style={
                styles.inputIcon
              }
            >
              👤
            </AccessibleText>

            <TextInput
              placeholder="Full Name"
              placeholderTextColor={placeholderColor}
              style={[styles.input, { color: colors.text }]}
              value={fullName}
              onChangeText={setFullName}
              accessibilityLabel="Full Name"
              accessibilityHint="Enter your first and last name"
            />
          </View>

          {errors.fullName && (
            <AccessibleText
              variant="caption"
              style={[styles.errorText, { color: colors.error }]}
              accessibilityRole="alert"
            >
              {
                errors.fullName
              }
            </AccessibleText>
          )}

          {/* DOB */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setShowDatePicker(true)}
            style={[styles.inputContainer, { backgroundColor: colors.surface }, cardBorder]}
            accessibilityRole="button"
            accessibilityLabel="Date of birth"
            accessibilityHint={dob ? `Selected: ${dob}. Double tap to change` : "Double tap to open date picker"}
          >
            <AccessibleText style={styles.inputIcon}>📅</AccessibleText>
            <TextInput
              placeholder="DD/MM/YYYY"
              placeholderTextColor={placeholderColor}
              style={[styles.input, { color: colors.text }]}
              value={dob}
              onChangeText={setDob}
              accessibilityLabel="Date of birth input"
              accessibilityHint="Enter your date of birth in DD/MM/YYYY format"
              editable={false}
              pointerEvents="none"
            />
          </TouchableOpacity>

          <DateTimePickerModal
            isVisible={showDatePicker}
            mode="date"
            maximumDate={new Date()}
            onConfirm={(date) => {
              setShowDatePicker(false);

              const formatted =
                `${date.getDate()
                  .toString()
                  .padStart(2, "0")}/${(
                    date.getMonth() + 1
                  )
                    .toString()
                    .padStart(2, "0")}/${date.getFullYear()}`;

              setDob(formatted);
            }}
            onCancel={() =>
              setShowDatePicker(false)
            }
          />

          {/* GENDER */}
          <TouchableOpacity
            style={[styles.inputContainer, { backgroundColor: colors.surface }, cardBorder]}
            activeOpacity={0.9}
            onPress={() => setShowGenderDropdown(!showGenderDropdown)}
            accessibilityRole="combobox"
            accessibilityLabel="Gender"
            accessibilityHint={gender ? `Selected: ${gender}. Double tap to change` : "Double tap to select your gender"}
            accessibilityState={{ expanded: showGenderDropdown }}
          >
            <AccessibleText style={styles.inputIcon}>⚧</AccessibleText>
            <AccessibleText
              variant="input"
              style={[styles.dropdownText, { color: colors.text }]}
            >
              {gender || "Select Gender"}
            </AccessibleText>
            <AccessibleText style={[styles.dropdownArrow, { color: colors.subtext }]}>
              {showGenderDropdown ? "▲" : "▼"}
            </AccessibleText>
          </TouchableOpacity>

          {showGenderDropdown && (
            <View style={[styles.dropdownBox, { backgroundColor: colors.surface }, cardBorder]}>
              {GENDERS.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.dropdownItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setGender(item);
                    setShowGenderDropdown(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={item}
                  accessibilityHint={`Double tap to select ${item} as your gender`}
                >
                  <AccessibleText
                    variant="body"
                    style={[styles.dropdownItemText, { color: colors.text }]}
                  >
                    {item}
                  </AccessibleText>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* PHONE NUMBER */}
          <View
            style={[styles.inputContainer, { backgroundColor: colors.surface }, cardBorder, fieldBorder(!!errors.phoneNo)]}
          >
            <AccessibleText
              style={
                styles.inputIcon
              }
            >
              📞
            </AccessibleText>

            <TextInput
              placeholder="+91 XXXXX XXXXX"
              placeholderTextColor={placeholderColor}
              style={[styles.input, { color: colors.text }]}
              value={phoneNo}
              onChangeText={setPhoneNo}
              keyboardType="phone-pad"
              maxLength={18}
              accessibilityLabel="Phone number"
              accessibilityHint="Enter your mobile number with country code, for example +91 98765 43210. This field is optional."
              textContentType="telephoneNumber"
            />
          </View>

          {errors.phoneNo && (
            <AccessibleText
              variant="caption"
              style={[styles.errorText, { color: colors.error }]}
              accessibilityRole="alert"
            >
              {errors.phoneNo}
            </AccessibleText>
          )}

        </View>

        {/* USERNAME */}
        <View style={[styles.card, { backgroundColor: colors.card }, cardBorder]}>
          <AccessibleText
            variant="overline"
            style={[styles.sectionLabel, { color: colors.subtext }]}
          >
            CHOOSE YOUR
            USERNAME
          </AccessibleText>

          <View
            style={[
              styles.usernameContainer,
              { backgroundColor: colors.surface },
              cardBorder,
              fieldBorder(!!errors.username || usernameStatus === "taken" || usernameStatus === "invalid"),
            ]}
          >
            <AccessibleText
              style={[styles.usernameAt, { color: colors.primary }]}
            >
              @
            </AccessibleText>

            <TextInput
              placeholder="username"
              placeholderTextColor={placeholderColor}
              style={[styles.usernameInput, { color: colors.text }]}
              value={username}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Username"
              accessibilityHint="Enter a unique username with 3 to 20 lowercase letters, numbers, underscores, or dots"
              textContentType="username"
            />
          </View>

          {renderUsernameIndicator()}

          {/* usernameStatus stays "idle" for an empty field, so the live
              indicator above shows nothing — this covers the "required but
              empty" case, which validate() computes but the UI otherwise
              never surfaces. */}
          {usernameStatus === "idle" && errors.username && (
            <AccessibleText
              variant="caption"
              style={[styles.errorText, { color: colors.error }]}
              accessibilityRole="alert"
            >
              {errors.username}
            </AccessibleText>
          )}

          {/* SUGGESTIONS */}
          <AccessibleText
            variant="caption"
            style={[styles.suggestionLabel, { color: colors.subtext }]}
          >
            Suggestions:
          </AccessibleText>

          <View
            style={
              styles.suggestionRow
            }
          >
            {usernameSuggestions?.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.suggestionChip, { backgroundColor: colors.surface }, cardBorder]}
                onPress={() =>
                  handleUsernameChange(
                    item
                  )
                }
                accessibilityRole="button"
                accessibilityLabel={`Use suggested username ${item}`}
                accessibilityHint="Fills the username field in with this suggestion"
              >
                <AccessibleText
                  variant="label"
                  style={[styles.suggestionText, { color: colors.primary }]}
                >
                  {item}
                </AccessibleText>
              </TouchableOpacity>
            ))}
          </View>

          <AccessibleText
            variant="caption"
            style={[styles.helperText, { color: colors.subtext }]}
          >
            ℹ Username can be
            changed later
          </AccessibleText>
        </View>

        {/* LOCATION */}
        <View style={[styles.card, { backgroundColor: colors.card }, cardBorder]}>
          <AccessibleText
            variant="overline"
            style={[styles.sectionLabel, { color: colors.subtext }]}
          >
            YOUR LOCATION
          </AccessibleText>

          {/* LOCATION BUTTON */}
          <TouchableOpacity
            style={styles.locationBtn}
            onPress={fetchCurrentLocation}
            activeOpacity={0.9}
            disabled={locationLoading}
            accessibilityRole="button"
            accessibilityLabel="Use Current Location"
            accessibilityHint="Double tap to auto-fill your address using GPS"
            accessibilityState={{ disabled: locationLoading, busy: locationLoading }}
          >
            {locationLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <AccessibleText
                variant="label"
                style={[styles.locationBtnText, { color: colors.primary }]}
              >
                📍 Use Current Location
              </AccessibleText>
            )}
          </TouchableOpacity>

          {/* ADDRESS LINE 1 */}
          <View style={[styles.fullWidthInput, { backgroundColor: colors.surface }, cardBorder]}>
            <TextInput
              placeholder="Address Line 1"
              placeholderTextColor={placeholderColor}
              style={[styles.input, { color: colors.text }]}
              value={houseNo}
              onChangeText={setHouseNo}
            />
          </View>

          {/* STREET */}
          <View style={[styles.fullWidthInput, { backgroundColor: colors.surface }, cardBorder]}>
            <TextInput
              placeholder="Street / Area"
              placeholderTextColor={placeholderColor}
              style={[styles.input, { color: colors.text }]}
              value={streetArea}
              onChangeText={setStreetArea}
            />
          </View>

          {/* CITY + DISTRICT */}
          <View style={styles.doubleRow}>
            <View style={[styles.doubleInput, { backgroundColor: colors.surface }, cardBorder]}>
              <TextInput
                placeholder="City"
                placeholderTextColor={placeholderColor}
                style={[styles.input, { color: colors.text }]}
                value={city}
                onChangeText={setCity}
              />
            </View>

            <View style={[styles.doubleInput, { backgroundColor: colors.surface }, cardBorder]}>
              <TextInput
                placeholder="District"
                placeholderTextColor={placeholderColor}
                style={[styles.input, { color: colors.text }]}
                value={district}
                onChangeText={setDistrict}
              />
            </View>
          </View>

          {/* STATE + PINCODE */}
          <View style={styles.doubleRow}>
            <View style={[styles.doubleInput, { backgroundColor: colors.surface }, cardBorder]}>
              <TextInput
                placeholder="State"
                placeholderTextColor={placeholderColor}
                style={[styles.input, { color: colors.text }]}
                value={state}
                onChangeText={setState}
              />
            </View>

            <View style={[styles.doubleInput, { backgroundColor: colors.surface }, cardBorder]}>
              <TextInput
                placeholder="Pincode"
                placeholderTextColor={placeholderColor}
                style={[styles.input, { color: colors.text }]}
                value={pincode}
                onChangeText={setPincode}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* NOTICE */}
          <View style={styles.locationNotice}>
            <AccessibleText
              variant="label"
              style={styles.locationNoticeText}
            >
              📍 Helps us show nearby services
            </AccessibleText>
          </View>
        </View>
        {/* BUTTON */}
        <AccessibleButton
          onPress={handleContinue}
          disabled={loading}
          style={[styles.buttonWrapper, styles.button]}
          accessibilityLabel="Continue"
          accessibilityHint="Saves your profile information and continues to the next step"
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            "Continue"
          )}
        </AccessibleButton>
      </ScrollView>
    </SafeScreen >
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
      marginBottom: 4,
    },

    heroSubtitle: {
      fontSize: 14,
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

      marginBottom: 16,
    },

    inputContainer: {
      minHeight: 56,

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
      fontWeight: "500",
    },

    dropdownText: {
      flex: 1,
      fontSize: 16,
    },

    dropdownArrow: {
      fontSize: 12,
    },

    dropdownBox: {
      borderRadius: 18,
      marginTop: -8,
      marginBottom: 16,
      overflow: "hidden",
    },

    dropdownItem: {
      paddingVertical: 16,
      paddingHorizontal: 18,
      borderBottomWidth: 1,
    },

    dropdownItemText: {
      fontSize: 15,
      fontWeight: "500",
    },

    usernameContainer: {
      minHeight: 56,

      borderRadius: 24,

      flexDirection: "row",
      alignItems: "center",

      paddingHorizontal: 16,
    },

    usernameAt: {
      fontSize: 18,
      fontWeight: "700",
      marginRight: 6,
    },

    usernameInput: {
      flex: 1,
      fontSize: 16,
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
    },

    suggestionRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },

    suggestionChip: {
      borderRadius: 999,

      paddingHorizontal: 12,
      paddingVertical: 6,
    },

    suggestionText: {
      fontSize: 12,
      fontWeight: "700",
    },

    helperText: {
      marginTop: 18,

      fontSize: 11,
      fontStyle: "italic",
    },

    row: {
      flexDirection: "row",
      justifyContent:
        "space-between",

      marginBottom: 16,
    },

    halfInput: {
      width: "48%",

      minHeight: 56,

      backgroundColor:
        "#F4F3FA",

      borderRadius: 24,

      paddingHorizontal: 16,

      justifyContent:
        "center",
    },

    fullInput: {
      minHeight: 56,

      backgroundColor:
        "#F4F3FA",

      borderRadius: 24,

      paddingHorizontal: 16,

      justifyContent:
        "flex-start",

      marginBottom: 16,
    },

    locationNotice: {
      backgroundColor:
        "rgba(254,166,25,0.1)",

      borderRadius: 24,

      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    locationBtn: {
      backgroundColor: "#F3EAFF",
      minHeight: 58,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },

    locationBtnText: {
      fontWeight: "700",
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
      minHeight: 56,

      borderRadius: 24,

      justifyContent:
        "center",

      alignItems: "center",
    },

    errorText: {
      fontSize: 12,

      marginBottom: 10,
      marginLeft: 4,
    },

    fullWidthInput: {
      minHeight: 58,
      borderRadius: 18,
      paddingHorizontal: 18,
      justifyContent: "center",
      marginBottom: 16,
    },

    doubleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 16,
    },

    doubleInput: {
      width: "48%",
      minHeight: 58,
      borderRadius: 18,
      paddingHorizontal: 18,
      justifyContent: "center",
    },
  });
