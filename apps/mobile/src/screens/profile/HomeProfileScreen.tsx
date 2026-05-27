import React from "react";
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "../../store/authStore";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";

const ProfileScreen = () => {
    const navigation = useNavigation<any>();
    const user = useAuthStore((state) => state.user);
    const clearAuth = useAuthStore((state) => state.clearAuth);
    const { colors, spacing, highContrast } = useTheme();

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

    const cardBorder = highContrast
        ? { borderWidth: 2, borderColor: '#000000' }
        : { borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' };

    return (
        <ScreenWrapper>
            {/* HEADER */}
            <AppHeader
                title="Profile"
                hideBackButton={true}
                rightActions={
                    <TouchableOpacity
                        style={styles.headerRightTouch}
                        accessibilityRole="button"
                        accessibilityLabel="Settings"
                        accessibilityHint="Opens profile settings"
                        activeOpacity={0.7}
                    >
                        <AccessibleText style={styles.headerIcon}>
                            ⚙️
                        </AccessibleText>
                    </TouchableOpacity>
                }
            />

            {/* BODY */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* PROFILE CARD */}
                <View style={[styles.profileCard, { backgroundColor: colors.card, borderTopColor: colors.primary }, cardBorder]}>
                    {/* TOP */}
                    <View style={styles.profileTop}>
                        <Image
                            source={require("../../../assets/user icon.png")}
                            style={styles.avatar}
                        />

                        <AccessibleText variant="title" style={{ color: colors.primary, fontSize: 24 }}>
                            {user?.name || "User"}
                        </AccessibleText>

                        <AccessibleText variant="body" style={{ color: colors.subtext, marginTop: 4, marginBottom: 20 }}>
                            Community Member
                        </AccessibleText>

                        <AccessibleButton
                            variant="outline"
                            accessibilityLabel="Edit Profile"
                            accessibilityHint="Navigates to edit profile screen"
                            style={styles.editBtn}
                            textStyle={styles.editBtnText}
                            onPress={() => navigation.navigate("EditProfile")}
                        >
                            Edit Profile
                        </AccessibleButton>
                    </View>

                    {/* STATS */}
                    <View style={[styles.statsRow, { backgroundColor: colors.surface }]}>
                        <View style={styles.statItem}>
                            <AccessibleText
                                variant="title"
                                style={{ color: colors.primary, fontSize: 20 }}
                            >
                                12
                            </AccessibleText>

                            <AccessibleText
                                variant="overline"
                                style={{ color: colors.subtext }}
                            >
                                FORUMS
                            </AccessibleText>
                        </View>

                        <View style={styles.statDivider} />

                        <View style={styles.statItem}>
                            <AccessibleText
                                variant="title"
                                style={{ color: colors.primary, fontSize: 20 }}
                            >
                                4
                            </AccessibleText>

                            <AccessibleText
                                variant="overline"
                                style={{ color: colors.subtext }}
                            >
                                GROUPS
                            </AccessibleText>
                        </View>

                        <View style={styles.statDivider} />

                        <View style={styles.statItem}>
                            <AccessibleText
                                variant="title"
                                style={{ color: colors.primary, fontSize: 20 }}
                            >
                                8
                            </AccessibleText>

                            <AccessibleText
                                variant="overline"
                                style={{ color: colors.subtext }}
                            >
                                POSTS
                            </AccessibleText>
                        </View>
                    </View>
                </View>

                {/* FAMILY SUPPORT */}
                <View style={styles.section}>
                    <AccessibleText variant="overline" style={{ marginBottom: 12, paddingHorizontal: 8 }}>
                        FAMILY & SUPPORT
                    </AccessibleText>

                    <View style={[styles.sectionCard, { backgroundColor: colors.surface }, cardBorder]}>
                        {familySupport.map(
                            (item, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[styles.menuItem, { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }]}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${item.title}, ${item.subtitle}`}
                                    accessibilityHint={`Double tap to view ${item.title}`}
                                    onPress={() => {
                                        if (item.title === "Care Circle") {
                                            navigation.navigate("CareCircle");
                                        }
                                    }}
                                >
                                    <View style={styles.menuLeft}>
                                        <View
                                            style={[
                                                styles.iconWrap,
                                                {
                                                    backgroundColor: highContrast ? '#FFFFFF' : item.bg,
                                                },
                                                highContrast && { borderWidth: 1, borderColor: '#000000' }
                                            ]}
                                        >
                                            <AccessibleText style={styles.menuIcon}>
                                                {item.icon}
                                            </AccessibleText>
                                        </View>

                                        <View>
                                            <AccessibleText variant="title" style={{ fontSize: 16 }}>
                                                {item.title}
                                            </AccessibleText>

                                            <AccessibleText variant="caption">
                                                {item.subtitle}
                                            </AccessibleText>
                                        </View>
                                    </View>

                                    <AccessibleText style={styles.arrow}>
                                        ›
                                    </AccessibleText>
                                </TouchableOpacity>
                            )
                        )}
                    </View>
                </View>

                {/* ACCOUNT SETTINGS */}
                <View style={styles.section}>
                    <AccessibleText variant="overline" style={{ marginBottom: 12, paddingHorizontal: 8 }}>
                        ACCOUNT SETTINGS
                    </AccessibleText>

                    <View style={[styles.sectionCard, { backgroundColor: colors.surface }, cardBorder]}>
                        {accountSettings.map(
                            (item, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[styles.menuItem, { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }]}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${item.title} settings`}
                                    accessibilityHint={`Double tap to view ${item.title} options`}
                                    onPress={() => {
                                        if (item.title === "Accessibility") {
                                            navigation.navigate("Accessibility");
                                        }
                                        if (item.title === "Notifications") {
                                            navigation.navigate("Notifications");
                                        }
                                    }}
                                >
                                    <View style={styles.menuLeft}>
                                        <AccessibleText style={[styles.settingsIcon, { color: colors.text }]}>
                                            {item.icon}
                                        </AccessibleText>

                                        <View>
                                            <AccessibleText variant="title" style={{ fontSize: 16 }}>
                                                {item.title}
                                            </AccessibleText>

                                            {!!item.subtitle && (
                                                <AccessibleText variant="caption">
                                                    {item.subtitle}
                                                </AccessibleText>
                                            )}
                                        </View>
                                    </View>

                                    <AccessibleText style={styles.arrow}>
                                        ›
                                    </AccessibleText>
                                </TouchableOpacity>
                            )
                        )}
                    </View>
                </View>

                {/* SUPPORT */}
                <View style={styles.section}>
                    <AccessibleText variant="overline" style={{ marginBottom: 12, paddingHorizontal: 8 }}>
                        SUPPORT
                    </AccessibleText>

                    <View style={[styles.sectionCard, { backgroundColor: colors.surface }, cardBorder]}>
                        {supportItems.map(
                            (item, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={[styles.menuItem, { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }]}
                                    accessibilityRole="button"
                                    accessibilityLabel={item.title}
                                    accessibilityHint={`Double tap to open ${item.title}`}
                                >
                                    <View style={styles.menuLeft}>
                                        <AccessibleText style={[styles.settingsIcon, { color: colors.text }]}>
                                            {item.icon}
                                        </AccessibleText>

                                        <AccessibleText variant="title" style={{ fontSize: 16 }}>
                                            {item.title}
                                        </AccessibleText>
                                    </View>

                                    <AccessibleText style={styles.arrow}>
                                        ›
                                    </AccessibleText>
                                </TouchableOpacity>
                            )
                        )}
                    </View>
                </View>

                {/* LOGOUT */}
                <AccessibleButton
                    variant="danger"
                    accessibilityLabel="Logout"
                    accessibilityHint="Logs you out of the application"
                    style={styles.logoutBtn}
                    onPress={() => clearAuth()}
                >
                    LOGOUT
                </AccessibleButton>

            </ScrollView>
        </ScreenWrapper>
    );
};

export default ProfileScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FAF8FF",
    },

    headerIcon: {
        fontSize: 20,
    },

    headerRightTouch: {
        minWidth: 48,
        minHeight: 48,
        justifyContent: "center",
        alignItems: "center",
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

    editBtn: {
        borderWidth: 2,
        borderColor: "#500088",
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 12,
        marginTop: 10,
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

    section: {
        marginBottom: 24,
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
        paddingVertical: 0,
    },

    // Legacy navbar style removed
});