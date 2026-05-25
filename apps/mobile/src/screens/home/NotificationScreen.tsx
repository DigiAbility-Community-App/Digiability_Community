import React, { useState } from "react";
import {
    View,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from "react-native";

import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import AppFooter from "../../components/layout/AppFooter";

type NotificationType = {
    id: string;
    title: string;
    time: string;
    type: "all" | "community" | "events" | "alerts";
    read: boolean;
    icon: string;
    iconBg: string;
    iconColor: string;
};

const NotificationsScreen = () => {
    const navigation = useNavigation<any>();
    const { colors, spacing, highContrast } = useTheme();

    const [activeFilter, setActiveFilter] = useState("all");

    // ------------------------
    // DUMMY DATA
    // Replace with API later
    // ------------------------
    const notifications: NotificationType[] = [
        {
            id: "1",
            title: "Your therapist replied to your query",
            time: "5 min ago",
            type: "community",
            read: false,
            icon: "💬",
            iconBg: "#F1DBFF",
            iconColor: "#500088",
        },
        {
            id: "2",
            title: "Legal Aid Workshop registrations are now open",
            time: "1 hour ago",
            type: "events",
            read: false,
            icon: "⚖️",
            iconBg: "#FFDDB8",
            iconColor: "#855300",
        },
        {
            id: "3",
            title: "Your community post received new likes",
            time: "Yesterday",
            type: "community",
            read: true,
            icon: "❤️",
            iconBg: "#D1FAE5",
            iconColor: "#059669",
        },
        {
            id: "4",
            title: "Safety check-in reminder pending",
            time: "2 hours ago",
            type: "alerts",
            read: false,
            icon: "🚨",
            iconBg: "#FFDAD6",
            iconColor: "#BA1A1A",
        },
        {
            id: "5",
            title: "Mentor accepted your request",
            time: "Yesterday",
            type: "community",
            read: true,
            icon: "🎓",
            iconBg: "#F1DBFF",
            iconColor: "#500088",
        },
    ];

    // ------------------------
    // FILTER
    // ------------------------
    const filteredNotifications =
        activeFilter === "all"
            ? notifications
            : notifications.filter(
                (item) => item.type === activeFilter
            );

    const cardBorder = (item: NotificationType) => {
        if (highContrast) {
            return { borderWidth: 2, borderColor: "#000000" };
        }
        if (!item.read) {
            return { borderLeftWidth: 4, borderLeftColor: colors.primary };
        }
        return { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };
    };

    return (
        <ScreenWrapper>
            {/* HEADER */}
            <AppHeader
                title="Notifications"
                onBackPress={() => navigation.goBack()}
                rightActions={
                    <TouchableOpacity
                        style={styles.markAllTouch}
                        accessible={true}
                        accessibilityRole="button"
                        accessibilityLabel="Mark all as read"
                        accessibilityHint="Double tap to mark all notifications as read"
                        activeOpacity={0.7}
                    >
                        <AccessibleText style={styles.markAllText}>
                            Mark all
                        </AccessibleText>
                    </TouchableOpacity>
                }
            />

            {/* FILTERS */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[styles.filterContainer, { paddingHorizontal: spacing.lg }]}
            >
                {[
                    { label: "All", value: "all" },
                    { label: "Community", value: "community" },
                    { label: "Events", value: "events" },
                    { label: "Alerts", value: "alerts" },
                ].map((filter) => {
                    const active = activeFilter === filter.value;

                    return (
                        <TouchableOpacity
                            key={filter.value}
                            style={[
                                styles.filterPill,
                                { backgroundColor: active ? colors.primary : colors.surface },
                                active && styles.activeFilterPill,
                                highContrast && {
                                    borderWidth: 2,
                                    borderColor: active ? "#000000" : "#888888",
                                }
                            ]}
                            onPress={() => setActiveFilter(filter.value)}
                            accessible={true}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={`${filter.label} filter`}
                            accessibilityHint={`Double tap to filter notifications by ${filter.label}`}
                        >
                            <AccessibleText
                                style={[
                                    styles.filterText,
                                    { color: active ? "#FFFFFF" : colors.text },
                                    active && styles.activeFilterText,
                                ]}
                            >
                                {filter.label}
                            </AccessibleText>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* LIST */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.listContainer, { paddingHorizontal: spacing.lg }]}
            >
                {filteredNotifications.length === 0 ? (
                    <View style={styles.emptyState}>
                        <AccessibleText style={styles.emptyEmoji}>
                            🔔
                        </AccessibleText>

                        <AccessibleText variant="title" style={[styles.emptyTitle, { color: colors.text }]}>
                            No Notifications
                        </AccessibleText>

                        <AccessibleText variant="body" style={[styles.emptyText, { color: colors.subtext }]}>
                            You currently don’t have any notifications.
                        </AccessibleText>
                    </View>
                ) : (
                    filteredNotifications.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={[
                                styles.notificationCard,
                                { backgroundColor: colors.card },
                                cardBorder(item),
                            ]}
                            accessible={true}
                            accessibilityRole="button"
                            accessibilityLabel={`Notification: ${item.title}. Received ${item.time}. ${item.read ? "Read" : "Unread"}`}
                            accessibilityHint="Double tap to open this notification details"
                        >
                            {/* LEFT */}
                            <View style={styles.notificationLeft}>
                                {/* ICON */}
                                <View
                                    style={[
                                        styles.iconWrap,
                                        {
                                            backgroundColor: highContrast ? "#FFFFFF" : item.iconBg,
                                        },
                                        highContrast && { borderWidth: 2, borderColor: "#000000" }
                                    ]}
                                >
                                    <AccessibleText style={{ fontSize: 18 }}>
                                        {item.icon}
                                    </AccessibleText>
                                </View>

                                {/* CONTENT */}
                                <View style={styles.contentWrap}>
                                    <AccessibleText
                                        style={[
                                            styles.notificationTitle,
                                            { color: colors.text },
                                            item.read && styles.readTitle,
                                        ]}
                                    >
                                        {item.title}
                                    </AccessibleText>

                                    <AccessibleText
                                        style={[
                                            styles.notificationTime,
                                            { color: colors.subtext }
                                        ]}
                                    >
                                        {item.time}
                                    </AccessibleText>
                                </View>
                            </View>

                            {/* UNREAD DOT */}
                            {!item.read && (
                                <View
                                    style={[
                                        styles.unreadDot,
                                        { backgroundColor: colors.primary }
                                    ]}
                                />
                            )}
                        </TouchableOpacity>
                    ))
                )}

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* NAVBAR */}
            <AppFooter activeTab="Home" />
        </ScreenWrapper>
    );
};

export default NotificationsScreen;

// --------------------------
// STYLES
// --------------------------
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
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
    // FILTERS
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
    // LIST
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
        marginBottom: 6,
    },
    readTitle: {
        fontWeight: "600",
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
    // EMPTY
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
    // Legacy navbar style removed
});