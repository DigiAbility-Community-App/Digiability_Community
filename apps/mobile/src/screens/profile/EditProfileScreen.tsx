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
    Text,
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

import { LinearGradient } from "expo-linear-gradient";

import {
    useNavigation,
} from "@react-navigation/native";

import { useAuthStore } from "@store/authStore";

import {
    getUserProfile,
    updateUserProfile,
} from "@services/profileService";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const disabilityOptions = [
    "Visual",
    "Hearing",
    "Mobility",
    "Cognitive",
    "Speech",
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

    const user = useAuthStore(
        (s) => s.user
    );

    const setUser =
        useAuthStore(
            (s) => s.setUser
        );

    const insets = useSafeAreaInsets();

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

    // ───────────────── ROLE ─────────────────

    const roles = user?.roles && user.roles.length > 0
        ? user.roles
        : (user?.role ? [user.role] : []);

    const role = roles[0] || "";

    // ───────────────── PwD ─────────────────

    const [
        selectedDisability,
        setSelectedDisability,
    ] = useState("");

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

            // ROLE DETAILS
            const details =
                response?.roleDetails;

            if (roles.includes("pwd")) {
                setSelectedDisability(
                    details?.disabilityType ||
                    ""
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
                payload.disabilityType = selectedDisability;
                payload.disabilitySince = disabilitySince;
                payload.supportNeeded = selectedSupport;
            }

            if (roles.includes("caregiver")) {
                payload.carePersonName = personName;
                payload.careRelation = relation;
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
                style={
                    styles.loaderContainer
                }
            >
                <ActivityIndicator
                    size="large"
                    color="#500088"
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
                        style={styles.avatar}
                    >
                        <Text
                            style={
                                styles.avatarText
                            }
                        >
                            {fullName?.charAt(
                                0
                            ) || "U"}
                        </Text>
                    </View>

                    <View>
                        <Text
                            style={
                                styles.bannerName
                            }
                        >
                            {fullName ||
                                "Your Profile"}
                        </Text>

                        <Text
                            style={
                                styles.bannerRole
                            }
                        >
                            {role}
                        </Text>
                    </View>
                </View>

                {/* BASIC INFO */}
                <View style={styles.card}>
                    <Text
                        style={
                            styles.sectionTitle
                        }
                    >
                        Basic Information
                    </Text>

                    <TextInput
                        placeholder="Full Name"
                        style={styles.input}
                        value={fullName}
                        onChangeText={
                            setFullName
                        }
                    />

                    <TextInput
                        placeholder="Username"
                        style={styles.input}
                        value={username}
                        onChangeText={
                            setUsername
                        }
                    />

                    <TextInput
                        placeholder="DOB"
                        style={styles.input}
                        value={dob}
                        onChangeText={
                            setDob
                        }
                    />

                    <TextInput
                        placeholder="Gender"
                        style={styles.input}
                        value={gender}
                        onChangeText={
                            setGender
                        }
                    />

                    <TextInput
                        placeholder="City"
                        style={styles.input}
                        value={city}
                        onChangeText={
                            setCity
                        }
                    />

                    <TextInput
                        placeholder="State"
                        style={styles.input}
                        value={state}
                        onChangeText={
                            setState
                        }
                    />
                </View>

                {/* PwD */}
                {roles.includes("pwd") && (
                    <View
                        style={styles.card}
                    >
                        <Text
                            style={
                                styles.sectionTitle
                            }
                        >
                            Disability Details
                        </Text>

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
                                        selectedDisability ===
                                        item;

                                    return (
                                        <TouchableOpacity
                                            key={item}
                                            style={[
                                                styles.chip,

                                                selected &&
                                                styles.selectedChip,
                                            ]}
                                            onPress={() =>
                                                setSelectedDisability(
                                                    item
                                                )
                                            }
                                        >
                                            <Text
                                                style={[
                                                    styles.chipText,

                                                    selected &&
                                                    styles.selectedChipText,
                                                ]}
                                            >
                                                {item}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                }
                            )}
                        </ScrollView>

                        <TextInput
                            placeholder="Disability Since"
                            style={styles.input}
                            value={
                                disabilitySince
                            }
                            onChangeText={
                                setDisabilitySince
                            }
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

                                                selected &&
                                                styles.selectedChip,
                                            ]}
                                            onPress={() =>
                                                setSelectedSupport(
                                                    item
                                                )
                                            }
                                        >
                                            <Text
                                                style={[
                                                    styles.chipText,

                                                    selected &&
                                                    styles.selectedChipText,
                                                ]}
                                            >
                                                {item}
                                            </Text>
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
                            style={styles.card}
                        >
                            <Text
                                style={
                                    styles.sectionTitle
                                }
                            >
                                Caregiver Details
                            </Text>

                            <TextInput
                                placeholder="Person Name"
                                style={styles.input}
                                value={personName}
                                onChangeText={
                                    setPersonName
                                }
                            />

                            <TextInput
                                placeholder="Relation"
                                style={styles.input}
                                value={relation}
                                onChangeText={
                                    setRelation
                                }
                            />

                            <TextInput
                                placeholder="Disability Type"
                                style={styles.input}
                                value={
                                    careDisability
                                }
                                onChangeText={
                                    setCareDisability
                                }
                            />
                        </View>
                    )}

                {/* EDUCATOR */}
                {roles.includes("educator") && (
                        <View
                            style={styles.card}
                        >
                            <Text
                                style={
                                    styles.sectionTitle
                                }
                            >
                                Professional Info
                            </Text>

                            <TextInput
                                placeholder="Speciality"
                                style={styles.input}
                                value={
                                    speciality
                                }
                                onChangeText={
                                    setSpeciality
                                }
                            />

                            <TextInput
                                placeholder="Organization"
                                style={styles.input}
                                value={
                                    organization
                                }
                                onChangeText={
                                    setOrganization
                                }
                            />

                            <TextInput
                                placeholder="Experience"
                                style={styles.input}
                                value={
                                    experience
                                }
                                onChangeText={
                                    setExperience
                                }
                            />
                        </View>
                    )}

                {/* NGO */}
                {roles.includes("ngo_worker") && (
                        <View
                            style={styles.card}
                        >
                            <Text
                                style={
                                    styles.sectionTitle
                                }
                            >
                                NGO Details
                            </Text>

                            <TextInput
                                placeholder="NGO Name"
                                style={styles.input}
                                value={ngoName}
                                onChangeText={
                                    setNgoName
                                }
                            />

                            <TextInput
                                placeholder="Role"
                                style={styles.input}
                                value={ngoRole}
                                onChangeText={
                                    setNgoRole
                                }
                            />

                            <TextInput
                                placeholder="District"
                                style={styles.input}
                                value={district}
                                onChangeText={
                                    setDistrict
                                }
                            />
                        </View>
                    )}

                <View
                    style={{ height: 120 }}
                />
            </ScrollView>

            {/* FOOTER */}
            <View style={[styles.footer, { bottom: Math.max(insets.bottom, 24) }]}>
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={
                        handleSaveChanges
                    }
                    disabled={saving}
                >
                    <LinearGradient
                        colors={[
                            "#500088",
                            "#6B21A8",
                        ]}
                        style={styles.button}
                    >
                        {saving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text
                                style={
                                    styles.buttonText
                                }
                            >
                                Save Changes
                            </Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
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
        container: {
            flex: 1,
            backgroundColor:
                "#FAF8FF",
        },

        loaderContainer: {
            flex: 1,
            justifyContent:
                "center",
            alignItems: "center",
            backgroundColor:
                "#FAF8FF",
        },

        header: {
            height: 64,
            paddingHorizontal: 20,

            flexDirection: "row",
            alignItems: "center",
            justifyContent:
                "space-between",
        },

        backButton: {
            width: 32,
            height: 32,

            justifyContent:
                "center",
            alignItems: "center",
        },

        backText: {
            fontSize: 22,
            color: "#500088",
            fontWeight: "700",
        },

        headerTitle: {
            fontSize: 18,
            fontWeight: "700",
            color: "#1A1B20",
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

            backgroundColor:
                "#500088",

            justifyContent:
                "center",

            alignItems: "center",

            marginRight: 16,
        },

        avatarText: {
            color: "#fff",
            fontSize: 28,
            fontWeight: "700",
        },

        bannerName: {
            fontSize: 22,
            fontWeight: "700",
            color: "#1A1B20",
        },

        bannerRole: {
            color: "#6B7280",
            marginTop: 4,
            textTransform:
                "capitalize",
        },

        card: {
            backgroundColor:
                "#FFFFFF",

            borderRadius: 20,

            padding: 18,

            marginBottom: 20,

            shadowColor: "#000",
            shadowOpacity: 0.05,
            shadowRadius: 8,

            elevation: 3,
        },

        sectionTitle: {
            fontSize: 18,
            fontWeight: "700",
            color: "#500088",

            marginBottom: 18,
        },

        input: {
            height: 56,

            backgroundColor:
                "#F4F3FA",

            borderRadius: 16,

            paddingHorizontal: 16,

            fontSize: 15,

            marginBottom: 14,
        },

        chipsScroll: {
            marginBottom: 14,
        },

        chip: {
            backgroundColor:
                "#F4F3FA",

            paddingHorizontal: 16,
            paddingVertical: 10,

            borderRadius: 999,

            marginRight: 10,
        },

        selectedChip: {
            backgroundColor:
                "#500088",
        },

        chipText: {
            color: "#4C4452",
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
            height: 58,

            borderRadius: 18,

            justifyContent:
                "center",

            alignItems: "center",
        },

        buttonText: {
            color: "#FFFFFF",
            fontSize: 16,
            fontWeight: "700",
        },
    });