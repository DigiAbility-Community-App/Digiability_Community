import React from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Phone, ShieldAlert, Flag, Ban } from "lucide-react-native";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { useTheme } from "../../theme/ThemeContext";
import { SAFETY_RESOURCES, EMERGENCY_NUMBER } from "../../constants/safetyResources";

// ─────────────────────────────────────────────────────────────
// Safety Resources
//
// The Community Guidelines tell people in crisis this screen exists:
// "A fuller list is at digiability.org/safety and in the app under
//  Settings → Safety resources." It didn't, until now.
//
// Ordered emergency → crisis → support, because someone reaching this screen
// in distress should not have to read past anything to find the number that
// helps. Numbers come from constants/safetyResources, shared with the public
// web page so the two can't drift.
// ─────────────────────────────────────────────────────────────

const PRIORITY_ORDER = { emergency: 0, crisis: 1, support: 2 } as const;

export default function SafetyResourcesScreen() {
  const navigation = useNavigation<any>();
  const { colors, highContrast } = useTheme();

  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" as const }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" as const };

  const call = (name: string, phone: string, display: string) => {
    Alert.alert(`Call ${name}?`, `This will dial ${display}.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Call",
        onPress: () =>
          Linking.openURL(`tel:${phone}`).catch(() =>
            Alert.alert(
              "Couldn't place the call",
              `Please dial ${display} from your phone's keypad.`
            )
          ),
      },
    ]);
  };

  const sorted = [...SAFETY_RESOURCES].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );

  return (
    <ScreenWrapper statusBarStyle="dark">
      <AppHeader title="Safety Resources" onBackPress={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.banner, { backgroundColor: "#FFF5F5", borderColor: "#FEB2B2" }]}>
          <ShieldAlert size={22} color="#C53030" strokeWidth={2} />
          <AccessibleText variant="body" style={{ color: "#742A2A", flex: 1, lineHeight: 20 }}>
            If someone is in immediate danger, call{" "}
            <AccessibleText style={{ fontWeight: "700", color: "#C53030" }}>
              {EMERGENCY_NUMBER}
            </AccessibleText>{" "}
            first.
          </AccessibleText>
        </View>

        <AccessibleText variant="body" style={{ color: colors.subtext, lineHeight: 21 }}>
          These services are free, confidential, and independent of Digiability. You do not need an
          account with us to use any of them.
        </AccessibleText>

        {sorted.map((r) => (
          <View
            key={r.phone}
            style={[
              styles.card,
              { backgroundColor: colors.card },
              cardBorder,
              r.priority === "emergency" && { borderColor: "#FEB2B2", borderWidth: 1.5 },
            ]}
          >
            <View style={styles.cardHead}>
              <AccessibleText variant="subtitle" style={{ color: colors.text, flex: 1 }}>
                {r.name}
              </AccessibleText>
              <View
                style={[
                  styles.pill,
                  { backgroundColor: r.priority === "emergency" ? "#FED7D7" : colors.surface },
                ]}
              >
                <AccessibleText
                  variant="caption"
                  style={{ color: r.priority === "emergency" ? "#C53030" : colors.subtext }}
                >
                  {r.availability}
                </AccessibleText>
              </View>
            </View>

            <AccessibleText variant="body" style={{ color: colors.subtext, lineHeight: 20 }}>
              {r.description}
            </AccessibleText>

            {!!r.languages && (
              <AccessibleText variant="caption" style={{ color: colors.subtext, marginTop: 4 }}>
                {r.languages}
              </AccessibleText>
            )}

            <TouchableOpacity
              onPress={() => call(r.name, r.phone, r.display)}
              style={[
                styles.callBtn,
                { backgroundColor: r.priority === "emergency" ? "#E53E3E" : colors.primary },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Call ${r.name} on ${r.display}`}
              accessibilityHint="Opens your phone app to place the call"
            >
              <Phone size={16} color="#FFFFFF" strokeWidth={2.2} />
              <AccessibleText variant="button" style={{ color: "#FFFFFF" }}>
                Call {r.display}
              </AccessibleText>
            </TouchableOpacity>
          </View>
        ))}

        {/* Keeping people safe on Digiability itself, not just off it. */}
        <View style={[styles.card, { backgroundColor: colors.card }, cardBorder]}>
          <AccessibleText variant="subtitle" style={{ color: colors.text }}>
            Staying safe on Digiability
          </AccessibleText>

          <View style={styles.tipRow}>
            <Flag size={17} color={colors.primary} strokeWidth={2} />
            <AccessibleText variant="body" style={{ color: colors.subtext, flex: 1, lineHeight: 20 }}>
              <AccessibleText style={{ fontWeight: "700", color: colors.text }}>Report </AccessibleText>
              anything that breaks our Community Guidelines. Every post, comment, profile and
              message has a Report option, and you'll get a reference number.
            </AccessibleText>
          </View>

          <View style={styles.tipRow}>
            <Ban size={17} color={colors.primary} strokeWidth={2} />
            <AccessibleText variant="body" style={{ color: colors.subtext, flex: 1, lineHeight: 20 }}>
              <AccessibleText style={{ fontWeight: "700", color: colors.text }}>Block </AccessibleText>
              anyone you'd rather not hear from. Neither of you will be able to message the other,
              they aren't told, and you can undo it any time.
            </AccessibleText>
          </View>

          <View style={styles.tipRow}>
            <ShieldAlert size={17} color={colors.primary} strokeWidth={2} />
            <AccessibleText variant="body" style={{ color: colors.subtext, flex: 1, lineHeight: 20 }}>
              <AccessibleText style={{ fontWeight: "700", color: colors.text }}>
                Child safety concerns{" "}
              </AccessibleText>
              go to a priority queue. Use the "Child safety" reason when reporting, and contact
              emergency services first if a child is at risk.
            </AccessibleText>
          </View>
        </View>

        <AccessibleText
          variant="caption"
          style={{ color: colors.subtext, textAlign: "center", lineHeight: 18 }}
        >
          Nothing on Digiability is medical advice. Peer experience is not a substitute for a
          qualified professional.
        </AccessibleText>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 14 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  card: { borderRadius: 16, padding: 16, gap: 8 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: 12,
    marginTop: 6,
  },
  tipRow: { flexDirection: "row", gap: 10, marginTop: 6 },
});
