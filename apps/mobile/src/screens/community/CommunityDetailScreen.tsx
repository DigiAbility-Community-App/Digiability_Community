import React, { useState, useMemo } from "react";
import { View, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { TabView } from "react-native-tab-view";
import { useChatStore } from "@store/chatStore";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import GroupsTab from "../../components/community/GroupsTab";
import CareCirclesTab from "../../components/community/CareCirclesTab";
import ForumsTab from "../../components/community/ForumsTab";
import MentorsTab from "../../components/community/MentorsTab";
import ChatsTab from "../../components/community/ChatsTab";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";

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
  const { colors } = useTheme();

  const [index, setIndex] = useState(() => {
    const initial: string | undefined = route?.params?.initialTab;
    if (initial === "groups")      return 1;
    if (initial === "careCircles") return 2;
    if (initial === "forums")      return 3;
    if (initial === "mentors")     return 4;
    return 0; // default: Chats
  });

  // Per-section badge = number of conversations with UNREAD messages, bucketed
  // by section. Pending invites are intentionally NOT counted here (they were
  // inflating the Groups badge to 1 with zero unread chats).
  // (Forums/Mentors have no chat-store unread source yet — they stay 0.)
  const conversations = useChatStore((s) => s.conversations);
  const sectionUnread = useMemo(() => {
    const counts: Record<RouteKey, number> = {
      chats: 0, groups: 0, careCircles: 0, forums: 0, mentors: 0,
    };
    for (const c of Object.values(conversations)) {
      if (!c || (c.unreadCount || 0) <= 0) continue;
      if (c.type === "DIRECT") counts.chats++;
      else if (c.type === "GROUP" && c.subType === "CARE_CIRCLE") counts.careCircles++;
      else if (c.type === "GROUP") counts.groups++;
    }
    return counts;
  }, [conversations]);

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
    <View style={[styles.tabBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      {props.navigationState.routes.map((r: any, i: number) => {
        const active = index === i;
        const count = sectionUnread[r.key as RouteKey] || 0;
        return (
          <TouchableOpacity
            key={r.key}
            style={styles.tabItem}
            onPress={() => setIndex(i)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityLabel={`${r.title} tab${count > 0 ? `, ${count} unread` : ""}`}
            accessibilityState={{ selected: active }}
          >
            <View style={styles.tabLabelRow}>
              <AccessibleText
                variant="body"
                style={[styles.tabText, { color: active ? colors.primary : colors.subtext }, active && styles.activeTabText]}
              >
                {r.title}
              </AccessibleText>
              {count > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: colors.secondary }]}>
                  <AccessibleText variant="overline" style={styles.tabBadgeText}>
                    {count > 99 ? "99+" : count}
                  </AccessibleText>
                </View>
              )}
            </View>
            {active && <View style={[styles.activeIndicator, { backgroundColor: colors.secondary }]} />}
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
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  tabItem: {
    marginRight: 20,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
  },
  activeTabText: {
    fontWeight: "700",
  },
  activeIndicator: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 3,
    borderRadius: 999,
  },
});
