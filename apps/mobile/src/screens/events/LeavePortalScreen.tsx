import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import {
  ShieldAlert,
  ArrowUpRight,
  ChevronLeft,
  Check,
} from "lucide-react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import * as WebBrowser from "expo-web-browser";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";

export default function LeavePortalScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { colors, spacing, highContrast } = useTheme();
  
  const { externalUrl, eventTitle } = route.params || {};
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleProceed = async () => {
    if (!acknowledged || !externalUrl) return;
    
    try {
      setLoading(true);
      await WebBrowser.openBrowserAsync(externalUrl);
      // After browser closes, pop back to the event details screen
      navigation.goBack();
    } catch (error) {
      console.log("Failed to open external browser:", error);
    } finally {
      setLoading(false);
    }
  };

  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };

  const checkboxBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: colors.border };

  return (
    <ScreenWrapper>
      {/* HEADER */}
      <AppHeader title="External Transition" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* WARNING CARD */}
        <View style={[styles.warningCard, { backgroundColor: colors.card }, cardBorder]}>
          <View style={[styles.alertIconBg, { backgroundColor: highContrast ? "#000000" : "#FEE2E2" }]}>
            <ShieldAlert color={highContrast ? "#FFFFFF" : colors.error} size={32} />
          </View>
          
          <AccessibleText variant="title" style={styles.warningTitle}>
            Leaving Community App
          </AccessibleText>

          <AccessibleText variant="body" style={[styles.warningDesc, { color: colors.subtext }]}>
            You are moving to the external portal to register for:
          </AccessibleText>

          <View style={[styles.eventLabelBox, { backgroundColor: highContrast ? "#000000" : "#F3F4F6" }]}>
            <AccessibleText variant="title" style={{ fontSize: 16, textAlign: "center", color: colors.text }}>
              {eventTitle || "Selected Event"}
            </AccessibleText>
          </View>

          <AccessibleText variant="body" style={[styles.portalInfoText, { color: colors.subtext }]}>
            You will be redirected to the secure <AccessibleText style={{ fontWeight: "700", color: colors.primary }}>Digiability Service Portal</AccessibleText> where you must complete your registration form.
          </AccessibleText>
        </View>

        {/* ACKNOWLEDGMENT CHECKBOX */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setAcknowledged(!acknowledged)}
          style={styles.checkboxRow}
          accessibilityRole="checkbox"
          accessibilityLabel="I acknowledge that I am transferring to an external portal and may need to log in or register there."
          accessibilityState={{ checked: acknowledged }}
        >
          <View style={[
            styles.checkboxBox, 
            checkboxBorder,
            acknowledged && { backgroundColor: colors.primary, borderColor: colors.primary }
          ]}>
            {acknowledged && <Check color="#FFFFFF" size={14} strokeWidth={3} />}
          </View>
          <AccessibleText variant="body" style={[styles.checkboxLabel, { color: colors.text }]}>
            I understand that I will need to sign in or register on the external service portal.
          </AccessibleText>
        </TouchableOpacity>

        {/* BUTTON ACTIONS */}
        <View style={styles.actionContainer}>
          <AccessibleButton
            variant={acknowledged ? "primary" : "outline"}
            disabled={!acknowledged || loading}
            accessibilityLabel="Proceed to registration portal"
            accessibilityHint="Opens external registration page in web browser overlay"
            onPress={handleProceed}
            style={styles.proceedButton}
          >
            {loading ? "Launching Portal..." : "Proceed to Register"}
          </AccessibleButton>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.cancelLink}
            accessibilityRole="button"
            accessibilityLabel="Cancel transition and return"
          >
            <AccessibleText variant="body" style={{ color: colors.primary, fontWeight: "700" }}>
              Cancel & Return
            </AccessibleText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
  },
  warningCard: {
    borderRadius: 24,
    padding: 24,
    width: "100%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 24,
  },
  alertIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },
  warningDesc: {
    textAlign: "center",
    fontSize: 14,
    marginBottom: 16,
  },
  eventLabelBox: {
    width: "100%",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  portalInfoText: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 10,
    width: "100%",
    marginBottom: 32,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    marginTop: 2,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  actionContainer: {
    width: "100%",
    gap: 16,
  },
  proceedButton: {
    width: "100%",
    borderRadius: 16,
    height: 56,
  },
  cancelLink: {
    alignItems: "center",
    paddingVertical: 12,
  },
});
