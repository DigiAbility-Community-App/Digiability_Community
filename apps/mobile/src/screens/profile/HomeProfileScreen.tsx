import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    Linking,
    Platform,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { confirmDeleteAccount } from "../../utils/accountDeletion";
import { logout } from "@services/authService";
import { forumService } from "@services/forumService";
import { getNotificationPermissionStatus } from "@services/notificationService";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
    pwd: "Person with Disability",
    caregiver: "Caregiver",
    educator: "Educator",
    ngo_worker: "NGO Worker",
    skill_trainer: "Skill Trainer",
    community_member: "Community Member",
    therapist: "Therapist",
    volunteer: "Volunteer",
    student: "Student",
    mentor: "Mentor",
};

function getInitials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("");
}

function comingSoonAlert(feature: string) {
    Alert.alert(
        `${feature}`,
        "This feature is coming soon. We're working hard to bring it to you.",
        [{ text: "OK" }]
    );
}

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────

const HomeProfileScreen = () => {
    const navigation = useNavigation<any>();
    const user = useAuthStore((state) => state.user);
    const { colors, highContrast } = useTheme();

    // ── Chat store — derive group + care circle counts ──
    const conversations = useChatStore((s) => Object.values(s.conversations));
    const groupCount = conversations.filter(
        (c) => c.type === "GROUP" && c.subType !== "CARE_CIRCLE"
    ).length;
    const careCircles = conversations.filter((c) => c.subType === "CARE_CIRCLE");
    const careCircleCount = careCircles.length;
    const careCircleMemberCount = careCircles.reduce(
        (sum, c) => sum + (c.participants?.length ?? 0),
        0
    );

    // ── Forum stats ──
    const [forumStats, setForumStats] = useState({ questionsCount: 0, answersCount: 0 });
    const [statsLoading, setStatsLoading] = useState(true);

    // ── Notification permission ──
    const [notifStatus, setNotifStatus] = useState<"granted" | "denied" | "undetermined">("undetermined");

    // ── Delete ──
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    const handleLogout = () => {
        Alert.alert("Log Out", "Are you sure you want to log out?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Log Out",
                style: "destructive",
                onPress: async () => {
                    setLoggingOut(true);
                    try {
                        await logout();
                    } catch {
                        setLoggingOut(false);
                        Alert.alert("Error", "Failed to log out. Please try again.");
                    }
                },
            },
        ]);
    };

    const loadData = useCallback(async () => {
        setStatsLoading(true);
        try {
            const stats = await forumService.getMyStats();
            setForumStats({ questionsCount: stats.questionsCount, answersCount: stats.answersCount });
        } catch {
            // silently fall back to 0
        } finally {
            setStatsLoading(false);
        }

    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Refresh on focus so returning from the OS Settings app (via
    // handleNotificationsPress's "Open Settings" action below) updates
    // this row without requiring an app restart.
    useFocusEffect(
        useCallback(() => {
            getNotificationPermissionStatus().then(setNotifStatus);
        }, [])
    );

    const handleNotificationsPress = async () => {
        if (notifStatus === "granted") {
            Alert.alert(
                "Push Notifications",
                "Notifications are enabled. You can manage them in your device settings.",
                [
                    { text: "Open Settings", onPress: () => Linking.openSettings() },
                    { text: "OK", style: "cancel" },
                ]
            );
        } else {
            Alert.alert(
                "Enable Notifications",
                "Push notifications are currently disabled. Enable them to stay updated.",
                [
                    { text: "Open Settings", onPress: () => Linking.openSettings() },
                    { text: "Not now", style: "cancel" },
                ]
            );
        }
    };

    const handleDeleteAccount = () => {
        confirmDeleteAccount({
            onStart: () => setDeletingAccount(true),
            onError: (message) => {
                setDeletingAccount(false);
                Alert.alert("Error", message);
            },
        });
    };

    // ── Derived display values ──
    const displayName = user?.name || user?.fullName || "User";
    const roleKey = user?.roles?.[0] ?? user?.role ?? "";
    const roleLabel = ROLE_LABELS[roleKey] ?? (roleKey ? roleKey : "Community Member");
    const initials = getInitials(displayName);
    const notifSubtitle = notifStatus === "granted" ? "Enabled" : notifStatus === "denied" ? "Disabled" : "Not set";

    const cardBorder = highContrast
        ? { borderWidth: 2, borderColor: "#000000" }
        : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };

    return (
        <ScreenWrapper>
            <AppHeader title="Profile" hideBackButton />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* ── PROFILE CARD ── */}
                <View style={[styles.profileCard, { backgroundColor: colors.card, borderTopColor: colors.primary }, cardBorder]}>
                    <View style={styles.profileTop}>
                        {/* Avatar — initials circle */}
                        <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
                            <AccessibleText style={styles.avatarInitials}>{initials || "?"}</AccessibleText>
                        </View>

                        <AccessibleText variant="title" style={{ color: colors.primary, fontSize: 22, marginTop: 4 }}>
                            {displayName}
                        </AccessibleText>

                        <AccessibleText variant="body" style={{ color: colors.subtext, marginTop: 4, marginBottom: 4 }}>
                            {roleLabel}
                        </AccessibleText>

                        {user?.username ? (
                            <AccessibleText variant="caption" style={{ color: colors.subtext, marginBottom: 16 }}>
                                @{user.username}
                            </AccessibleText>
                        ) : <View style={{ marginBottom: 16 }} />}

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

                    {/* ── STATS ── */}
                    <View style={[styles.statsRow, { backgroundColor: colors.surface }]}>
                        <View style={styles.statItem}>
                            <AccessibleText variant="title" style={{ color: colors.primary, fontSize: 20 }}>
                                {statsLoading ? "—" : forumStats.questionsCount}
                            </AccessibleText>
                            <AccessibleText variant="overline" style={{ color: colors.subtext }}>
                                QUESTIONS
                            </AccessibleText>
                        </View>

                        <View style={styles.statDivider} />

                        <View style={styles.statItem}>
                            <AccessibleText variant="title" style={{ color: colors.primary, fontSize: 20 }}>
                                {groupCount + careCircleCount}
                            </AccessibleText>
                            <AccessibleText variant="overline" style={{ color: colors.subtext }}>
                                GROUPS
                            </AccessibleText>
                        </View>

                        <View style={styles.statDivider} />

                        <View style={styles.statItem}>
                            <AccessibleText variant="title" style={{ color: colors.primary, fontSize: 20 }}>
                                {statsLoading ? "—" : forumStats.answersCount}
                            </AccessibleText>
                            <AccessibleText variant="overline" style={{ color: colors.subtext }}>
                                ANSWERS
                            </AccessibleText>
                        </View>
                    </View>
                </View>

                {/* ── FAMILY & SUPPORT ── */}
                <SectionHeader label="FAMILY & SUPPORT" />
                <View style={[styles.sectionCard, { backgroundColor: colors.surface }, cardBorder]}>
                    <MenuItem
                        icon="👥"
                        iconBg="#F1DBFF"
                        title="Care Circle"
                        subtitle={careCircleCount > 0
                            ? `${careCircleCount} circle${careCircleCount !== 1 ? "s" : ""} · ${careCircleMemberCount} member${careCircleMemberCount !== 1 ? "s" : ""}`
                            : "No circles yet"}
                        onPress={() => navigation.navigate("CareCircle")}
                        colors={colors}
                        highContrast={highContrast}
                        cardBorder={cardBorder}
                    />
                    <MenuItem
                        icon="🚨"
                        iconBg="#FEE2E2"
                        title="Emergency SOS"
                        subtitle="Coming soon"
                        onPress={() => comingSoonAlert("Emergency SOS")}
                        colors={colors}
                        highContrast={highContrast}
                        cardBorder={cardBorder}
                        comingSoon
                    />
                    <MenuItem
                        icon="📄"
                        iconBg="#D1FAE5"
                        title="Medical Records"
                        subtitle="Coming soon"
                        onPress={() => comingSoonAlert("Medical Records")}
                        colors={colors}
                        highContrast={highContrast}
                        cardBorder={cardBorder}
                        comingSoon
                    />
                </View>

                {/* ── ACCOUNT SETTINGS ── */}
                <SectionHeader label="ACCOUNT SETTINGS" />
                <View style={[styles.sectionCard, { backgroundColor: colors.surface }, cardBorder]}>
                    <MenuItem
                        icon="♿"
                        title="Accessibility"
                        onPress={() => navigation.navigate("Accessibility")}
                        colors={colors}
                        highContrast={highContrast}
                        cardBorder={cardBorder}
                    />
                    <MenuItem
                        icon="🔔"
                        title="Notifications"
                        subtitle={notifSubtitle}
                        subtitleColor={notifStatus === "granted" ? "#059669" : notifStatus === "denied" ? "#DC2626" : undefined}
                        onPress={handleNotificationsPress}
                        colors={colors}
                        highContrast={highContrast}
                        cardBorder={cardBorder}
                    />
                    <MenuItem
                        icon="🔒"
                        title="Privacy & Security"
                        subtitle="Manage consent, export, and delete your data"
                        onPress={() => navigation.navigate("PrivacyData")}
                        colors={colors}
                        highContrast={highContrast}
                        cardBorder={cardBorder}
                    />
                </View>

                {/* ── LEGAL ── */}
                <SectionHeader label="LEGAL" />
                <View style={[styles.sectionCard, { backgroundColor: colors.surface }, cardBorder]}>
                    <MenuItem
                        icon="📜"
                        title="Privacy Policy"
                        subtitle="How we handle your data"
                        onPress={() => comingSoonAlert("Privacy Policy")}
                        colors={colors}
                        highContrast={highContrast}
                        cardBorder={cardBorder}
                        comingSoon
                    />
                    <MenuItem
                        icon="📋"
                        title="Terms of Service"
                        subtitle="Community guidelines"
                        onPress={() => comingSoonAlert("Terms of Service")}
                        colors={colors}
                        highContrast={highContrast}
                        cardBorder={cardBorder}
                        comingSoon
                    />
                </View>

                {/* ── SUPPORT ── */}
                <SectionHeader label="SUPPORT" />
                <View style={[styles.sectionCard, { backgroundColor: colors.surface }, cardBorder]}>
                    <MenuItem
                        icon="❓"
                        title="Help Center & FAQs"
                        onPress={() => navigation.navigate("ContactSupport" as any)}
                        colors={colors}
                        highContrast={highContrast}
                        cardBorder={cardBorder}
                    />
                    <MenuItem
                        icon="📞"
                        title="Contact Support"
                        onPress={() => navigation.navigate("ContactSupport" as any)}
                        colors={colors}
                        highContrast={highContrast}
                        cardBorder={cardBorder}
                    />
                </View>

                {/* ── APP VERSION ── */}
                <AccessibleText
                    variant="caption"
                    style={{ textAlign: "center", color: colors.subtext, marginBottom: 8, marginTop: 4 }}
                >
                    Digiability Community v1.0.0
                </AccessibleText>

                {/* ── LOGOUT ── */}
                <AccessibleButton
                    variant="danger"
                    accessibilityLabel="Logout"
                    accessibilityHint="Logs you out of the application"
                    style={styles.logoutBtn}
                    onPress={handleLogout}
                    disabled={loggingOut}
                >
                    {loggingOut ? "LOGGING OUT…" : "LOGOUT"}
                </AccessibleButton>

                {/* ── DELETE ACCOUNT ── */}
                <TouchableOpacity
                    style={styles.deleteAccountBtn}
                    onPress={handleDeleteAccount}
                    disabled={deletingAccount}
                    accessibilityRole="button"
                    accessibilityLabel="Delete account"
                    accessibilityHint="Deactivates and anonymises your account and personal data"
                >
                    <AccessibleText style={styles.deleteAccountText}>
                        {deletingAccount ? "Deleting account…" : "Delete account"}
                    </AccessibleText>
                </TouchableOpacity>
            </ScrollView>
        </ScreenWrapper>
    );
};

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

const SectionHeader = ({ label }: { label: string }) => {
    const { colors } = useTheme();
    return (
        <AccessibleText
            variant="overline"
            style={{ marginBottom: 8, marginTop: 20, paddingHorizontal: 4, color: colors.subtext }}
        >
            {label}
        </AccessibleText>
    );
};

interface MenuItemProps {
    icon: string;
    iconBg?: string;
    title: string;
    subtitle?: string;
    subtitleColor?: string;
    onPress: () => void;
    colors: any;
    highContrast: boolean;
    cardBorder: object;
    comingSoon?: boolean;
}

const MenuItem = ({
    icon, iconBg, title, subtitle, subtitleColor, onPress, colors, highContrast, comingSoon,
}: MenuItemProps) => (
    <TouchableOpacity
        style={[styles.menuItem, { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }]}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={comingSoon ? `${title} is coming soon` : `Double tap to open ${title}`}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <View style={styles.menuLeft}>
            {iconBg ? (
                <View style={[styles.iconWrap, { backgroundColor: highContrast ? "#FFFFFF" : iconBg }, highContrast && { borderWidth: 1, borderColor: "#000" }]}>
                    <AccessibleText style={styles.menuIcon}>{icon}</AccessibleText>
                </View>
            ) : (
                <AccessibleText style={[styles.settingsIcon, { color: colors.text }]}>{icon}</AccessibleText>
            )}
            <View style={{ flex: 1 }}>
                <AccessibleText variant="title" style={{ fontSize: 15, color: colors.text }}>
                    {title}
                </AccessibleText>
                {!!subtitle && (
                    <AccessibleText
                        variant="caption"
                        style={{ marginTop: 1, color: subtitleColor ?? colors.subtext }}
                    >
                        {subtitle}
                    </AccessibleText>
                )}
            </View>
        </View>
        <View style={styles.menuRight}>
            {comingSoon && (
                <View style={styles.soonBadge}>
                    <AccessibleText style={styles.soonText}>SOON</AccessibleText>
                </View>
            )}
            <AccessibleText style={styles.arrow}>›</AccessibleText>
        </View>
    </TouchableOpacity>
);

export default HomeProfileScreen;

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
    scrollContent: {
        padding: 16,
        paddingBottom: 120,
    },

    profileCard: {
        borderRadius: 20,
        overflow: "hidden",
        borderTopWidth: 4,
        borderTopColor: "#500088",
        marginBottom: 4,
    },

    profileTop: {
        alignItems: "center",
        padding: 24,
        paddingBottom: 20,
    },

    avatarCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 12,
    },

    avatarInitials: {
        fontSize: 28,
        fontWeight: "800",
        color: "#FFFFFF",
    },

    editBtn: {
        borderWidth: 2,
        borderColor: "#500088",
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 12,
        marginTop: 8,
    },

    editBtnText: {
        color: "#500088",
        fontWeight: "700",
    },

    statsRow: {
        flexDirection: "row",
        paddingVertical: 16,
    },

    statItem: {
        flex: 1,
        alignItems: "center",
    },

    statDivider: {
        width: 1,
        backgroundColor: "rgba(0,0,0,0.08)",
        marginVertical: 4,
    },

    sectionCard: {
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 4,
    },

    menuItem: {
        minHeight: 60,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 1,
    },

    menuLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        marginRight: 8,
    },

    menuRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },

    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 14,
    },

    menuIcon: {
        fontSize: 18,
    },

    settingsIcon: {
        fontSize: 20,
        marginRight: 14,
        width: 28,
        textAlign: "center",
    },

    arrow: {
        fontSize: 22,
        color: "#CFC2D4",
    },

    soonBadge: {
        backgroundColor: "#F3EAFF",
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
    },

    soonText: {
        fontSize: 9,
        fontWeight: "800",
        color: "#7C3AED",
        letterSpacing: 0.5,
    },

    logoutBtn: {
        minHeight: 56,
        borderWidth: 2,
        borderColor: "#BA1A1A",
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 16,
    },

    deleteAccountBtn: {
        alignSelf: "center",
        marginTop: 10,
        marginBottom: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },

    deleteAccountText: {
        color: "#BA1A1A",
        fontSize: 13,
        textDecorationLine: "underline",
        opacity: 0.75,
    },
});
