import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
} from "react-native";

import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import AppFooter from "../../components/layout/AppFooter";
import { forumService } from "../../services/forumService";
import { chatService } from "../../services/chatService";
import { useChatStore } from "../../store/chatStore";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type FilterCategory = "all" | "community" | "invites" | "alerts";

interface UnifiedNotification {
    id: string;
    type: string;
    title: string;
    message: string;
    time: string;
    rawCreatedAt: number;  // for sorting
    filterType: FilterCategory;
    read: boolean;
    icon: string;
    iconBg: string;
    /** ID to navigate to: questionId for forum notifs, inviteId for invites */
    relatedId: string | null;
    isInvite: boolean;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function mapNotifType(type: string): FilterCategory {
    if (type === "INVITE") return "invites";
    if (type.startsWith("ADMIN_") || type === "MODERATION") return "alerts";
    return "community";
}

function iconForType(type: string): { icon: string; iconBg: string } {
    switch (type) {
        case "ANSWER":        return { icon: "💬", iconBg: "#F1DBFF" };
        case "ACCEPTED":      return { icon: "✅", iconBg: "#D1FAE5" };
        case "MENTION":       return { icon: "📣", iconBg: "#FFF3CD" };
        case "LIKE":          return { icon: "❤️", iconBg: "#FCE7F3" };
        case "INVITE":        return { icon: "✉️", iconBg: "#DBEAFE" };
        case "MODERATION":    return { icon: "🚨", iconBg: "#FFDAD6" };
        default:
            if (type.includes("ALERT"))        return { icon: "⚠️", iconBg: "#FFF3CD" };
            if (type.includes("ANNOUNCEMENT")) return { icon: "📢", iconBg: "#DBEAFE" };
            return { icon: "🔔", iconBg: "#F1DBFF" };
    }
}

function formatTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return days === 1 ? "Yesterday" : `${days}d ago`;
}

const FILTER_LABELS: Record<FilterCategory, string> = {
    all: "All",
    community: "Forum",
    invites: "Invites",
    alerts: "Alerts",
};

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────

const NotificationsScreen = () => {
    const navigation = useNavigation<any>();
    const { colors, spacing, highContrast } = useTheme();

    const pendingInvites = useChatStore((s) => s.pendingInvites);
    const setPendingInvites = useChatStore((s) => s.setPendingInvites);

    const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");
    const [forumNotifs, setForumNotifs] = useState<UnifiedNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    // Always fetch fresh invites when this screen opens — the store may be
    // empty if the user navigated here without visiting the Chats screen first.
    useEffect(() => {
        chatService.getPendingInvites()
            .then((invites) => setPendingInvites(invites))
            .catch(console.error);
    }, [setPendingInvites]);

    // ── Build invite notifications from chat store ──
    const inviteNotifs: UnifiedNotification[] = useMemo(() =>
        pendingInvites.map((inv) => ({
            id: `invite-${inv.id}`,
            type: "INVITE",
            title: `Invite: ${inv.conversation?.name ?? "Group"}`,
            message: inv.message
                ? inv.message
                : `You've been invited to join as ${inv.role.toLowerCase()}`,
            time: formatTime(inv.createdAt),
            rawCreatedAt: new Date(inv.createdAt).getTime(),
            filterType: "invites" as FilterCategory,
            read: false,
            ...iconForType("INVITE"),
            relatedId: inv.id,
            isInvite: true,
        })),
        [pendingInvites]
    );

    // ── Fetch forum notifications ──
    const fetchNotifications = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError("");
        try {
            const data = await forumService.listNotifications();
            setForumNotifs(
                data.map((n: any) => ({
                    id: n.id,
                    type: n.type,
                    title: n.title,
                    message: n.message,
                    time: formatTime(n.createdAt),
                    rawCreatedAt: new Date(n.createdAt).getTime(),
                    filterType: mapNotifType(n.type),
                    read: n.read,
                    ...iconForType(n.type),
                    relatedId: n.relatedId ?? null,
                    isInvite: false,
                }))
            );
        } catch {
            setError("Could not load notifications. Pull down to retry.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    // ── Merge + sort newest first ──
    const allNotifications = useMemo(() =>
        [...forumNotifs, ...inviteNotifs].sort((a, b) => b.rawCreatedAt - a.rawCreatedAt),
        [forumNotifs, inviteNotifs]
    );

    const filtered = useMemo(() =>
        activeFilter === "all"
            ? allNotifications
            : allNotifications.filter((n) => n.filterType === activeFilter),
        [allNotifications, activeFilter]
    );

    const hasUnread = allNotifications.some((n) => !n.read);
    const inviteCount = inviteNotifs.length;

    // ── Actions ──
    const handleMarkAllRead = async () => {
        try {
            await forumService.markAllNotificationsRead();
            setForumNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
        } catch { /* silent */ }
    };

    const handleNotificationPress = async (item: UnifiedNotification) => {
        // 1. Mark forum notification as read
        if (!item.isInvite && !item.read) {
            try {
                await forumService.markNotificationRead(item.id);
                setForumNotifs((prev) =>
                    prev.map((n) => n.id === item.id ? { ...n, read: true } : n)
                );
            } catch { /* silent */ }
        }

        // 2. Navigate based on type
        if (item.type === "INVITE") {
            // Open the invites screen where user can accept/decline
            navigation.navigate("Chats", { screen: "Invites" });
            return;
        }

        if (
            (item.type === "ANSWER" || item.type === "ACCEPTED" ||
             item.type === "MENTION" || item.type === "LIKE") &&
            item.relatedId
        ) {
            // Open the forum question thread
            navigation.navigate("QuestionDetails", { questionId: item.relatedId });
            return;
        }

        if (item.type === "MODERATION" || item.type.startsWith("ADMIN_")) {
            // No deep-link target — show full content in alert
            Alert.alert(item.title, item.message, [{ text: "OK" }]);
            return;
        }
    };

    const cardBorderStyle = (item: UnifiedNotification) => {
        if (highContrast) return { borderWidth: 2, borderColor: "#000000" };
        if (!item.read) return { borderLeftWidth: 4, borderLeftColor: colors.primary };
        return { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };
    };

    return (
        <ScreenWrapper>
            {/* HEADER */}
            <AppHeader
                title="Notifications"
                onBackPress={() => navigation.goBack()}
                rightActions={
                    hasUnread ? (
                        <TouchableOpacity
                            style={styles.markAllTouch}
                            onPress={handleMarkAllRead}
                            accessibilityRole="button"
                            accessibilityLabel="Mark all as read"
                            activeOpacity={0.7}
                        >
                            <AccessibleText style={styles.markAllText}>Mark all</AccessibleText>
                        </TouchableOpacity>
                    ) : null
                }
            />

            {/* FILTER PILLS */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[styles.filterContainer, { paddingHorizontal: spacing.lg }]}
            >
                {(Object.keys(FILTER_LABELS) as FilterCategory[]).map((value) => {
                    const active = activeFilter === value;
                    const showBadge = value === "invites" && inviteCount > 0;
                    return (
                        <TouchableOpacity
                            key={value}
                            style={[
                                styles.filterPill,
                                { backgroundColor: active ? colors.primary : colors.surface },
                                active && styles.activeFilterPill,
                                highContrast && {
                                    borderWidth: 2,
                                    borderColor: active ? "#000000" : "#888888",
                                },
                            ]}
                            onPress={() => setActiveFilter(value)}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={`${FILTER_LABELS[value]} filter`}
                        >
                            <AccessibleText
                                style={[
                                    styles.filterText,
                                    { color: active ? "#FFFFFF" : colors.text },
                                    active && styles.activeFilterText,
                                ]}
                            >
                                {FILTER_LABELS[value]}
                            </AccessibleText>
                            {showBadge && (
                                <View style={styles.filterBadge}>
                                    <AccessibleText style={styles.filterBadgeText}>{inviteCount}</AccessibleText>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* LIST */}
            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.listContainer, { paddingHorizontal: spacing.lg }]}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); fetchNotifications(true); }}
                            tintColor={colors.primary}
                        />
                    }
                >
                    {error ? (
                        <View style={styles.emptyState}>
                            <AccessibleText style={styles.emptyEmoji}>⚠️</AccessibleText>
                            <AccessibleText variant="body" style={[styles.emptyText, { color: colors.subtext }]}>
                                {error}
                            </AccessibleText>
                        </View>
                    ) : filtered.length === 0 ? (
                        <View style={styles.emptyState}>
                            <AccessibleText style={styles.emptyEmoji}>🔔</AccessibleText>
                            <AccessibleText variant="title" style={[styles.emptyTitle, { color: colors.text }]}>
                                No Notifications
                            </AccessibleText>
                            <AccessibleText variant="body" style={[styles.emptyText, { color: colors.subtext }]}>
                                {activeFilter === "all"
                                    ? "You're all caught up!"
                                    : `No ${FILTER_LABELS[activeFilter].toLowerCase()} notifications yet.`}
                            </AccessibleText>
                        </View>
                    ) : (
                        filtered.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={[
                                    styles.card,
                                    { backgroundColor: colors.card },
                                    cardBorderStyle(item),
                                    !item.read && { backgroundColor: highContrast ? colors.card : "rgba(80,0,136,0.04)" },
                                ]}
                                onPress={() => handleNotificationPress(item)}
                                activeOpacity={0.75}
                                accessibilityRole="button"
                                accessibilityLabel={`${item.title}. ${item.time}. ${item.read ? "Read" : "Unread"}`}
                                accessibilityHint={
                                    item.type === "INVITE"
                                        ? "Double tap to view invite"
                                        : item.relatedId
                                            ? "Double tap to open"
                                            : "Double tap to read"
                                }
                            >
                                {/* ICON */}
                                <View
                                    style={[
                                        styles.iconWrap,
                                        { backgroundColor: highContrast ? "#FFFFFF" : item.iconBg },
                                        highContrast && { borderWidth: 2, borderColor: "#000000" },
                                    ]}
                                >
                                    <AccessibleText style={{ fontSize: 20 }}>{item.icon}</AccessibleText>
                                </View>

                                {/* CONTENT */}
                                <View style={styles.contentWrap}>
                                    <AccessibleText
                                        style={[
                                            styles.cardTitle,
                                            { color: colors.text },
                                            item.read && styles.readTitle,
                                        ]}
                                        numberOfLines={2}
                                    >
                                        {item.title}
                                    </AccessibleText>
                                    {!!item.message && (
                                        <AccessibleText
                                            style={[styles.cardMessage, { color: colors.subtext }]}
                                            numberOfLines={2}
                                        >
                                            {item.message}
                                        </AccessibleText>
                                    )}
                                    <View style={styles.metaRow}>
                                        <AccessibleText style={[styles.cardTime, { color: colors.subtext }]}>
                                            {item.time}
                                        </AccessibleText>
                                        {/* Action hint for actionable types */}
                                        {(item.type === "INVITE" || !!item.relatedId) && (
                                            <AccessibleText style={[styles.actionHint, { color: colors.primary }]}>
                                                {item.type === "INVITE" ? "View Invite →" : "Open →"}
                                            </AccessibleText>
                                        )}
                                    </View>
                                </View>

                                {/* UNREAD DOT */}
                                {!item.read && (
                                    <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                                )}
                            </TouchableOpacity>
                        ))
                    )}
                    <View style={{ height: 120 }} />
                </ScrollView>
            )}

            <AppFooter activeTab="Home" />
        </ScreenWrapper>
    );
};

export default NotificationsScreen;

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
    markAllTouch: {
        minWidth: 48,
        minHeight: 48,
        justifyContent: "center",
        alignItems: "center",
    },
    markAllText: {
        color: "#FFFFFF",
        fontWeight: "600",
        fontSize: 14,
    },
    filterContainer: {
        maxHeight: 68,
        paddingTop: 14,
    },
    filterPill: {
        height: 38,
        paddingHorizontal: 20,
        borderRadius: 999,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 10,
        flexDirection: "row",
        gap: 6,
    },
    activeFilterPill: {
        shadowColor: "#500088",
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 4,
    },
    filterText: {
        fontWeight: "600",
        fontSize: 14,
    },
    activeFilterText: {
        fontWeight: "700",
    },
    filterBadge: {
        backgroundColor: "#DC2626",
        borderRadius: 999,
        minWidth: 18,
        height: 18,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 4,
    },
    filterBadgeText: {
        color: "#FFFFFF",
        fontSize: 10,
        fontWeight: "800",
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    listContainer: {
        paddingTop: 12,
    },
    card: {
        borderRadius: 14,
        padding: 14,
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 10,
    },
    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 14,
        flexShrink: 0,
    },
    contentWrap: {
        flex: 1,
        minWidth: 0,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: "700",
        lineHeight: 20,
        marginBottom: 3,
    },
    readTitle: {
        fontWeight: "500",
    },
    cardMessage: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 5,
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    cardTime: {
        fontSize: 12,
    },
    actionHint: {
        fontSize: 12,
        fontWeight: "700",
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 999,
        marginLeft: 10,
        marginTop: 6,
        flexShrink: 0,
    },
    emptyState: {
        marginTop: 80,
        alignItems: "center",
        paddingHorizontal: 24,
    },
    emptyEmoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: "700",
        marginBottom: 8,
    },
    emptyText: {
        textAlign: "center",
        lineHeight: 22,
    },
});
