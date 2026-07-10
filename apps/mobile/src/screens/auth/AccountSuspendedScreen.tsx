import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Ban, Clock, ArrowLeft } from "lucide-react-native";
import { AuthStackParamList } from "@navigation/AuthNavigator";
import { AccessibleText } from "../../components/shared/AccessibleText";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "AccountSuspended">;
  route: RouteProp<AuthStackParamList, "AccountSuspended">;
};

/** "3 days, 4 hours" style countdown from now until `until`. */
function formatRemaining(until: Date): string {
  const ms = until.getTime() - Date.now();
  if (ms <= 0) return "less than a minute";
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (days > 0) return `${days} day${days === 1 ? "" : "s"}${hours > 0 ? `, ${hours} hour${hours === 1 ? "" : "s"}` : ""}`;
  if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"}${minutes > 0 ? `, ${minutes} minute${minutes === 1 ? "" : "s"}` : ""}`;
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

const AccountSuspendedScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const { permanent, suspendedUntil, reason } = route.params ?? {};

  const untilDate = useMemo(
    () => (suspendedUntil ? new Date(suspendedUntil) : null),
    [suspendedUntil]
  );

  const [remaining, setRemaining] = useState(() => (untilDate ? formatRemaining(untilDate) : ""));

  useEffect(() => {
    if (!untilDate) return;
    const id = setInterval(() => setRemaining(formatRemaining(untilDate)), 60_000);
    return () => clearInterval(id);
  }, [untilDate]);

  return (
    <ScreenWrapper statusBarStyle="dark">
      <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <View style={styles.iconCircle}>
          <Ban size={40} color="#DC2626" strokeWidth={2} />
        </View>

        <AccessibleText variant="title" style={styles.title}>
          {permanent ? "Account Suspended" : "Account Temporarily Suspended"}
        </AccessibleText>

        <AccessibleText variant="body" style={styles.message}>
          {reason || "Your account has been suspended for violating our community guidelines."}
        </AccessibleText>

        {!permanent && untilDate && (
          <View style={styles.countdownCard}>
            <Clock size={18} color="#7C3AED" strokeWidth={2} />
            <AccessibleText variant="body" style={styles.countdownText}>
              Access restored in {remaining}
            </AccessibleText>
          </View>
        )}

        {permanent && (
          <AccessibleText variant="caption" style={styles.appealText}>
            If you believe this was a mistake, please contact support at
            {" "}support@digiability.com.
          </AccessibleText>
        )}

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.replace("Welcome")}
          accessibilityRole="button"
          accessibilityLabel="Back to login"
        >
          <ArrowLeft size={18} color="#7C3AED" strokeWidth={2} />
          <AccessibleText variant="body" style={styles.backButtonText}>
            Back to login
          </AccessibleText>
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 28,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    textAlign: "center",
    marginBottom: 12,
    fontWeight: "700",
  },
  message: {
    textAlign: "center",
    color: "#6B7280",
    marginBottom: 20,
    lineHeight: 22,
  },
  countdownCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F3EAFF",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    marginBottom: 20,
  },
  countdownText: {
    color: "#500088",
    fontWeight: "600",
  },
  appealText: {
    textAlign: "center",
    color: "#9CA3AF",
    marginBottom: 24,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  backButtonText: {
    color: "#7C3AED",
    fontWeight: "700",
  },
});

export default AccountSuspendedScreen;
