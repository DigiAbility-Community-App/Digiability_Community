// ─────────────────────────────────────────────────────────────
// EditProfileScreen.tsx
// Same UI as onboarding profile screens
// But fetches existing DB data + allows editing
// ─────────────────────────────────────────────────────────────

import React, {
    useEffect,
    useState,
} from "react";

import {
    View,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { ConfirmDialog } from "../../components/chat/ConfirmDialog";

import ScreenWrapper from "../../components/layout/ScreenWrapper";
import SafeScreen from "../../components/layout/SafeScreen";
import AppHeader from "../../components/layout/AppHeader";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    useNavigation,
} from "@react-navigation/native";

import { useAuthStore } from "@store/authStore";

import {
    getUserProfile,
    updateUserProfile,
    parseDateInput,
} from "@services/profileService";
import apiClient from "@services/apiClient";
import { sanitizeNameInput, isValidNameFormat } from "../../utils/nameValidation";
import { sanitizeMobileInput, isValidMobileFormat } from "../../utils/mobileValidation";
import { isValidPlaceText } from "../../utils/locationValidation";
import { isValidUsernameFormat } from "../../utils/usernameValidation";

import { useTheme, getFontScale } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import { DisabilityDropdown } from "../../components/shared/DisabilityDropdown";
import { Input } from "../../components/shared/Input";
import DateTimePickerModal from "react-native-modal-datetime-picker";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

// Same vocabulary as onboarding (ProfileDetailsScreen); the live list comes
// from /api/master/disability-types, this is the offline fallback.
const FALLBACK_DISABILITY_OPTIONS = [
    "Visual Impairment",
    "Locomotor Disability",
    "Hearing Impairment",
    "Intellectual Disability",
    "Autism Spectrum",
    "Speech & Language",
    "Physical Disability",
    "Mental Health",
    "Learning Disability",
    "Multiple Disabilities",
];

// No existing canonical list for these two fields — reasonable defaults.
const RELATION_OPTIONS = ["Parent", "Sibling", "Spouse", "Child", "Guardian", "Other"];

const PINCODE_REGEX = /^\d{6}$/;

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1900;

// ─────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────

const EditProfileScreen = () => {
    const navigation =
        useNavigation<any>();

    const { colors, highContrast, textSize } = useTheme();
    const fs = getFontScale(textSize);

    const user = useAuthStore(
        (s) => s.user
    );

    const setUser =
        useAuthStore(
            (s) => s.setUser
        );

    const insets = useSafeAreaInsets();

    // Hairline border in the default state (near-invisible), a solid
    // 2px black border under High Contrast — same convention used for
    // "card" surfaces across the app (see ProfileScreen/ProfileDetailsScreen).
    const cardBorder = highContrast
        ? { borderWidth: 2, borderColor: "#000000" as const }
        : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" as const };

    const placeholderColor = highContrast
        ? "#000000"
        : "rgba(126,115,131,0.6)";

    // ───────────────── BASIC ─────────────────

    const [fullName, setFullName] =
        useState("");

    const [username, setUsername] =
        useState("");

    const [dob, setDob] =
        useState("");

    const [showDatePicker, setShowDatePicker] =
        useState(false);

    const [gender, setGender] =
        useState("");

    const [city, setCity] =
        useState("");

    const [state, setState] =
        useState("");

    const [addressLine1, setAddressLine1] = useState("");
    const [streetArea, setStreetArea] = useState("");
    const [pincode, setPincode] = useState("");
    const [locationDistrict, setLocationDistrict] = useState("");

    const [phoneNo, setPhoneNo] =
        useState("");

    // ───────────────── ROLE ─────────────────

    const roles = user?.roles && user.roles.length > 0
        ? user.roles
        : (user?.role ? [user.role] : []);

    const role = roles[0] || "";

    // ───────────────── PwD ─────────────────

    const [selectedDisabilities, setSelectedDisabilities] = useState<string[]>([]);
    const [disabilityOptions, setDisabilityOptions] = useState<string[]>(FALLBACK_DISABILITY_OPTIONS);

    const toggleDisability = (item: string) => {
        setSelectedDisabilities((prev) =>
            prev.includes(item) ? prev.filter((d) => d !== item) : [...prev, item]
        );
    };

    const [
        disabilitySince,
        setDisabilitySince,
    ] = useState("");

    // ───────────────── Caregiver ─────────────────

    const [personName, setPersonName] =
        useState("");

    const [relation, setRelation] =
        useState("");

    const [careDob, setCareDob] = useState("");
    const [showCareDatePicker, setShowCareDatePicker] = useState(false);

    const [careDisabilities, setCareDisabilities] = useState<string[]>([]);

    const toggleCareDisability = (item: string) => {
        setCareDisabilities((prev) =>
            prev.includes(item) ? prev.filter((d) => d !== item) : [...prev, item]
        );
    };

    // ───────────────── Educator ─────────────────

    const [speciality, setSpeciality] =
        useState("");

    const [organization,
        setOrganization] =
        useState("");

    const [experience,
        setExperience] =
        useState("");

    // ───────────────── NGO ─────────────────

    const [ngoName, setNgoName] =
        useState("");

    const [ngoRole, setNgoRole] =
        useState("");

    const [district, setDistrict] =
        useState("");

    // ───────────────── Skill Trainer ─────────────────

    const [skillsTaught, setSkillsTaught] = useState("");
    const [teachingMode, setTeachingMode] = useState<"physical" | "online" | "both" | "">("");
    const [trainingLocation, setTrainingLocation] = useState("");
    const [trainingAddress, setTrainingAddress] = useState("");

    // ───────────────── COMMON ─────────────────

    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [fieldErrors, setFieldErrors] =
        useState<Record<string, string>>({});

    // Themed replacement for native Alert.alert — same shape used by
    // HomeProfileScreen/ChatScreen so dialogs look consistent app-wide.
    const [confirmState, setConfirmState] = useState<{
        title: string;
        message?: string;
        confirmLabel?: string;
        onConfirm?: () => void;
    } | null>(null);

    // ───────────────── FETCH PROFILE ─────────────────

    useEffect(() => {
        fetchProfile();
    }, []);

    // Load the live disability vocabulary (falls back to the offline list).
    useEffect(() => {
        apiClient
            .get<{ success: boolean; data: { name: string }[] }>("/api/master/disability-types")
            .then(({ data }) => {
                if (data.success && data.data.length > 0) {
                    setDisabilityOptions(data.data.map((t) => t.name));
                }
            })
            .catch(() => {
                // keep FALLBACK_DISABILITY_OPTIONS
            });
    }, []);

    const fetchProfile = async () => {
        try {
            if (!user?.id) return;

            setLoading(true);

            const response =
                await getUserProfile(
                    user.id
                );

            // BASIC
            setFullName(
                response?.fullName || ""
            );

            setUsername(
                response?.username || ""
            );

            setDob(
                response?.dob || ""
            );

            setGender(
                response?.gender || ""
            );

            setCity(
                response?.city || ""
            );

            setState(
                response?.state || ""
            );

            setAddressLine1(response?.addressLine1 || "");
            setStreetArea(response?.streetArea || "");
            setPincode(response?.pincode || "");
            setLocationDistrict(response?.locationDistrict || "");

            setPhoneNo(
                response?.phoneNo || ""
            );

            // ROLE DETAILS
            const details =
                response?.roleDetails;

            if (roles.includes("pwd")) {
                // disabilityType is a comma-separated list (multi-select).
                setSelectedDisabilities(
                    details?.disabilityType
                        ? String(details.disabilityType)
                              .split(",")
                              .map((d: string) => d.trim())
                              .filter(Boolean)
                        : []
                );

                setDisabilitySince(
                    String(
                        details?.disabilitySince ||
                        ""
                    )
                );
            }

            if (
                roles.includes("caregiver")
            ) {
                setPersonName(
                    details?.carePersonName ||
                    ""
                );

                setRelation(
                    details?.careRelation ||
                    ""
                );

                setCareDob(
                    details?.careDob ||
                    ""
                );

                // careDisabilityType is a comma-separated list (multi-select).
                setCareDisabilities(
                    details?.careDisabilityType
                        ? String(details.careDisabilityType)
                              .split(",")
                              .map((d: string) => d.trim())
                              .filter(Boolean)
                        : []
                );
            }

            if (
                roles.includes("educator")
            ) {
                setSpeciality(
                    details?.speciality ||
                    ""
                );

                setOrganization(
                    details?.organization ||
                    ""
                );

                setExperience(
                    String(
                        details?.yearsOfExperience ||
                        ""
                    )
                );
            }

            if (
                roles.includes("ngo_worker")
            ) {
                setNgoName(
                    details?.ngoName ||
                    ""
                );

                setNgoRole(
                    details?.ngoRole ||
                    ""
                );

                setDistrict(
                    details?.district ||
                    ""
                );
            }

            if (roles.includes("skill_trainer")) {
                setSkillsTaught(details?.skillsTaught || "");
                setTeachingMode((details?.teachingMode as any) || "");
                setTrainingLocation(details?.trainingLocation || "");
                setTrainingAddress(details?.trainingAddress || "");
            }

        } catch (error) {
            setConfirmState({
                title: "Error",
                message: "Unable to load profile",
            });
        } finally {
            setLoading(false);
        }
    };

    // ───────────────── BUILD PAYLOAD ─────────────────

    const buildRolePayload =
        () => {
            const payload: any = {};

            if (roles.includes("pwd")) {
                payload.disabilityType = selectedDisabilities.join(", ");
                payload.disabilitySince = disabilitySince ? (parseInt(disabilitySince, 10) || undefined) : undefined;
            }

            if (roles.includes("caregiver")) {
                payload.carePersonName = personName;
                payload.careRelation = relation;
                // careDob is DD/MM/YYYY in the UI; convert to ISO the backend
                // can parse. Empty string clears it.
                payload.careDob = careDob.trim()
                    ? parseDateInput(careDob.trim(), "DMY")
                    : "";
                payload.careDisabilityType = careDisabilities.join(", ");
            }

            if (roles.includes("educator")) {
                payload.speciality = speciality;
                payload.organization = organization;
                payload.yearsOfExperience = experience;
            }

            if (roles.includes("ngo_worker")) {
                payload.ngoName = ngoName;
                payload.ngoRole = ngoRole;
                payload.district = district;
            }

            if (roles.includes("skill_trainer")) {
                payload.skillsTaught = skillsTaught;
                payload.teachingMode = teachingMode;
                const needsLocation = teachingMode === "physical" || teachingMode === "both";
                payload.trainingLocation = needsLocation ? trainingLocation : "";
                payload.trainingAddress = needsLocation ? trainingAddress : "";
            }

            return payload;
        };

    // ───────────────── VALIDATION ─────────────────

    const fieldBorder = (hasError?: boolean) =>
        hasError ? { borderWidth: 1, borderColor: colors.error } : cardBorder;

    const clearError = (field: string) => {
        if (fieldErrors[field]) {
            setFieldErrors((e) => {
                const next = { ...e };
                delete next[field];
                return next;
            });
        }
    };

    const validateYear = (value: string): string | undefined => {
        if (!value.trim()) return undefined;
        if (!/^\d{4}$/.test(value.trim())) return "Enter a valid 4-digit year";
        const y = parseInt(value.trim(), 10);
        if (y < MIN_YEAR || y > CURRENT_YEAR) return `Year must be between ${MIN_YEAR} and ${CURRENT_YEAR}`;
        return undefined;
    };

    const validateFields = () => {
        const newErrors: Record<string, string> = {};

        if (!fullName.trim()) {
            newErrors.fullName = "Full name is required";
        } else if (!isValidNameFormat(fullName)) {
            newErrors.fullName =
                "Name may only contain letters, spaces, and single hyphens or apostrophes between name parts.";
        }

        if (!username.trim()) {
            newErrors.username = "Username is required";
        } else if (!isValidUsernameFormat(username.trim())) {
            newErrors.username =
                "Username may only contain letters, numbers, periods, and underscores (max 15 characters), with at least 3 letters or numbers";
        }

        if (!dob.trim()) {
            newErrors.dob = "Date of birth is required";
        } else {
            const parsed = parseDateInput(dob.trim(), "DMY");
            if (!parsed) {
                newErrors.dob = "Enter a valid date (DD/MM/YYYY)";
            } else if (new Date(parsed).getTime() > Date.now()) {
                newErrors.dob = "Date of birth cannot be in the future";
            }
        }

        if (!gender.trim()) newErrors.gender = "Gender is required";

        if (!city.trim()) {
            newErrors.city = "City is required";
        } else if (!isValidPlaceText(city)) {
            newErrors.city = "City may not be only numbers or symbols";
        }

        if (!state.trim()) {
            newErrors.state = "State is required";
        } else if (!isValidPlaceText(state)) {
            newErrors.state = "State may not be only numbers or symbols";
        }

        if (addressLine1.trim() && !isValidPlaceText(addressLine1)) {
            newErrors.addressLine1 = "Address may not be only numbers or symbols";
        }

        if (streetArea.trim() && !isValidPlaceText(streetArea)) {
            newErrors.streetArea = "Street/Area may not be only numbers or symbols";
        }

        if (locationDistrict.trim() && !isValidPlaceText(locationDistrict)) {
            newErrors.locationDistrict = "District may not be only numbers or symbols";
        }

        if (!pincode.trim()) {
            newErrors.pincode = "Pincode is required";
        } else if (!PINCODE_REGEX.test(pincode.trim())) {
            newErrors.pincode = "Enter a valid 6-digit pincode";
        }

        if (!phoneNo.trim()) {
            newErrors.phoneNo = "Mobile number is required";
        } else if (!isValidMobileFormat(phoneNo.trim())) {
            newErrors.phoneNo = "Enter a valid 10-digit mobile number";
        }

        if (roles.includes("pwd")) {
            if (selectedDisabilities.length === 0) {
                newErrors.disabilityType = "Please select at least one disability type";
            }
            const yearErr = validateYear(disabilitySince);
            if (yearErr) newErrors.disabilitySince = yearErr;
        }

        if (roles.includes("caregiver")) {
            if (!personName.trim()) {
                newErrors.personName = "Person name is required";
            } else if (!isValidNameFormat(personName)) {
                newErrors.personName =
                    "Name may only contain letters, spaces, and single hyphens or apostrophes between name parts";
            }

            if (!relation.trim()) {
                newErrors.relation = "Relation is required";
            }

            if (careDob.trim() && !parseDateInput(careDob.trim(), "DMY")) {
                newErrors.careDob = "Invalid date";
            }
        }

        if (roles.includes("educator")) {
            if (!speciality.trim()) newErrors.speciality = "Speciality is required";
        }

        if (roles.includes("ngo_worker")) {
            if (!ngoName.trim()) newErrors.ngoName = "NGO name is required";
        }

        if (roles.includes("skill_trainer")) {
            if (!skillsTaught.trim()) {
                newErrors.skillsTaught = "Please tell us the skills you teach";
            }
            if (!teachingMode) {
                newErrors.teachingMode = "Please select how you teach";
            }
            if (teachingMode === "physical" || teachingMode === "both") {
                if (!trainingLocation.trim()) {
                    newErrors.trainingLocation = "Training location is required";
                }
                if (!trainingAddress.trim()) {
                    newErrors.trainingAddress = "Address is required";
                } else if (!isValidPlaceText(trainingAddress)) {
                    newErrors.trainingAddress = "Address may not be only numbers or symbols";
                }
            }
        }

        setFieldErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ───────────────── SAVE ─────────────────

    const handleSaveChanges =
        async () => {
            try {
                if (!user?.id) return;

                if (!validateFields()) return;

                setSaving(true);

                await updateUserProfile({
                    userId: user.id,

                    basicProfile: {
                        fullName,
                        username,
                        dob,
                        gender,
                        city,
                        state,
                        addressLine1,
                        streetArea,
                        pincode,
                        locationDistrict,
                        phoneNo,
                    },

                    roleDetails:
                        buildRolePayload(),
                });

                // UPDATE LOCAL STORE
                if (user) {
                    setUser({
                        ...user,
                        name: fullName,
                        fullName,
                        username,
                    });
                }

                // Navigate back only once the user dismisses the dialog —
                // going back immediately would unmount it before it's seen.
                setConfirmState({
                    title: "Success",
                    message: "Profile updated successfully",
                    confirmLabel: "Done",
                    onConfirm: () => navigation.goBack(),
                });

            } catch (error) {
                const err: any = error;
                const message =
                    err?.response?.data?.errors?.[0]?.message ||
                    err?.response?.data?.message;

                setConfirmState({
                    title: "Error",
                    message: message || "Unable to update profile",
                });
            } finally {
                setSaving(false);
            }
        };

    // ───────────────── LOADING ─────────────────

    if (loading) {
        return (
            <SafeScreen
                statusBarStyle="dark"
                style={[
                    styles.loaderContainer,
                    { backgroundColor: colors.background },
                ]}
            >
                <ActivityIndicator
                    size="large"
                    color={colors.primary}
                />
            </SafeScreen>
        );
    }

    // ───────────────── UI ─────────────────

    return (
        <ScreenWrapper statusBarStyle="light">
            {/* HEADER */}
            <AppHeader
                title="Edit Profile"
                onBackPress={() => navigation.goBack()}
            />

            {/* BODY */}
            <KeyboardAwareScrollView
                showsVerticalScrollIndicator={
                    false
                }
                // NOTE: must be a single flat object, not a style array — with
                // enableOnAndroid, this library internally does
                // `(contentContainerStyle || {}).paddingBottom` to add its own
                // keyboard-space padding on top of ours. On an array, that
                // property read is undefined, so its computed replacement
                // becomes the ONLY paddingBottom left after RN flattens the
                // style array — silently discarding ours entirely (0 with the
                // keyboard closed, which is exactly why the last field was
                // sitting flush behind the footer button with no gap at all).
                contentContainerStyle={{
                    ...styles.scrollContent,
                    // Footer button's own footprint is ~ insets.bottom + 24 + 58 —
                    // this needs to clear that with real visual breathing room,
                    // not just barely enough to not technically overlap.
                    paddingBottom: Math.max(insets.bottom + 160, 180),
                }}
                keyboardShouldPersistTaps="handled"
                enableOnAndroid={true}
                enableResetScrollToCoords={false}
                extraScrollHeight={140}
            >
                {/* PROFILE BANNER */}
                <View
                    style={
                        styles.profileBanner
                    }
                >
                    <View
                        style={[styles.avatar, { backgroundColor: colors.primary }]}
                    >
                        <AccessibleText
                            style={[styles.avatarText, { fontSize: fs(28), color: colors.white }]}
                        >
                            {fullName?.charAt(
                                0
                            ) || "U"}
                        </AccessibleText>
                    </View>

                    <View>
                        <AccessibleText
                            style={[styles.bannerName, { fontSize: fs(22), color: colors.text }]}
                        >
                            {fullName ||
                                "Your Profile"}
                        </AccessibleText>

                        <AccessibleText
                            variant="body"
                            style={[styles.bannerRole, { color: colors.subtext }]}
                        >
                            {role}
                        </AccessibleText>
                    </View>
                </View>

                {/* BASIC INFO */}
                <View style={[styles.card, { backgroundColor: colors.card }, cardBorder]}>
                    <AccessibleText
                        style={[styles.sectionTitle, { fontSize: fs(18), color: colors.primary }]}
                    >
                        Basic Information
                    </AccessibleText>

                    <Input
                        label="Full Name"
                        placeholder="Full Name"
                        containerStyle={styles.fieldSpacing}
                        value={fullName}
                        onChangeText={
                            (v: string) => { setFullName(sanitizeNameInput(v)); clearError("fullName"); }
                        }
                        error={fieldErrors.fullName}
                        accessibilityLabel="Full Name"
                    />

                    <Input
                        label="Username"
                        placeholder="Username"
                        containerStyle={styles.fieldSpacing}
                        value={username}
                        onChangeText={
                            (v: string) => { setUsername(v); clearError("username"); }
                        }
                        error={fieldErrors.username}
                        autoCapitalize="none"
                        accessibilityLabel="Username"
                    />

                    {/* DOB */}
                    <AccessibleText variant="label" style={styles.dateLabel}>
                        Date of Birth
                    </AccessibleText>
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => setShowDatePicker(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Date of birth"
                        accessibilityHint={dob ? `Selected: ${dob}. Double tap to change` : "Double tap to open date picker"}
                    >
                        <TextInput
                            placeholder="DOB (DD/MM/YYYY)"
                            placeholderTextColor={placeholderColor}
                            style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, fieldBorder(!!fieldErrors.dob)]}
                            value={dob}
                            editable={false}
                            pointerEvents="none"
                            accessibilityLabel="Date of birth"
                        />
                    </TouchableOpacity>
                    {fieldErrors.dob && (
                        <AccessibleText style={[styles.errorText, { color: colors.error }]} accessibilityRole="alert">
                            {fieldErrors.dob}
                        </AccessibleText>
                    )}
                    <DateTimePickerModal
                        isVisible={showDatePicker}
                        mode="date"
                        maximumDate={new Date()}
                        onConfirm={(date) => {
                            setShowDatePicker(false);
                            const formatted =
                                `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getFullYear()}`;
                            setDob(formatted);
                            clearError("dob");
                        }}
                        onCancel={() => setShowDatePicker(false)}
                    />

                    {/* GENDER */}
                    <AccessibleText
                        variant="label"
                        style={{ color: placeholderColor, marginBottom: 8, marginTop: 4 }}
                    >
                        Gender
                    </AccessibleText>
                    <DisabilityDropdown
                        multi={false}
                        options={["Male", "Female", "Non-binary", "Prefer not to say"]}
                        selected={gender ? [gender] : []}
                        onToggle={(item) => { setGender(item); clearError("gender"); }}
                        label="Gender"
                    />
                    {fieldErrors.gender && (
                        <AccessibleText style={[styles.errorText, { color: colors.error }]} accessibilityRole="alert">
                            {fieldErrors.gender}
                        </AccessibleText>
                    )}

                    <Input
                        label="City"
                        placeholder="City"
                        containerStyle={styles.fieldSpacing}
                        value={city}
                        onChangeText={
                            (v: string) => { setCity(v); clearError("city"); }
                        }
                        error={fieldErrors.city}
                        accessibilityLabel="City"
                    />

                    <Input
                        label="State"
                        placeholder="State"
                        containerStyle={styles.fieldSpacing}
                        value={state}
                        onChangeText={
                            (v: string) => { setState(v); clearError("state"); }
                        }
                        error={fieldErrors.state}
                        accessibilityLabel="State"
                    />

                    <Input
                        label="Address Line 1"
                        placeholder="Address Line 1"
                        containerStyle={styles.fieldSpacing}
                        value={addressLine1}
                        onChangeText={(v: string) => { setAddressLine1(v); clearError("addressLine1"); }}
                        error={fieldErrors.addressLine1}
                        accessibilityLabel="Address line 1"
                    />

                    <Input
                        label="Street / Area"
                        placeholder="Street / Area"
                        containerStyle={styles.fieldSpacing}
                        value={streetArea}
                        onChangeText={(v: string) => { setStreetArea(v); clearError("streetArea"); }}
                        error={fieldErrors.streetArea}
                        accessibilityLabel="Street or area"
                    />

                    <Input
                        label="District"
                        placeholder="District"
                        containerStyle={styles.fieldSpacing}
                        value={locationDistrict}
                        onChangeText={(v: string) => { setLocationDistrict(v); clearError("locationDistrict"); }}
                        error={fieldErrors.locationDistrict}
                        accessibilityLabel="District"
                    />

                    <Input
                        label="Pincode"
                        placeholder="Pincode"
                        containerStyle={styles.fieldSpacing}
                        value={pincode}
                        onChangeText={(v: string) => { setPincode(v); clearError("pincode"); }}
                        error={fieldErrors.pincode}
                        keyboardType="number-pad"
                        maxLength={6}
                        accessibilityLabel="Pincode"
                    />

                    <Input
                        label="Phone Number"
                        placeholder="Phone Number"
                        containerStyle={styles.fieldSpacing}
                        value={phoneNo}
                        onChangeText={(v: string) => { setPhoneNo(sanitizeMobileInput(v)); clearError("phoneNo"); }}
                        error={fieldErrors.phoneNo}
                        keyboardType="phone-pad"
                        maxLength={10}
                        accessibilityLabel="Phone number"
                    />
                </View>

                {/* PwD */}
                {roles.includes("pwd") && (
                    <View
                        style={[styles.card, { backgroundColor: colors.card }, cardBorder]}
                    >
                        <AccessibleText
                            style={[styles.sectionTitle, { fontSize: fs(18), color: colors.primary }]}
                        >
                            Disability Details
                        </AccessibleText>

                        <DisabilityDropdown
                            options={disabilityOptions}
                            selected={selectedDisabilities}
                            onToggle={(item) => { toggleDisability(item); clearError("disabilityType"); }}
                            label="Disability types"
                        />
                        {fieldErrors.disabilityType && (
                            <AccessibleText style={[styles.errorText, { color: colors.error }]} accessibilityRole="alert">
                                {fieldErrors.disabilityType}
                            </AccessibleText>
                        )}

                        <Input
                            label="Disability Since"
                            placeholder="Disability Since"
                            containerStyle={styles.fieldSpacing}
                            value={
                                disabilitySince
                            }
                            onChangeText={
                                (v: string) => { setDisabilitySince(v); clearError("disabilitySince"); }
                            }
                            error={fieldErrors.disabilitySince}
                            keyboardType="number-pad"
                            maxLength={4}
                            accessibilityLabel="Disability since year"
                        />

                    </View>
                )}

                {/* CAREGIVER */}
                {roles.includes("caregiver") && (
                        <View
                            style={[styles.card, { backgroundColor: colors.card }, cardBorder]}
                        >
                            <AccessibleText
                                style={[styles.sectionTitle, { fontSize: fs(18), color: colors.primary }]}
                            >
                                Caregiver Details
                            </AccessibleText>

                            <Input
                                label="Person Name"
                                placeholder="Person Name"
                                containerStyle={styles.fieldSpacing}
                                value={personName}
                                onChangeText={
                                    (v: string) => { setPersonName(sanitizeNameInput(v)); clearError("personName"); }
                                }
                                error={fieldErrors.personName}
                                accessibilityLabel="Person name"
                            />

                            {/* RELATION */}
                            <AccessibleText
                                variant="label"
                                style={{ color: placeholderColor, marginBottom: 8, marginTop: 4 }}
                            >
                                Relation
                            </AccessibleText>
                            <DisabilityDropdown
                                multi={false}
                                options={RELATION_OPTIONS}
                                selected={relation ? [relation] : []}
                                onToggle={(item) => { setRelation(item); clearError("relation"); }}
                                label="Relation"
                            />
                            {fieldErrors.relation && (
                                <AccessibleText style={[styles.errorText, { color: colors.error }]} accessibilityRole="alert">
                                    {fieldErrors.relation}
                                </AccessibleText>
                            )}

                            {/* CARE RECIPIENT DOB — optional */}
                            <AccessibleText variant="label" style={styles.dateLabel}>
                                Date of Birth
                            </AccessibleText>
                            <TouchableOpacity
                                activeOpacity={0.9}
                                onPress={() => setShowCareDatePicker(true)}
                                accessibilityRole="button"
                                accessibilityLabel="Care recipient date of birth"
                                accessibilityHint={careDob ? `Selected: ${careDob}. Double tap to change` : "Double tap to open date picker. Optional."}
                            >
                                <TextInput
                                    placeholder="Date of Birth (DD/MM/YYYY)"
                                    placeholderTextColor={placeholderColor}
                                    style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, fieldBorder(!!fieldErrors.careDob)]}
                                    value={careDob}
                                    editable={false}
                                    pointerEvents="none"
                                    accessibilityLabel="Care recipient date of birth"
                                />
                            </TouchableOpacity>
                            {fieldErrors.careDob && (
                                <AccessibleText style={[styles.errorText, { color: colors.error }]} accessibilityRole="alert">
                                    {fieldErrors.careDob}
                                </AccessibleText>
                            )}
                            <DateTimePickerModal
                                isVisible={showCareDatePicker}
                                mode="date"
                                maximumDate={new Date()}
                                onConfirm={(date) => {
                                    setShowCareDatePicker(false);
                                    const formatted =
                                        `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getFullYear()}`;
                                    setCareDob(formatted);
                                    clearError("careDob");
                                }}
                                onCancel={() => setShowCareDatePicker(false)}
                            />

                            <AccessibleText
                                variant="label"
                                style={{ color: placeholderColor, marginBottom: 8, marginTop: 4 }}
                            >
                                Disability Type(s)
                            </AccessibleText>

                            <DisabilityDropdown
                                options={disabilityOptions}
                                selected={careDisabilities}
                                onToggle={toggleCareDisability}
                                label="Care recipient disability types"
                            />
                        </View>
                    )}

                {/* EDUCATOR */}
                {roles.includes("educator") && (
                        <View
                            style={[styles.card, { backgroundColor: colors.card }, cardBorder]}
                        >
                            <AccessibleText
                                style={[styles.sectionTitle, { fontSize: fs(18), color: colors.primary }]}
                            >
                                Professional Info
                            </AccessibleText>

                            <Input
                                label="Speciality"
                                placeholder="Speciality"
                                containerStyle={styles.fieldSpacing}
                                value={
                                    speciality
                                }
                                onChangeText={
                                    (v: string) => { setSpeciality(v); clearError("speciality"); }
                                }
                                error={fieldErrors.speciality}
                                accessibilityLabel="Speciality"
                            />

                            <Input
                                label="Organization"
                                placeholder="Organization"
                                containerStyle={styles.fieldSpacing}
                                value={
                                    organization
                                }
                                onChangeText={
                                    setOrganization
                                }
                                accessibilityLabel="Organization"
                            />

                            <Input
                                label="Experience"
                                placeholder="Experience"
                                containerStyle={styles.fieldSpacing}
                                value={
                                    experience
                                }
                                onChangeText={
                                    setExperience
                                }
                                keyboardType="number-pad"
                                accessibilityLabel="Years of experience"
                            />
                        </View>
                    )}

                {/* NGO */}
                {roles.includes("ngo_worker") && (
                        <View
                            style={[styles.card, { backgroundColor: colors.card }, cardBorder]}
                        >
                            <AccessibleText
                                style={[styles.sectionTitle, { fontSize: fs(18), color: colors.primary }]}
                            >
                                NGO Details
                            </AccessibleText>

                            <Input
                                label="NGO Name"
                                placeholder="NGO Name"
                                containerStyle={styles.fieldSpacing}
                                value={ngoName}
                                onChangeText={
                                    (v: string) => { setNgoName(v); clearError("ngoName"); }
                                }
                                error={fieldErrors.ngoName}
                                accessibilityLabel="NGO name"
                            />

                            <Input
                                label="Role"
                                placeholder="Role"
                                containerStyle={styles.fieldSpacing}
                                value={ngoRole}
                                onChangeText={setNgoRole}
                                accessibilityLabel="Your role at the NGO"
                            />

                            <Input
                                label="District"
                                placeholder="District"
                                containerStyle={{ marginBottom: 14, marginTop: 14 }}
                                value={district}
                                onChangeText={
                                    setDistrict
                                }
                                accessibilityLabel="District"
                            />
                        </View>
                    )}

                {/* SKILL TRAINER */}
                {roles.includes("skill_trainer") && (
                        <View
                            style={[styles.card, { backgroundColor: colors.card }, cardBorder]}
                        >
                            <AccessibleText
                                style={[styles.sectionTitle, { fontSize: fs(18), color: colors.primary }]}
                            >
                                Skill Training Info
                            </AccessibleText>

                            <Input
                                label="Name of skills you teach"
                                placeholder="e.g. Tailoring, Computer Basics"
                                containerStyle={styles.fieldSpacing}
                                value={skillsTaught}
                                onChangeText={
                                    (v: string) => { setSkillsTaught(v); clearError("skillsTaught"); }
                                }
                                error={fieldErrors.skillsTaught}
                                accessibilityLabel="Skills you teach"
                            />

                            <AccessibleText
                                variant="label"
                                style={{ color: placeholderColor, marginBottom: 8, marginTop: 4 }}
                            >
                                How do you teach the skill?
                            </AccessibleText>
                            <View style={styles.modeRow}>
                                {(["physical", "online", "both"] as const).map((mode) => {
                                    const selected = teachingMode === mode;
                                    return (
                                        <TouchableOpacity
                                            key={mode}
                                            style={[
                                                styles.modeChip,
                                                { backgroundColor: selected ? colors.primary : colors.surface },
                                                highContrast && { borderWidth: 2, borderColor: "#000000" },
                                            ]}
                                            onPress={() => { setTeachingMode(mode); clearError("teachingMode"); }}
                                            accessibilityRole="radio"
                                            accessibilityState={{ checked: selected }}
                                            accessibilityLabel={mode === "physical" ? "Physical" : mode === "online" ? "Online" : "Both"}
                                        >
                                            <AccessibleText style={[styles.modeChipText, { color: selected ? "#FFFFFF" : colors.text }]}>
                                                {mode === "physical" ? "Physical" : mode === "online" ? "Online" : "Both"}
                                            </AccessibleText>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            {fieldErrors.teachingMode && (
                                <AccessibleText style={[styles.errorText, { color: colors.error, marginTop: 8 }]} accessibilityRole="alert">
                                    {fieldErrors.teachingMode}
                                </AccessibleText>
                            )}

                            {(teachingMode === "physical" || teachingMode === "both") && (
                                <>
                                    <Input
                                        label="Location where you provide the skill training"
                                        placeholder="e.g. Andheri, Mumbai"
                                        containerStyle={{ marginBottom: 14, marginTop: 14 }}
                                        value={trainingLocation}
                                        onChangeText={
                                            (v: string) => { setTrainingLocation(v); clearError("trainingLocation"); }
                                        }
                                        error={fieldErrors.trainingLocation}
                                        accessibilityLabel="Training location"
                                    />

                                    <Input
                                        label="Address"
                                        placeholder="Full address"
                                        containerStyle={{ marginBottom: 14 }}
                                        value={trainingAddress}
                                        onChangeText={
                                            (v: string) => { setTrainingAddress(v); clearError("trainingAddress"); }
                                        }
                                        error={fieldErrors.trainingAddress}
                                        accessibilityLabel="Training address"
                                    />
                                </>
                            )}
                        </View>
                    )}
            </KeyboardAwareScrollView>

            {/* FOOTER */}
            <View style={[styles.footer, { bottom: Math.max(insets.bottom, 24) }]}>
                <AccessibleButton
                    variant="primary"
                    onPress={handleSaveChanges}
                    disabled={saving}
                    style={styles.button}
                    accessibilityLabel="Save Changes"
                    accessibilityHint="Saves your updated profile information"
                >
                    {saving ? (
                        <ActivityIndicator color={colors.white} />
                    ) : (
                        "Save Changes"
                    )}
                </AccessibleButton>
            </View>

            {/* These are single-button info dialogs, so dismissing via the
                backdrop means the same thing as tapping the button. The action
                lives in onCancel because ConfirmDialog fires onCancel on both
                paths (and calls it before onConfirm), which would otherwise
                run the action twice on a button press. */}
            <ConfirmDialog
                visible={!!confirmState}
                title={confirmState?.title ?? ""}
                message={confirmState?.message}
                confirmLabel={confirmState?.confirmLabel ?? "OK"}
                hideCancel
                onConfirm={() => { }}
                onCancel={() => {
                    const action = confirmState?.onConfirm;
                    setConfirmState(null);
                    action?.();
                }}
            />
        </ScreenWrapper>
    );
};

export default EditProfileScreen;

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────

const styles =
    StyleSheet.create({
        loaderContainer: {
            flex: 1,
            justifyContent:
                "center",
            alignItems: "center",
        },

        scrollContent: {
            paddingHorizontal: 20,
            paddingBottom: 140,
        },

        profileBanner: {
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 24,
        },

        avatar: {
            width: 70,
            height: 70,
            borderRadius: 35,

            justifyContent:
                "center",

            alignItems: "center",

            marginRight: 16,
        },

        avatarText: {
            fontWeight: "700",
        },

        bannerName: {
            fontWeight: "700",
        },

        bannerRole: {
            marginTop: 4,
            textTransform:
                "capitalize",
        },

        card: {
            borderRadius: 20,

            padding: 18,

            marginBottom: 20,

            shadowColor: "#000",
            shadowOpacity: 0.05,
            shadowRadius: 8,

            elevation: 3,
        },

        sectionTitle: {
            fontWeight: "700",

            marginBottom: 18,
        },

        input: {
            minHeight: 56,

            borderRadius: 16,

            paddingHorizontal: 16,

            fontSize: 15,

            marginBottom: 14,
        },

        errorText: {
            fontSize: 12,
            marginTop: -8,
            marginBottom: 8,
            marginLeft: 4,
        },

        fieldSpacing: {
            marginBottom: 14,
        },

        modeRow: {
            flexDirection: "row",
            gap: 10,
        },

        modeChip: {
            flex: 1,
            minHeight: 48,
            borderRadius: 14,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 8,
        },

        modeChipText: {
            fontSize: 14,
            fontWeight: "600",
        },

        // Matches the Input component's own label styling so the date fields
        // line up with the labelled text fields around them.
        dateLabel: {
            textTransform: "uppercase",
            marginBottom: 6,
        },

        footer: {
            position: "absolute",
            left: 20,
            right: 20,
            bottom: 24,
        },

        button: {
            minHeight: 58,

            borderRadius: 18,

            justifyContent:
                "center",

            alignItems: "center",
        },
    });