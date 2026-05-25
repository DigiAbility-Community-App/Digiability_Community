import React from "react";

import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Image,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";

const ProfileScreen = () => {
    const navigation = useNavigation<any>();

    const familySupport = [
        {
            title: "Care Circle",
            subtitle: "3 members",
            icon: "👨‍👩‍👧",
            bg: "#F1DBFF",
        },

        {
            title: "Emergency SOS",
            subtitle: "Safety settings",
            icon: "🚨",
            bg: "#FEE2E2",
        },

        {
            title: "Medical Records",
            subtitle: "Synced securely",
            icon: "📄",
            bg: "#D1FAE5",
        },
    ];

    const accountSettings = [
        {
            title: "Accessibility",
            subtitle: "",
            icon: "♿",
        },

        {
            title: "Notifications",
            subtitle: "Push enabled",
            icon: "🔔",
        },

        {
            title: "Privacy & Security",
            subtitle: "",
            icon: "🔒",
        },

        {
            title: "Language",
            subtitle: "English",
            icon: "🌐",
        },
    ];

    const supportItems = [
        {
            title: "Help Center",
            icon: "❓",
        },

        {
            title: "Contact Support",
            icon: "📞",
        },
    ];

    return (
        <SafeAreaView style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.logo}>
                        ♿
                    </Text>

                    <Text style={styles.headerTitle}>
                        Profile
                    </Text>
                </View>

                <TouchableOpacity>
                    <Text style={styles.headerIcon}>
                        ⚙️
                    </Text>
                </TouchableOpacity>
            </View>

            {/* BODY */}
            <ScrollView
                showsVerticalScrollIndicator={
                    false
                }
                contentContainerStyle={
                    styles.scrollContent
                }
            >
                {/* PROFILE CARD */}
                <View style={styles.profileCard}>
                    {/* TOP */}
                    <View style={styles.profileTop}>
                        <Image
                            source={{
                                uri: "https://i.pravatar.cc/300",
                            }}
                            style={styles.avatar}
                        />

                        <Text style={styles.userName}>
                            Prathmesh
                        </Text>

                        <Text style={styles.userRole}>
                            Community Member
                        </Text>

                        <TouchableOpacity
                            style={styles.editBtn}
                            onPress={() =>
                                navigation.navigate("Profile")
                            }
                        >
                            <Text style={styles.editBtnText}>
                                Edit Profile
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* STATS */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text
                                style={styles.statNumber}
                            >
                                12
                            </Text>

                            <Text
                                style={styles.statLabel}
                            >
                                FORUMS
                            </Text>
                        </View>

                        <View style={styles.statDivider} />

                        <View style={styles.statItem}>
                            <Text
                                style={styles.statNumber}
                            >
                                4
                            </Text>

                            <Text
                                style={styles.statLabel}
                            >
                                GROUPS
                            </Text>
                        </View>

                        <View style={styles.statDivider} />

                        <View style={styles.statItem}>
                            <Text
                                style={styles.statNumber}
                            >
                                8
                            </Text>

                            <Text
                                style={styles.statLabel}
                            >
                                POSTS
                            </Text>
                        </View>
                    </View>
                </View>

                {/* FAMILY SUPPORT */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        FAMILY & SUPPORT
                    </Text>

                    <View style={styles.sectionCard}>
                        {familySupport.map(
                            (item, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.menuItem}
                                >
                                    <View
                                        style={
                                            styles.menuLeft
                                        }
                                    >
                                        <View
                                            style={[
                                                styles.iconWrap,
                                                {
                                                    backgroundColor:
                                                        item.bg,
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={
                                                    styles.menuIcon
                                                }
                                            >
                                                {item.icon}
                                            </Text>
                                        </View>

                                        <View>
                                            <Text
                                                style={
                                                    styles.menuTitle
                                                }
                                            >
                                                {item.title}
                                            </Text>

                                            <Text
                                                style={
                                                    styles.menuSubtitle
                                                }
                                            >
                                                {item.subtitle}
                                            </Text>
                                        </View>
                                    </View>

                                    <Text
                                        style={styles.arrow}
                                    >
                                        ›
                                    </Text>
                                </TouchableOpacity>
                            )
                        )}
                    </View>
                </View>

                {/* ACCOUNT SETTINGS */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        ACCOUNT SETTINGS
                    </Text>

                    <View style={styles.sectionCard}>
                        {accountSettings.map(
                            (item, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.menuItem}
                                    onPress={() => {
                                        if (
                                            item.title ===
                                            "Accessibility"
                                        ) {
                                            navigation.navigate(
                                                "Accessibility"
                                            );
                                        }

                                        if (
                                            item.title ===
                                            "Notifications"
                                        ) {
                                            navigation.navigate(
                                                "Notifications"
                                            );
                                        }
                                    }}
                                >
                                    <View
                                        style={
                                            styles.menuLeft
                                        }
                                    >
                                        <Text
                                            style={
                                                styles.settingsIcon
                                            }
                                        >
                                            {item.icon}
                                        </Text>

                                        <View>
                                            <Text
                                                style={
                                                    styles.menuTitle
                                                }
                                            >
                                                {item.title}
                                            </Text>

                                            {!!item.subtitle && (
                                                <Text
                                                    style={
                                                        styles.menuSubtitle
                                                    }
                                                >
                                                    {
                                                        item.subtitle
                                                    }
                                                </Text>
                                            )}
                                        </View>
                                    </View>

                                    <Text
                                        style={styles.arrow}
                                    >
                                        ›
                                    </Text>
                                </TouchableOpacity>
                            )
                        )}
                    </View>
                </View>

                {/* SUPPORT */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        SUPPORT
                    </Text>

                    <View style={styles.sectionCard}>
                        {supportItems.map(
                            (item, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.menuItem}
                                >
                                    <View
                                        style={
                                            styles.menuLeft
                                        }
                                    >
                                        <Text
                                            style={
                                                styles.settingsIcon
                                            }
                                        >
                                            {item.icon}
                                        </Text>

                                        <Text
                                            style={
                                                styles.menuTitle
                                            }
                                        >
                                            {item.title}
                                        </Text>
                                    </View>

                                    <Text
                                        style={styles.arrow}
                                    >
                                        ›
                                    </Text>
                                </TouchableOpacity>
                            )
                        )}
                    </View>
                </View>

                {/* LOGOUT */}
                <TouchableOpacity
                    style={styles.logoutBtn}
                >
                    <Text style={styles.logoutIcon}>
                        ↩
                    </Text>

                    <Text style={styles.logoutText}>
                        LOGOUT
                    </Text>
                </TouchableOpacity>

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* NAVBAR */}
            <View style={styles.navbar}>
                <TouchableOpacity
                    onPress={() =>
                        navigation.navigate("Home")
                    }
                >
                    <Text style={styles.navText}>
                        Home
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity>
                    <Text style={styles.navText}>
                        Community
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity>
                    <Text style={styles.navText}>
                        Services
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity>
                    <Text style={styles.navText}>
                        Learn
                    </Text>
                </TouchableOpacity>

                <LinearGradient
                    colors={[
                        "#500088",
                        "#6B21A8",
                    ]}
                    style={styles.activeNav}
                >
                    <Text
                        style={styles.activeNavText}
                    >
                        Profile
                    </Text>
                </LinearGradient>
            </View>
        </SafeAreaView>
    );
};

export default ProfileScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F5F5F5",
    },

    header: {
        height: 72,
        backgroundColor: "#500088",

        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",

        paddingHorizontal: 24,
    },

    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
    },

    logo: {
        fontSize: 24,
        marginRight: 12,
        color: "#fff",
    },

    headerTitle: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "700",
    },

    headerIcon: {
        fontSize: 20,
    },

    scrollContent: {
        padding: 16,
        paddingBottom: 120,
    },

    profileCard: {
        backgroundColor: "#fff",
        borderRadius: 20,
        overflow: "hidden",
        borderTopWidth: 4,
        borderTopColor: "#500088",
        marginBottom: 24,
    },

    profileTop: {
        alignItems: "center",
        padding: 24,
    },

    avatar: {
        width: 80,
        height: 80,
        borderRadius: 999,
        marginBottom: 16,
    },

    userName: {
        fontSize: 24,
        fontWeight: "700",
        color: "#500088",
    },

    userRole: {
        color: "#4C4452",
        marginTop: 4,
        marginBottom: 20,
    },

    editBtn: {
        borderWidth: 2,
        borderColor: "#500088",
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 12,
    },

    editBtnText: {
        color: "#500088",
        fontWeight: "700",
    },

    statsRow: {
        flexDirection: "row",
        backgroundColor: "#F4F3FA",
        paddingVertical: 18,
    },

    statItem: {
        flex: 1,
        alignItems: "center",
    },

    statDivider: {
        width: 1,
        backgroundColor: "#DDD",
    },

    statNumber: {
        fontSize: 20,
        fontWeight: "800",
        color: "#500088",
    },

    statLabel: {
        marginTop: 4,
        fontSize: 10,
        fontWeight: "700",
        color: "#4C4452",
    },

    section: {
        marginBottom: 24,
    },

    sectionTitle: {
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 2,
        color: "#4C4452",
        marginBottom: 12,
        paddingHorizontal: 8,
    },

    sectionCard: {
        backgroundColor: "#F4F3FA",
        borderRadius: 12,
        overflow: "hidden",
    },

    menuItem: {
        backgroundColor: "#fff",
        minHeight: 64,

        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",

        paddingHorizontal: 16,
        paddingVertical: 14,

        marginBottom: 1,
    },

    menuLeft: {
        flexDirection: "row",
        alignItems: "center",
    },

    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,

        justifyContent: "center",
        alignItems: "center",

        marginRight: 16,
    },

    menuIcon: {
        fontSize: 18,
    },

    settingsIcon: {
        fontSize: 20,
        marginRight: 16,
    },

    menuTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1A1B20",
    },

    menuSubtitle: {
        marginTop: 2,
        fontSize: 12,
        color: "#4C4452",
    },

    arrow: {
        fontSize: 24,
        color: "#CFC2D4",
    },

    logoutBtn: {
        height: 56,

        borderWidth: 2,
        borderColor: "#BA1A1A",
        borderRadius: 16,

        justifyContent: "center",
        alignItems: "center",

        flexDirection: "row",
    },

    logoutIcon: {
        fontSize: 18,
        color: "#BA1A1A",
        marginRight: 8,
    },

    logoutText: {
        color: "#BA1A1A",
        fontWeight: "800",
        letterSpacing: 1,
    },

    navbar: {
        position: "absolute",

        bottom: 0,
        left: 0,
        right: 0,

        height: 75,

        backgroundColor:
            "rgba(249,248,255,0.9)",

        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",

        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,

        paddingBottom: 10,
    },

    navText: {
        color: "#64748B",
        fontSize: 11,
        textTransform: "uppercase",
    },

    activeNav: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 16,
    },

    activeNavText: {
        color: "#FFFFFF",
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
    },
});