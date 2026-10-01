import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Switch, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { confirmDeleteAccount } from "../../utils/accountDeletion";
import { DeleteAccountModal } from "../../components/account/DeleteAccountModal";
import {
    ConsentRecord,
    ConsentType,
    getConsents,
    updateConsent,
    exportMyData,
} from "@services/privacyService";

const OPTIONAL_CONSENTS: { type: ConsentType; title: string; description: string }[] = [
    {
        type: "PUSH_NOTIFICATIONS",
        title: "Push Notifications",
        description: "Allow us to send you push alerts for messages and activity.",
    },
    {
        type: "MARKETING",
        title: "Marketing",
        description: "Allow us to send newsletters and promotional emails.",
    },
];

export default function PrivacyDataScreen() {
    const { colors, highContrast } = useTheme();

    const [loading, setLoading] = useState(true);
    const [consents, setConsents] = useState<ConsentRecord[]>([]);
    const [consentBusy, setConsentBusy] = useState<Partial<Record<ConsentType, boolean>>>({});
    const [exporting, setExporting] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const cardBorder = highContrast
        ? { borderWidth: 2, borderColor: "#000000" }
        : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };

    const loadConsents = useCallback(async () => {
        try {
            const data = await getConsents();
            setConsents(data);
        } catch {
            Alert.alert("Error", "Could not load your privacy settings. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadConsents();
    }, [loadConsents]);

    const navigation = useNavigation<any>();
    const dataProcessingRecord = consents.find((c) => c.consentType === "DATA_PROCESSING");

    const isAccepted = (type: ConsentType) =>
        consents.find((c) => c.consentType === type)?.accepted ?? false;

    const handleToggle = async (type: ConsentType, value: boolean) => {
        setConsents((prev) =>
            prev.map((c) => (c.consentType === type ? { ...c, accepted: value } : c))
        );
        setConsentBusy((prev) => ({ ...prev, [type]: true }));
        try {
            await updateConsent(type, value);
        } catch {
            // Revert on failure
            setConsents((prev) =>
                prev.map((c) => (c.consentType === type ? { ...c, accepted: !value } : c))
            );
            Alert.alert("Error", "Could not update this preference. Please try again.");
        } finally {
            setConsentBusy((prev) => ({ ...prev, [type]: false }));
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const bundle = await exportMyData();
            const json = JSON.stringify(bundle, null, 2);
            const file = new File(Paths.document, `digiability-data-export-${Date.now()}.json`);
            file.write(json);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(file.uri, {
                    mimeType: "application/json",
                    dialogTitle: "Export your Digiability data",
                });
            } else {
                Alert.alert("Export ready", `Your data was saved to ${file.uri}`);
            }
        } catch {
            Alert.alert("Error", "Could not export your data. Please try again.");
        } finally {
            setExporting(false);
        }
    };

    const handleDeleteAccount = () => {
        // Two warnings first, then the password modal — the server requires
        // re-authentication for this irreversible action.
        confirmDeleteAccount({ onConfirmed: () => setShowDeleteModal(true) });
    };

    return (
        <ScreenWrapper>
            <AppHeader title="My data & privacy" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* ── MY DATA (DPDP §11 access, §12 correction; erasure below) ── */}
                <AccessibleText variant="overline" style={{ color: colors.subtext, marginBottom: 8 }} accessibilityRole="header">
                    MY DATA
                </AccessibleText>

                <View style={[styles.card, { backgroundColor: colors.card }, cardBorder]}>
                    <AccessibleText variant="body" style={{ color: colors.subtext, marginBottom: 12 }}>
                        See everything we hold about you, download a copy, or correct it. Messages and
                        forum posts live on separate services and aren't included — contact support if
                        you need those too.
                    </AccessibleText>
                    <AccessibleButton
                        accessibilityLabel="View my data"
                        accessibilityHint="Shows the personal data we hold about you"
                        onPress={() => navigation.navigate("MyData")}
                    >
                        View my data
                    </AccessibleButton>
                    <AccessibleButton
                        variant="outline"
                        accessibilityLabel="Download a copy of my data"
                        accessibilityHint="Saves your personal data as a file you can keep or share"
                        disabled={exporting}
                        onPress={handleExport}
                        style={styles.stackedBtn}
                    >
                        {exporting ? "Preparing download…" : "Download a copy"}
                    </AccessibleButton>
                    <AccessibleButton
                        variant="outline"
                        accessibilityLabel="Correct my details"
                        accessibilityHint="Opens your profile so you can fix anything that's wrong"
                        onPress={() => navigation.navigate("EditProfile")}
                        style={styles.stackedBtn}
                    >
                        Correct my details
                    </AccessibleButton>
                    <AccessibleButton
                        variant="secondary"
                        accessibilityLabel="Read how we use your data"
                        onPress={() => navigation.navigate("Legal", { doc: "data-processing-notice" })}
                        style={styles.stackedBtn}
                    >
                        How we use your data
                    </AccessibleButton>
                </View>

                {/* ── YOUR CONSENTS ── */}
                <AccessibleText variant="overline" style={{ color: colors.subtext, marginTop: 24, marginBottom: 8 }}>
                    YOUR CONSENTS
                </AccessibleText>

                <View style={[styles.card, { backgroundColor: colors.card }, cardBorder]}>
                    <View style={styles.switchRow}>
                        <View style={styles.switchText}>
                            <AccessibleText variant="title" style={{ color: colors.text, fontSize: 16 }}>
                                Data Processing 🔒
                            </AccessibleText>
                            <AccessibleText variant="body" style={{ color: colors.subtext, marginTop: 4 }}>
                                Required to operate your account. To stop this, delete your account below.
                            </AccessibleText>
                            {dataProcessingRecord?.acceptedAt ? (
                                <AccessibleText variant="caption" style={{ color: colors.subtext, marginTop: 4 }}>
                                    You agreed on {new Date(dataProcessingRecord.acceptedAt).toLocaleDateString()} (notice version {dataProcessingRecord.version}).
                                </AccessibleText>
                            ) : null}
                        </View>
                        <AccessibleText variant="caption" style={{ color: colors.subtext }}>
                            Required
                        </AccessibleText>
                    </View>
                </View>

                {OPTIONAL_CONSENTS.map(({ type, title, description }) => (
                    <View key={type} style={[styles.card, { backgroundColor: colors.card }, cardBorder]}>
                        <View style={styles.switchRow}>
                            <View style={styles.switchText}>
                                <AccessibleText variant="title" style={{ color: colors.text, fontSize: 16 }}>
                                    {title}
                                </AccessibleText>
                                <AccessibleText variant="body" style={{ color: colors.subtext, marginTop: 4 }}>
                                    {description}
                                </AccessibleText>
                            </View>
                            <Switch
                                value={isAccepted(type)}
                                onValueChange={(value) => handleToggle(type, value)}
                                disabled={loading || !!consentBusy[type]}
                                trackColor={{
                                    false: highContrast ? "#7E7383" : "#CFC2D4",
                                    true: highContrast ? "#000000" : colors.primary,
                                }}
                                thumbColor="#FFFFFF"
                                accessibilityLabel={title}
                                accessibilityHint={`Toggles consent for ${title.toLowerCase()}`}
                            />
                        </View>
                    </View>
                ))}

                {/* ── DANGER ZONE ── */}
                <AccessibleText variant="overline" style={{ color: colors.subtext, marginTop: 24, marginBottom: 8 }}>
                    DANGER ZONE
                </AccessibleText>

                <View style={[styles.card, { backgroundColor: colors.card }, cardBorder]}>
                    <AccessibleText variant="body" style={{ color: colors.subtext, marginBottom: 12 }}>
                        Deleting your account erases your profile, preferences, personal details and
                        message content immediately. Your forum posts remain but are shown as written
                        by "Deleted User". A minimal registration record is kept for 180 days because
                        Indian law requires it, and is then destroyed.
                    </AccessibleText>
                    <AccessibleButton
                        variant="danger"
                        accessibilityLabel="Delete my account"
                        accessibilityHint="Deactivates and anonymises your account and personal data"
                        onPress={handleDeleteAccount}
                    >
                        Delete my account
                    </AccessibleButton>
                </View>
            </ScrollView>

            <DeleteAccountModal
                visible={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
            />
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    switchRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    switchText: {
        flex: 1,
        paddingRight: 16,
    },
    stackedBtn: {
        marginTop: 10,
    },
});
