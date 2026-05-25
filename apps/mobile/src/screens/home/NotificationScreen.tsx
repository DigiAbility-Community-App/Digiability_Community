import React, { useState } from "react";

import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
} from "react-native";

import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";

type NotificationType = {
    id: string;
    title: string;
    time: string;
    type:
    | "all"
    | "community"
    | "events"
    | "alerts";

    read: boolean;

    icon: string;
    iconBg: string;
    iconColor: string;
};

const NotificationsScreen = () => {
    const navigation = useNavigation<any>();

    const [activeFilter, setActiveFilter] =
        useState("all");

    // ------------------------
    // DUMMY DATA
    // Replace with API later
    // ------------------------

    const notifications: NotificationType[] =
        [
            {
                id: "1",
                title:
                    "Your therapist replied to your query",
                time: "5 min ago",
                type: "community",
                read: false,
                icon: "💬",
                iconBg: "#F1DBFF",
                iconColor: "#500088",
            },

            {
                id: "2",
                title:
                    "Legal Aid Workshop registrations are now open",
                time: "1 hour ago",
                type: "events",
                read: false,
                icon: "⚖️",
                iconBg: "#FFDDB8",
                iconColor: "#855300",
            },

            {
                id: "3",
                title:
                    "Your community post received new likes",
                time: "Yesterday",
                type: "community",
                read: true,
                icon: "❤️",
                iconBg: "#D1FAE5",
                iconColor: "#059669",
            },

            {
                id: "4",
                title:
                    "Safety check-in reminder pending",
                time: "2 hours ago",
                type: "alerts",
                read: false,
                icon: "🚨",
                iconBg: "#FFDAD6",
                iconColor: "#BA1A1A",
            },

            {
                id: "5",
                title:
                    "Mentor accepted your request",
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
                (item) =>
                    item.type === activeFilter
            );

    return (
        <SafeAreaView style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    {/* BACK */}
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() =>
                            navigation.goBack()
                        }
                    >
                        <Text style={styles.backIcon}>
                            ←
                        </Text>
                    </TouchableOpacity>

                    {/* TITLE */}
                    <Text style={styles.headerTitle}>
                        Notifications
                    </Text>
                </View>

                {/* MARK ALL */}
                <TouchableOpacity>
                    <Text style={styles.markAll}>
                        Mark all
                    </Text>
                </TouchableOpacity>
            </View>

            {/* FILTERS */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                    false
                }
                style={styles.filterContainer}
            >
                {[
                    {
                        label: "All",
                        value: "all",
                    },

                    {
                        label: "Community",
                        value: "community",
                    },

                    {
                        label: "Events",
                        value: "events",
                    },

                    {
                        label: "Alerts",
                        value: "alerts",
                    },
                ].map((filter) => {
                    const active =
                        activeFilter === filter.value;

                    return (
                        <TouchableOpacity
                            key={filter.value}
                            style={[
                                styles.filterPill,
                                active &&
                                styles.activeFilterPill,
                            ]}
                            onPress={() =>
                                setActiveFilter(
                                    filter.value
                                )
                            }
                        >
                            <Text
                                style={[
                                    styles.filterText,
                                    active &&
                                    styles.activeFilterText,
                                ]}
                            >
                                {filter.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* LIST */}
            <ScrollView
                showsVerticalScrollIndicator={
                    false
                }
                contentContainerStyle={
                    styles.listContainer
                }
            >
                {filteredNotifications.length ===
                    0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>
                            🔔
                        </Text>

                        <Text style={styles.emptyTitle}>
                            No Notifications
                        </Text>

                        <Text style={styles.emptyText}>
                            You currently don’t have
                            any notifications.
                        </Text>
                    </View>
                ) : (
                    filteredNotifications.map(
                        (item) => (
                            <TouchableOpacity
                                key={item.id}
                                style={[
                                    styles.notificationCard,

                                    !item.read &&
                                    styles.unreadCard,
                                ]}
                            >
                                {/* LEFT */}
                                <View
                                    style={
                                        styles.notificationLeft
                                    }
                                >
                                    {/* ICON */}
                                    <View
                                        style={[
                                            styles.iconWrap,
                                            {
                                                backgroundColor:
                                                    item.iconBg,
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={{
                                                fontSize: 18,
                                            }}
                                        >
                                            {item.icon}
                                        </Text>
                                    </View>

                                    {/* CONTENT */}
                                    <View
                                        style={
                                            styles.contentWrap
                                        }
                                    >
                                        <Text
                                            style={[
                                                styles.notificationTitle,

                                                item.read &&
                                                styles.readTitle,
                                            ]}
                                        >
                                            {item.title}
                                        </Text>

                                        <Text
                                            style={
                                                styles.notificationTime
                                            }
                                        >
                                            {item.time}
                                        </Text>
                                    </View>
                                </View>

                                {/* UNREAD DOT */}
                                {!item.read && (
                                    <View
                                        style={
                                            styles.unreadDot
                                        }
                                    />
                                )}
                            </TouchableOpacity>
                        )
                    )
                )}

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* NAVBAR */}
            <View style={styles.navbar}>
                <TouchableOpacity
                    onPress={() =>
                        navigation.navigate("Home")
                    }
                >
                    <Text style={styles.activeNav}>
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

                <TouchableOpacity>
                    <Text style={styles.navText}>
                        Profile
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default NotificationsScreen;

// --------------------------
// STYLES
// --------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FAF8FF",
    },

    // HEADER
    header: {
        height: 64,
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

    backBtn: {
        width: 32,
        height: 32,

        justifyContent: "center",
        alignItems: "center",

        marginRight: 16,
    },

    backIcon: {
        fontSize: 20,
        color: "#FFFFFF",
        fontWeight: "700",
    },

    headerTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#FFFFFF",
    },

    markAll: {
        color: "#FFFFFF",
        fontWeight: "600",
        fontSize: 14,
    },

    // FILTERS
    filterContainer: {
        maxHeight: 64,
        paddingHorizontal: 24,
        paddingTop: 16,
    },

    filterPill: {
        height: 40,

        backgroundColor: "#F4F3FA",

        paddingHorizontal: 24,

        borderRadius: 999,

        justifyContent: "center",
        alignItems: "center",

        marginRight: 12,
    },

    activeFilterPill: {
        backgroundColor: "#500088",

        shadowColor: "#500088",
        shadowOpacity: 0.2,
        shadowRadius: 10,

        elevation: 4,
    },

    filterText: {
        color: "#7E7383",
        fontWeight: "600",
        fontSize: 14,
    },

    activeFilterText: {
        color: "#FFFFFF",
        fontWeight: "700",
    },

    // LIST
    listContainer: {
        paddingHorizontal: 24,
        paddingTop: 12,
    },

    notificationCard: {
        minHeight: 80,

        backgroundColor:
            "rgba(244,243,250,0.5)",

        borderRadius: 12,

        padding: 16,

        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",

        marginBottom: 12,
    },

    unreadCard: {
        backgroundColor: "#F4F3FA",
        borderLeftWidth: 4,
        borderLeftColor: "#500088",
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
        color: "#1A1B20",
        lineHeight: 20,
        marginBottom: 6,
    },

    readTitle: {
        fontWeight: "600",
    },

    notificationTime: {
        fontSize: 12,
        color: "#7E7383",
    },

    unreadDot: {
        width: 10,
        height: 10,

        borderRadius: 999,

        backgroundColor: "#500088",

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
        color: "#1A1B20",
        marginBottom: 8,
    },

    emptyText: {
        textAlign: "center",
        color: "#7E7383",
        lineHeight: 22,
        paddingHorizontal: 24,
    },

    // NAVBAR
    navbar: {
        position: "absolute",

        bottom: 0,
        left: 0,
        right: 0,

        height: 75,

        backgroundColor:
            "rgba(249,248,255,0.9)",

        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,

        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",

        shadowColor: "#500088",
        shadowOpacity: 0.06,
        shadowRadius: 24,

        elevation: 10,
    },

    activeNav: {
        color: "#500088",
        fontWeight: "700",
        fontSize: 11,
        textTransform: "uppercase",
    },

    navText: {
        color: "#64748B",
        fontWeight: "500",
        fontSize: 11,
        textTransform: "uppercase",
    },
});