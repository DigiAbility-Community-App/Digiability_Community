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
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
} from "react-native";

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

import { useTheme, getFontScale } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";

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

const supportOptions = [
    "Mobility",
    "Communication",
    "Learning",
    "Daily Tasks",
];

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

    const [
        selectedSupport,
        setSelectedSupport,
    ] = useState("");

    // ───────────────── Caregiver ─────────────────

    const [personName, setPersonName] =
        useState("");

    const [relation, setRelation] =
        useState("");

    const [careDob, setCareDob] = useState("");

    const [careDisability,
        setCareDisability] =
        useState("");

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

    // ───────────────── COMMON ─────────────────

    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

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

                setSelectedSupport(
                    details?.supportNeeded ||
                    ""
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

                setCareDisability(
                    details?.careDisabilityType ||
                    ""
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

        } catch (error) {
            Alert.alert(
                "Error",
                "Unable to load profile"
            );
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
                payload.supportNeeded = selectedSupport;
            }

            if (roles.includes("caregiver")) {
                payload.carePersonName = personName;
                payload.careRelation = relation;
                // careDob is DD/MM/YYYY in the UI; convert to ISO the backend
                // can parse. Empty string clears it.
                payload.careDob = careDob.trim()
                    ? parseDateInput(careDob.trim(), "DMY")
                    : "";
                payload.careDisabilityType = careDisability;
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

            return payload;
        };

    // ───────────────── SAVE ─────────────────

    const handleSaveChanges =
        async () => {
            try {
                if (!user?.id) return;

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

                Alert.alert(
                    "Success",
                    "Profile updated successfully"
                );

                navigation.goBack();

            } catch (error) {
                Alert.alert(
                    "Error",
                    "Unable to update profile"
                );
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
            <ScrollView
                showsVerticalScrollIndicator={
                    false
                }
                contentContainerStyle={
                    styles.scrollContent
                }
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

                    <TextInput
                        placeholder="Full Name"
                        placeholderTextColor={placeholderColor}
                        style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                        value={fullName}
                        onChangeText={
                            setFullName
                        }
                        accessibilityLabel="Full Name"
                    />

                    <TextInput
                        placeholder="Username"
                        placeholderTextColor={placeholderColor}
                        style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                        value={username}
                        onChangeText={
                            setUsername
                        }
                        autoCapitalize="none"
                        accessibilityLabel="Username"
                    />

                    <TextInput
                        placeholder="DOB"
                        placeholderTextColor={placeholderColor}
                        style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                        value={dob}
                        onChangeText={
                            setDob
                        }
                        accessibilityLabel="Date of birth"
                    />

                    <TextInput
                        placeholder="Gender"
                        placeholderTextColor={placeholderColor}
                        style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                        value={gender}
                        onChangeText={
                            setGender
                        }
                        accessibilityLabel="Gender"
                    />

                    <TextInput
                        placeholder="City"
                        placeholderTextColor={placeholderColor}
                        style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                        value={city}
                        onChangeText={
                            setCity
                        }
                        accessibilityLabel="City"
                    />

                    <TextInput
                        placeholder="State"
                        placeholderTextColor={placeholderColor}
                        style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                        value={state}
                        onChangeText={
                            setState
                        }
                        accessibilityLabel="State"
                    />

                    <TextInput
                        placeholder="Address Line 1"
                        placeholderTextColor={placeholderColor}
                        style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                        value={addressLine1}
                        onChangeText={setAddressLine1}
                        accessibilityLabel="Address line 1"
                    />

                    <TextInput
                        placeholder="Street / Area"
                        placeholderTextColor={placeholderColor}
                        style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                        value={streetArea}
                        onChangeText={setStreetArea}
                        accessibilityLabel="Street or area"
                    />

                    <TextInput
                        placeholder="District"
                        placeholderTextColor={placeholderColor}
                        style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                        value={locationDistrict}
                        onChangeText={setLocationDistrict}
                        accessibilityLabel="District"
                    />

                    <TextInput
                        placeholder="Pincode"
                        placeholderTextColor={placeholderColor}
                        style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                        value={pincode}
                        onChangeText={setPincode}
                        keyboardType="number-pad"
                        maxLength={6}
                        accessibilityLabel="Pincode"
                    />

                    <TextInput
                        placeholder="Phone Number"
                        placeholderTextColor={placeholderColor}
                        style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                        value={phoneNo}
                        onChangeText={setPhoneNo}
                        keyboardType="phone-pad"
                        maxLength={15}
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

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={
                                false
                            }
                            style={
                                styles.chipsScroll
                            }
                        >
                            {disabilityOptions.map(
                                (item) => {
                                    const selected =
                                        selectedDisabilities.includes(item);

                                    return (
                                        <TouchableOpacity
                                            key={item}
                                            style={[
                                                styles.chip,
                                                { backgroundColor: colors.surface },
                                                cardBorder,

                                                selected && {
                                                    backgroundColor: highContrast ? "#000000" : colors.primary,
                                                    borderColor: highContrast ? "#000000" : colors.primary,
                                                },
                                            ]}
                                            onPress={() =>
                                                toggleDisability(item)
                                            }
                                            accessibilityRole="checkbox"
                                            accessibilityState={{ checked: selected }}
                                            accessibilityLabel={item}
                                        >
                                            <AccessibleText
                                                variant="body"
                                                style={[
                                                    styles.chipText,
                                                    { color: colors.subtext },

                                                    selected &&
                                                    styles.selectedChipText,
                                                ]}
                                            >
                                                {item}
                                            </AccessibleText>
                                        </TouchableOpacity>
                                    );
                                }
                            )}
                        </ScrollView>

                        <TextInput
                            placeholder="Disability Since"
                            placeholderTextColor={placeholderColor}
                            style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                            value={
                                disabilitySince
                            }
                            onChangeText={
                                setDisabilitySince
                            }
                            keyboardType="number-pad"
                            maxLength={4}
                            accessibilityLabel="Disability since year"
                        />

                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={
                                false
                            }
                            style={
                                styles.chipsScroll
                            }
                        >
                            {supportOptions.map(
                                (item) => {
                                    const selected =
                                        selectedSupport ===
                                        item;

                                    return (
                                        <TouchableOpacity
                                            key={item}
                                            style={[
                                                styles.chip,
                                                { backgroundColor: colors.surface },
                                                cardBorder,

                                                selected && {
                                                    backgroundColor: highContrast ? "#000000" : colors.primary,
                                                    borderColor: highContrast ? "#000000" : colors.primary,
                                                },
                                            ]}
                                            onPress={() =>
                                                setSelectedSupport(
                                                    item
                                                )
                                            }
                                            accessibilityRole="radio"
                                            accessibilityState={{ checked: selected }}
                                            accessibilityLabel={item}
                                        >
                                            <AccessibleText
                                                variant="body"
                                                style={[
                                                    styles.chipText,
                                                    { color: colors.subtext },

                                                    selected &&
                                                    styles.selectedChipText,
                                                ]}
                                            >
                                                {item}
                                            </AccessibleText>
                                        </TouchableOpacity>
                                    );
                                }
                            )}
                        </ScrollView>
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

                            <TextInput
                                placeholder="Person Name"
                                placeholderTextColor={placeholderColor}
                                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                                value={personName}
                                onChangeText={
                                    setPersonName
                                }
                                accessibilityLabel="Person name"
                            />

                            <TextInput
                                placeholder="Relation"
                                placeholderTextColor={placeholderColor}
                                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                                value={relation}
                                onChangeText={
                                    setRelation
                                }
                                accessibilityLabel="Relation"
                            />

                            <TextInput
                                placeholder="Date of Birth (DD/MM/YYYY)"
                                placeholderTextColor={placeholderColor}
                                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                                value={careDob}
                                onChangeText={setCareDob}
                                accessibilityLabel="Care recipient date of birth"
                                accessibilityHint="Format: day, month, year"
                            />

                            <TextInput
                                placeholder="Disability Type"
                                placeholderTextColor={placeholderColor}
                                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                                value={
                                    careDisability
                                }
                                onChangeText={
                                    setCareDisability
                                }
                                accessibilityLabel="Disability type"
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

                            <TextInput
                                placeholder="Speciality"
                                placeholderTextColor={placeholderColor}
                                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                                value={
                                    speciality
                                }
                                onChangeText={
                                    setSpeciality
                                }
                                accessibilityLabel="Speciality"
                            />

                            <TextInput
                                placeholder="Organization"
                                placeholderTextColor={placeholderColor}
                                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                                value={
                                    organization
                                }
                                onChangeText={
                                    setOrganization
                                }
                                accessibilityLabel="Organization"
                            />

                            <TextInput
                                placeholder="Experience"
                                placeholderTextColor={placeholderColor}
                                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
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

                            <TextInput
                                placeholder="NGO Name"
                                placeholderTextColor={placeholderColor}
                                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                                value={ngoName}
                                onChangeText={
                                    setNgoName
                                }
                                accessibilityLabel="NGO name"
                            />

                            <TextInput
                                placeholder="Role"
                                placeholderTextColor={placeholderColor}
                                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                                value={ngoRole}
                                onChangeText={
                                    setNgoRole
                                }
                                accessibilityLabel="Your role at the NGO"
                            />

                            <TextInput
                                placeholder="District"
                                placeholderTextColor={placeholderColor}
                                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, cardBorder]}
                                value={district}
                                onChangeText={
                                    setDistrict
                                }
                                accessibilityLabel="District"
                            />
                        </View>
                    )}

                <View
                    style={{ height: 120 }}
                />
            </ScrollView>

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

        chipsScroll: {
            marginBottom: 14,
        },

        chip: {
            paddingHorizontal: 16,
            paddingVertical: 10,

            borderRadius: 999,

            marginRight: 10,
        },

        chipText: {
            fontWeight: "600",
        },

        selectedChipText: {
            color: "#FFFFFF",
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