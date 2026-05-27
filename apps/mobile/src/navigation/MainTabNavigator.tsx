import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "@screens/home/HomeScreen";
import CommunityDetailScreen from "@screens/community/CommunityDetailScreen";
import ServicesScreen from "@screens/services/ServicesScreen";
import LearnScreen from "@screens/learn/LearnScreen";
import HomeProfileScreen from "@screens/profile/HomeProfileScreen";
import AppFooter from "../components/layout/AppFooter";

export type MainTabParamList = {
  Home: undefined;
  CommunityDetail: undefined;
  Services: undefined;
  Learn: undefined;
  HomeProfile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <AppFooter {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="CommunityDetail" component={CommunityDetailScreen} />
      <Tab.Screen name="Services" component={ServicesScreen} />
      <Tab.Screen name="Learn" component={LearnScreen} />
      <Tab.Screen name="HomeProfile" component={HomeProfileScreen} />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
