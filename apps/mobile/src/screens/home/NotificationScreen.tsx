import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from "react-native";

import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import AppFooter from "../../components/layout/AppFooter";
import { forumService } from "../../services/forumService";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type FilterCategory = "all" | "community" | "events" | "alerts";

interface ApiNotification {
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    relatedId: string | null;
    createdAt: string;
}

interface DisplayNotification {
    id: string;
    title: string;
    message: string;
    time: string;
    filterType: FilterCategory;
    read: boolean;
    icon: string;
    iconBg: string;
    iconColor: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function mapNotifType(type: string): FilterCategory {
    if (type.startsWith("ADMIN_ANNOUNCEMENT")) return "events";
    if (type.startsWith("ADMIN_ALERT") || type === "MODERATION") return "alerts";
    if (type.startsWith("ADMIN_")) return "alerts";
    return "community"; // ANSWER, ACCEPTED, MENTION, LIKE
}

function iconForType(type: string): { icon: string; iconBg: string; iconColor: string } {
    if (type === "ANSWER" || type === "ACCEPTED") return { icon: "💬", iconBg: "#F1DBFF", iconColor: "#500088" };
    if (type === "MENTION") return { icon: "📣", iconBg: "#FFF3CD", iconColor: "#856404" };
    if (type === "LIKE") return { icon: "❤️", iconBg: "#D1FAE5", iconColor: "#059669" };
    if (type === "MODERATION") return { icon: "🚨", iconBg: "#FFDAD6", iconColor: "#BA1A1A" };
    if (type.includes("ALERT")) return { icon: "⚠️", iconBg: "#FFF3CD", iconColor: "#855300" };
    if (type.includes("ANNOUNCEMENT")) return { icon: "📢", iconBg: "#DBEAFE", iconColor: "#1D4ED8" };
    return { icon: "🔔", iconBg: "#F1DBFF", iconColor: "#500088" };
}

function formatTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "Yesterday";
    return `${days} days ago`;
}

function toDisplay(n: ApiNotification): DisplayNotification {
    return {
        id: n.id,
        title: n.title,
        message: n.message,
        time: formatTime(n.createdAt),
        filterType: mapNotifType(n.type),
        read: n.read,
        ...iconForType(n.type),
    };
}

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────
const NotificationsScreen = () => {
    const navigation = useNavigation<any>();
    const { colors, spacing, highContrast } = useTheme();

    const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");
    const [notifications, setNotifications] = useState<DisplayNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const fetchNotifications = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError("");
        try {
            const data: ApiNotification[] = await forumService.listNotifications();
            setNotifications(data.map(toDisplay));
        } catch {
            setError("Could not load notifications. Pull down to retry.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    const handleMarkAllRead = async () => {
        try {
            await forumService.markAllNotificationsRead();
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch {
            // silently ignore
        }
    };

    const handleMarkRead = async (id: string) => {
        const item = notifications.find(n => n.id === id);
        if (!item || item.read) return;
        try {
            await forumService.markNotificationRead(id);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, read: true } : n)
            );
        } catch {
            // silently ignore
        }
    };

    const filtered = activeFilter === "all"
        ? notifications
        : notifications.filter(n => n.filterType === activeFilter);

    const cardBorder = (item: DisplayNotification) => {
        if (highContrast) return { borderWidth: 2, borderColor: "#000000" };
        if (!item.read) return { borderLeftWidth: 4, borderLeftColor: colors.primary };
        return { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };
    };

    const hasUnread = notifications.some(n => !n.read);

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
                            accessible={true}
                            accessibilityRole="button"
                            accessibilityLabel="Mark all as read"
                            activeOpacity={0.7}
                        >
                            <AccessibleText style={styles.markAllText}>Mark all</AccessibleText>
                        </TouchableOpacity>
                    ) : null
                }
            />

            {/* FILTERS */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[styles.filterContainer, { paddingHorizontal: spacing.lg }]}
            >
                {(["all", "community", "events", "alerts"] as FilterCategory[]).map((value) => {
                    const label = value.charAt(0).toUpperCase() + value.slice(1);
                    const active = activeFilter === value;
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
                                }
                            ]}
                            onPress={() => setActiveFilter(value)}
                            accessible={true}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={`${label} filter`}
                        >
                            <AccessibleText
                                style={[
                                    styles.filterText,
                                    { color: active ? "#FFFFFF" : colors.text },
                                    active && styles.activeFilterText,
                                ]}
                            >
                                {label}
                            </AccessibleText>
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
                                    ? "You don't have any notifications yet."
                                    : `No ${activeFilter} notifications.`}
                            </AccessibleText>
                        </View>
                    ) : (
                        filtered.map((item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={[
                                    styles.notificationCard,
                                    { backgroundColor: colors.card },
                                    cardBorder(item),
                                ]}
                                onPress={() => handleMarkRead(item.id)}
                                accessible={true}
                                accessibilityRole="button"
                                accessibilityLabel={`${item.title}. ${item.time}. ${item.read ? "Read" : "Unread"}`}
                                accessibilityHint="Double tap to mark as read"
                            >
                                {/* LEFT */}
                                <View style={styles.notificationLeft}>
                                    <View
                                        style={[
                                            styles.iconWrap,
                                            { backgroundColor: highContrast ? "#FFFFFF" : item.iconBg },
                                            highContrast && { borderWidth: 2, borderColor: "#000000" }
                                        ]}
                                    >
                                        <AccessibleText style={{ fontSize: 18 }}>{item.icon}</AccessibleText>
                                    </View>
                                    <View style={styles.contentWrap}>
                                        <AccessibleText
                                            style={[
                                                styles.notificationTitle,
                                                { color: colors.text },
                                                item.read && styles.readTitle,
                                            ]}
                                            numberOfLines={2}
                                        >
                                            {item.title}
                                        </AccessibleText>
                                        {item.message ? (
                                            <AccessibleText
                                                style={[styles.notificationMessage, { color: colors.subtext }]}
                                                numberOfLines={1}
                                            >
                                                {item.message}
                                            </AccessibleText>
                                        ) : null}
                                        <AccessibleText style={[styles.notificationTime, { color: colors.subtext }]}>
                                            {item.time}
                                        </AccessibleText>
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

            {/* NAVBAR */}
            <AppFooter activeTab="Home" />
        </ScreenWrapper>
    );
};

export default NotificationsScreen;

// ─────────────────────────────────────────────
// STYLES
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
        maxHeight: 64,
        paddingTop: 16,
    },
    filterPill: {
        height: 40,
        paddingHorizontal: 24,
        borderRadius: 999,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
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
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    listContainer: {
        paddingTop: 12,
    },
    notificationCard: {
        minHeight: 80,
        borderRadius: 12,
        padding: 16,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    notificationLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 16,
    },
    contentWrap: {
        flex: 1,
    },
    notificationTitle: {
        fontSize: 15,
        fontWeight: "700",
        lineHeight: 20,
        marginBottom: 4,
    },
    readTitle: {
        fontWeight: "600",
    },
    notificationMessage: {
        fontSize: 12,
        lineHeight: 16,
        marginBottom: 4,
    },
    notificationTime: {
        fontSize: 12,
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 999,
        marginLeft: 12,
    },
    emptyState: {
        marginTop: 80,
        alignItems: "center",
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
        paddingHorizontal: 24,
    },
});
