import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { TabView } from "react-native-tab-view";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import GroupsTab from "../../components/community/GroupsTab";
import CareCirclesTab from "../../components/community/CareCirclesTab";
import ForumsTab from "../../components/community/ForumsTab";
import MentorsTab from "../../components/community/MentorsTab";
import ChatsTab from "../../components/community/ChatsTab";

const initialLayout = { width: Dimensions.get("window").width };

// Tab order: Chats (DMs only) | Groups | Care Circles | Forums | Mentors
const ROUTES = [
  { key: "chats",        title: "Chats"        },
  { key: "groups",       title: "Groups"       },
  { key: "careCircles",  title: "Care Circles" },
  { key: "forums",       title: "Forums"       },
  { key: "mentors",      title: "Mentors"      },
] as const;

type RouteKey = typeof ROUTES[number]["key"];

const CommunityDetailScreen = ({ navigation, route }: any) => {
  const [index, setIndex] = useState(() => {
    const initial: string | undefined = route?.params?.initialTab;
    if (initial === "groups")      return 1;
    if (initial === "careCircles") return 2;
    if (initial === "forums")      return 3;
    if (initial === "mentors")     return 4;
    return 0; // default: Chats
  });

  const renderScene = ({ route: r }: { route: { key: RouteKey } }) => {
    switch (r.key) {
      case "chats":       return <ChatsTab />;
      case "groups":      return <GroupsTab />;
      case "careCircles": return <CareCirclesTab />;
      case "forums":      return <ForumsTab />;
      case "mentors":     return <MentorsTab />;
      default:            return null;
    }
  };

  const renderTabBar = (props: any) => (
    <View style={styles.tabBar}>
      {props.navigationState.routes.map((r: any, i: number) => {
        const active = index === i;
        return (
          <TouchableOpacity
            key={r.key}
            style={styles.tabItem}
            onPress={() => setIndex(i)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, active && styles.activeTabText]}>
              {r.title}
            </Text>
            {active && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <ScreenWrapper statusBarStyle="light">
      <AppHeader
        title="Community"
        showNotification
        hideBackButton={true}
        onNotificationPress={() => navigation.navigate("Notifications")}
      />
      <TabView
        navigationState={{ index, routes: [...ROUTES] }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={initialLayout}
        renderTabBar={renderTabBar}
        swipeEnabled
        lazy
      />
    </ScreenWrapper>
  );
};

export default CommunityDetailScreen;

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FAF8FF",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEDF4",
  },
  tabItem: {
    marginRight: 20,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: 14,
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
    backgroundColor: "#9333EA",
  },
});
