import React, { useState } from "react";

import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
} from "react-native";

import { TabView } from "react-native-tab-view";

import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";

import GroupsTab from "../../components/community/GroupsTab";
import ForumsTab from "../../components/community/ForumsTab";
import MentorsTab from "../../components/community/MentorsTab";
import ChatsTab from "../../components/community/ChatsTab";

const initialLayout = {
    width: Dimensions.get("window").width,
};

const CommunityScreen = ({
    navigation,
    route,
}: any) => {
    const [index, setIndex] =
        useState(() => {
            const initial = route?.params?.initialTab;
            if (initial === "forums") return 1;
            if (initial === "mentors") return 2;
            if (initial === "chats") return 3;
            return 0;
        });

    const [routes] = useState([
        {
            key: "groups",
            title: "Groups",
        },

        {
            key: "forums",
            title: "Forums",
        },

        {
            key: "mentors",
            title: "Mentors",
        },

        {
            key: "chats",
            title: "Chats",
        },
    ]);

    const renderScene = ({
        route,
    }: any) => {
        switch (route.key) {
            case "groups":
                return <GroupsTab />;

            case "forums":
                return <ForumsTab />;

            case "mentors":
                return <MentorsTab />;

            case "chats":
                return <ChatsTab />;

            default:
                return null;
        }
    };

    const renderTabBar = (
        props: any
    ) => {
        return (
            <View style={styles.tabBar}>
                {props.navigationState.routes.map(
                    (
                        route: any,
                        i: number
                    ) => {
                        const active =
                            index === i;

                        return (
                            <TouchableOpacity
                                key={route.key}
                                style={
                                    styles.tabItem
                                }
                                onPress={() =>
                                    setIndex(i)
                                }
                                activeOpacity={
                                    0.8
                                }
                            >
                                <Text
                                    style={[
                                        styles.tabText,

                                        active &&
                                        styles.activeTabText,
                                    ]}
                                >
                                    {
                                        route.title
                                    }
                                </Text>

                                {active && (
                                    <View
                                        style={
                                            styles.activeIndicator
                                        }
                                    />
                                )}
                            </TouchableOpacity>
                        );
                    }
                )}
            </View>
        );
    };

    return (
        <ScreenWrapper statusBarStyle="light">

            {/* GLOBAL HEADER */}
            <AppHeader
                title="Community"
                showNotification
                hideBackButton={true}
                onNotificationPress={() =>
                    navigation.navigate(
                        "Notifications"
                    )
                }
            />

            {/* TABS */}
            <TabView
                navigationState={{
                    index,
                    routes,
                }}
                renderScene={
                    renderScene
                }
                onIndexChange={
                    setIndex
                }
                initialLayout={
                    initialLayout
                }
                renderTabBar={
                    renderTabBar
                }
                swipeEnabled
                lazy
            />
        </ScreenWrapper>

    );
};

export default CommunityScreen;

const styles = StyleSheet.create({
    tabBar: {
        flexDirection: "row",

        backgroundColor:
            "#FAF8FF",

        paddingHorizontal: 24,

        borderBottomWidth: 1,

        borderBottomColor:
            "#EEEDF4",
    },

    tabItem: {
        marginRight: 28,

        paddingVertical: 16,

        alignItems: "center",

        justifyContent:
            "center",
    },

    tabText: {
        fontSize: 15,

        color: "#6B7280",

        fontWeight: "500",
    },

    activeTabText: {
        color: "#7E22CE",

        fontWeight: "700",
    },

    activeIndicator: {
        position: "absolute",

        bottom: 0,

        width: "100%",

        height: 3,

        borderRadius: 999,

        backgroundColor:
            "#9333EA",
    },
});