import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Linking,
    Platform,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { confirmDeleteAccount } from "../../utils/accountDeletion";
import { DeleteAccountModal } from "../../components/account/DeleteAccountModal";
import { logout, logoutAllDevices } from "@services/authService";
import { forumService } from "@services/forumService";
import { getNotificationPermissionStatus } from "@services/notificationService";
import { ConfirmDialog } from "../../components/chat/ConfirmDialog";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
    pwd: "Person with Disability",
    caregiver: "Caregiver",
    educator: "Educator",
    ngo_worker: "NGO Worker",
    skill_trainer: "Skill Trainer",
    therapist: "Educator",
    ngo: "NGO Worker",
    // DB-value fallbacks: `student` is Skill Trainer and `volunteer` is
    // Volunteer (see ROLE_MAP_TO_FRONTEND in services/authService.ts).
    student: "Skill Trainer",
    volunteer: "Volunteer",
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

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────

const HomeProfileScreen = () => {
    const navigation = useNavigation<any>();
    const user = useAuthStore((state) => state.user);
    const { colors, highContrast } = useTheme();
    const insets = useSafeAreaInsets();

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
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    // ── General themed confirm/info dialog (replaces native Alert.alert) ──
    const [confirmState, setConfirmState] = useState<{
        title: string;
        message?: string;
        confirmLabel: string;
        cancelLabel?: string;
        destructive?: boolean;
        hideCancel?: boolean;
        onConfirm: () => void;
    } | null>(null);

    const showComingSoon = (feature: string) => {
        setConfirmState({
            title: feature,
            message: "This feature is coming soon. We're working hard to bring it to you.",
            confirmLabel: "OK",
            hideCancel: true,
            onConfirm: () => setConfirmState(null),
        });
    };

    const handleLogout = () => {
        setConfirmState({
            title: "Log Out",
            message: "Are you sure you want to log out?",
            confirmLabel: "Log Out",
            destructive: true,
            onConfirm: async () => {
                setLoggingOut(true);
                try {
                    await logout();
                } catch {
                    setLoggingOut(false);
                    setConfirmState({
                        title: "Error",
                        message: "Failed to log out. Please try again.",
                        confirmLabel: "OK",
                        hideCancel: true,
                        onConfirm: () => setConfirmState(null),
                    });
                }
            },
        });
    };

    const handleLogoutAll = () => {
        setConfirmState({
            title: "Log out of all devices",
            message:
                "This signs you out everywhere you're logged in, including this device. Use it if you've lost a phone or think someone else has access to your account.",
            confirmLabel: "Log out everywhere",
            destructive: true,
            onConfirm: async () => {
                setLoggingOut(true);
                try {
                    await logoutAllDevices();
                } catch {
                    setLoggingOut(false);
                    setConfirmState({
                        title: "Couldn't log out other devices",
                        message: "Check your connection and try again. You are still logged in on this device.",
                        confirmLabel: "OK",
                        hideCancel: true,
                        onConfirm: () => setConfirmState(null),
                    });
                }
            },
        });
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
            setConfirmState({
                title: "Push Notifications",
                message: "Notifications are enabled. You can manage them in your device settings.",
                confirmLabel: "Open Settings",
                cancelLabel: "OK",
                onConfirm: () => Linking.openSettings(),
            });
        } else {
            setConfirmState({
                title: "Enable Notifications",
                message: "Push notifications are currently disabled. Enable them to stay updated.",
                confirmLabel: "Open Settings",
                cancelLabel: "Not now",
                onConfirm: () => Linking.openSettings(),
            });
        }
    };

    const handleDeleteAccount = () => {
        // Two warnings first, then the password modal — the server requires
        // re-authentication for this irreversible action.
        confirmDeleteAccount({ onConfirmed: () => setShowDeleteModal(true) });
    };

    // ── Derived display values ──
    const displayName = user?.name || user?.fullName || "User";
    const roleKey = user?.roles?.[0] ?? user?.role ?? "";
    const roleLabel = ROLE_LABELS[roleKey] ?? (roleKey ? roleKey : "Volunteer");
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
                contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 120, 140) }]}
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
                        onPress={() => showComingSoon("Emergency SOS")}
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
                        onPress={() => showComingSoon("Medical Records")}
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
                        onPress={() => navigation.navigate("Accessibility", { fromProfile: true })}
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
                        title="My data & privacy"
                        subtitle="View, download, correct or delete your data; manage consent"
                        onPress={() => navigation.navigate("PrivacyData")}
                        colors={colors}
                        highContrast={highContrast}
                        cardBorder={cardBorder}
                    />
                    <MenuItem
                        icon="🚫"
                        title="Blocked Users"
                        subtitle="See and undo anyone you've blocked"
                        onPress={() => navigation.navigate("BlockedUsers")}
                        colors={colors}
                        highContrast={highContrast}
                        cardBorder={cardBorder}
                    />
                </View>

                {/* ── LEGAL ── */}
                <SectionHeader label="LEGAL" />
                {/* These were dead "Coming Soon" toasts, which meant a signed-in
                    user could not reach the policies from anywhere in the app —
                    the documents existed but only pre-login. */}
                <View style={[styles.sectionCard, { backgroundColor: colors.surface }, cardBorder]}>
                    <MenuItem
                        icon="📜"
                        title="Privacy Policy"
                        subtitle="How we handle your data"
                        onPress={() => navigation.navigate("Legal", { doc: "privacy-policy" })}
                        colors={colors}
                        highContrast={highContrast}
                        cardBorder={cardBorder}
                    />
                    <MenuItem
                        icon="📋"
                        title="Terms of Use"
                        subtitle="The agreement you accepted"
                        onPress={() => navigation.navigate("Legal", { doc: "terms" })}
                        colors={colors}
                        highContrast={highContrast}
                        cardBorder={cardBorder}
                    />
                    <MenuItem
                        icon="🤝"
                        title="Community Guidelines"
                        subtitle="What's expected here, and what isn't"
                        onPress={() => navigation.navigate("Legal", { doc: "community-guidelines" })}
                        colors={colors}
                        highContrast={highContrast}
                        cardBorder={cardBorder}
                    />
                    <MenuItem
                        icon="🛡️"
                        title="Child Safety Standards"
                        subtitle="How we handle child safety reports"
                        onPress={() => navigation.navigate("Legal", { doc: "child-safety" })}
                        colors={colors}
                        highContrast={highContrast}
                        cardBorder={cardBorder}
                    />
                </View>

                {/* ── SUPPORT ── */}
                <SectionHeader label="SUPPORT" />
                <View style={[styles.sectionCard, { backgroundColor: colors.surface }, cardBorder]}>
                    <MenuItem
                        icon="❓"
                        title="Help Center & FAQs"
                        onPress={() => navigation.navigate("HelpCenter")}
                        colors={colors}
                        highContrast={highContrast}
                        cardBorder={cardBorder}
                    />
                    <MenuItem
                        icon="📞"
                        title="Contact Support"
                        onPress={() => navigation.navigate("ContactSupport")}
                        colors={colors}
                        highContrast={highContrast}
                        cardBorder={cardBorder}
                    />
                    {/* The Community Guidelines direct people in crisis to
                        "Settings → Safety resources", so it has to be here. */}
                    <MenuItem
                        icon="🛟"
                        title="Safety Resources"
                        onPress={() => navigation.navigate("SafetyResources")}
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

                {/* ── LOGOUT ALL DEVICES ── */}
                <TouchableOpacity
                    style={styles.logoutAllBtn}
                    onPress={handleLogoutAll}
                    disabled={loggingOut}
                    accessibilityRole="button"
                    accessibilityLabel="Log out of all devices"
                    accessibilityHint="Signs you out on every device where you are logged in, including this one"
                    accessibilityState={{ disabled: loggingOut }}
                >
                    <AccessibleText style={[styles.logoutAllText, { color: colors.text }]}>
                        Log out of all devices
                    </AccessibleText>
                </TouchableOpacity>

                {/* ── DELETE ACCOUNT ── */}
                <TouchableOpacity
                    style={styles.deleteAccountBtn}
                    onPress={handleDeleteAccount}

                    accessibilityRole="button"
                    accessibilityLabel="Delete account"
                    accessibilityHint="Deactivates and anonymises your account and personal data"
                >
                    <AccessibleText style={styles.deleteAccountText}>
                        Delete account
                    </AccessibleText>
                </TouchableOpacity>
            </ScrollView>

            <ConfirmDialog
                visible={!!confirmState}
                title={confirmState?.title || ""}
                message={confirmState?.message}
                confirmLabel={confirmState?.confirmLabel}
                cancelLabel={confirmState?.cancelLabel}
                destructive={confirmState?.destructive}
                hideCancel={confirmState?.hideCancel}
                onConfirm={() => confirmState?.onConfirm()}
                onCancel={() => setConfirmState(null)}
            />

            <DeleteAccountModal
                visible={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
            />
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

    logoutAllBtn: {
        alignSelf: "center",
        minHeight: 44,
        justifyContent: "center",
        marginTop: 12,
        paddingHorizontal: 16,
    },

    logoutAllText: {
        fontSize: 14,
        fontWeight: "600",
        textDecorationLine: "underline",
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
