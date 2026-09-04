import React, { useState, useCallback, useRef } from "react";
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    ActivityIndicator,
    Alert,
    BackHandler,
} from "react-native";

import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { logout } from "@services/authService";
import { removeDeviceToken } from "@services/notificationService";
import SafeScreen from "../../components/layout/SafeScreen";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MainStackParamList } from "@navigation/MainNavigator";
import { useAuthStore } from "@store/authStore";
import { useAccessibilityStore } from "@store/accessibilityStore";
import { getFontScale, getThemeColors } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";

import {
    defaultAccessibilityPreferences,
    getAccessibilityPreferences,
    TextSize,
} from "@services/storageService";

type Props = {
    navigation: NativeStackNavigationProp<
        MainStackParamList,
        "Accessibility"
    >;
};

const AccessibilityScreen = ({ navigation }: Props) => {
    const user = useAuthStore((state) => state.user);
    const updatePreferences = useAccessibilityStore((state) => state.updatePreferences);
    const insets = useSafeAreaInsets();

    const [textSize, setTextSize] = useState<TextSize>(
        defaultAccessibilityPreferences.textSize
    );

    const [highContrast, setHighContrast] = useState(
        defaultAccessibilityPreferences.highContrast
    );

    const [screenReader, setScreenReader] = useState(
        defaultAccessibilityPreferences.screenReader
    );

    const [reduceMotion, setReduceMotion] = useState(
        defaultAccessibilityPreferences.reduceMotion
    );

    const [pushNotif, setPushNotif] = useState(
        defaultAccessibilityPreferences.pushNotif
    );

    const [loading, setLoading] = useState(false);

    // Tracks the last-persisted pushNotif value so handleContinue can tell
    // whether the user is turning it off (and should unregister the device
    // token) versus leaving it unchanged.
    const lastSavedPushNotifRef = useRef(defaultAccessibilityPreferences.pushNotif);

    React.useEffect(() => {
        let isMounted = true;

        const loadPreferences = async () => {
            if (!user?.id) return;

            try {
                const savedPreferences =
                    await getAccessibilityPreferences(user.id);

                if (!savedPreferences || !isMounted) return;

                setTextSize(savedPreferences.textSize);
                setHighContrast(savedPreferences.highContrast);
                setScreenReader(savedPreferences.screenReader);
                setReduceMotion(savedPreferences.reduceMotion);
                setPushNotif(savedPreferences.pushNotif);
                lastSavedPushNotifRef.current = savedPreferences.pushNotif;
            } catch {
                // Optional during onboarding
            }
        };

        loadPreferences();

        return () => {
            isMounted = false;
        };
    }, [user?.id]);

    const handleBack = useCallback(() => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            Alert.alert(
                "Exit Signup?",
                "Are you sure you want to go back to the signup/login screen? This will sign you out.",
                [
                    {
                        text: "Cancel",
                        style: "cancel",
                    },
                    {
                        text: "Exit",
                        style: "destructive",
                        onPress: async () => {
                            try {
                                await logout();
                            } catch (err) {
                                Alert.alert("Error", "Failed to log out");
                            }
                        },
                    },
                ]
            );
        }
    }, [navigation]);

    useFocusEffect(
        React.useCallback(() => {
            const onBackPress = () => {
                handleBack();
                return true;
            };

            const subscription = BackHandler.addEventListener(
                "hardwareBackPress",
                onBackPress
            );

            return () => subscription.remove();
        }, [handleBack])
    );

    const continueToNext = () => {
        if (!user?.roles || user.roles.length === 0) {
            navigation.navigate("RoleSelection");
        } else if (!user?.profileComplete) {
            navigation.navigate("Profile");
        } else {
            navigation.reset({
                index: 0,
                routes: [{ name: "MainTabs" }],
            });
        }
    };

    const handleContinue = async () => {
        if (!user?.id) {
            continueToNext();
            return;
        }

        setLoading(true);

        try {
            await updatePreferences(user.id, {
                textSize,
                highContrast,
                screenReader,
                reduceMotion,
                pushNotif,
            });

            if (lastSavedPushNotifRef.current && !pushNotif) {
                // Unregister immediately rather than waiting for next boot.
                removeDeviceToken().catch(() => {
                    // Best-effort — device token cleanup shouldn't block onboarding.
                });
            }
            lastSavedPushNotifRef.current = pushNotif;
        } catch {
            Alert.alert(
                "Preferences skipped",
                "Accessibility settings were not saved yet, but you can continue and update them later."
            );
        } finally {
            setLoading(false);
            continueToNext();
        }
    };

    // Same formulas ThemeContext.tsx uses for the live app theme — reused
    // here (not duplicated) so this screen's preview never drifts from what
    // the rest of the app actually renders once these preferences are saved.
    const fs = getFontScale(textSize);
    const screenColors = getThemeColors(highContrast);

    const cardBorder = {
        borderWidth: highContrast ? 2 : 1,
        borderColor: highContrast ? "#000000" : "rgba(0,0,0,0.05)",
    };

    return (
        <SafeScreen bottom={false} statusBarStyle="dark" style={[styles.container, { backgroundColor: screenColors.background }]}>
            {/* HEADER */}
            <View style={[styles.header, { backgroundColor: highContrast ? "#000000" : "rgba(249,248,255,0.9)" }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleBack}
                        accessibilityRole="button"
                        accessibilityLabel="Go Back"
                        accessibilityHint="Returns to the previous screen"
                    >
                        <AccessibleText variant="title" style={{ color: highContrast ? "#FFFFFF" : "#581C87" }}>←</AccessibleText>
                    </TouchableOpacity>

                    <AccessibleText variant="title" style={{ color: highContrast ? "#FFFFFF" : "#581C87" }}>
                        Preferences
                    </AccessibleText>
                </View>

                {/* Progress */}
                <View style={styles.progressWrapper}>
                    <View style={[styles.activeProgress, { backgroundColor: screenColors.primary }]} />
                    <View style={styles.progressDot} />
                    <View style={styles.progressDot} />
                    <View style={styles.progressDot} />
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
            >
                {/* HERO */}
                <View style={styles.heroSection}>
                    <AccessibleText variant="heroTitle" style={{ color: screenColors.text }}>
                        Accessibility Preferences
                    </AccessibleText>

                    <AccessibleText variant="subtitle" style={{ color: screenColors.subtext, marginTop: 8 }}>
                        Customize the app for your needs
                    </AccessibleText>
                </View>

                {/* VISUAL */}
                <View style={styles.section}>
                    <AccessibleText variant="overline" style={{ color: highContrast ? "#000000" : "#6B21A8", marginBottom: 16 }}>
                        VISUAL
                    </AccessibleText>

                    {/* TEXT SIZE */}
                    <View style={[styles.card, { backgroundColor: screenColors.card }, cardBorder]}>
                        <View style={styles.cardText}>
                            <AccessibleText variant="title" style={{ color: screenColors.text, fontSize: fs(16) }}>
                                Text Size
                            </AccessibleText>

                            <AccessibleText variant="body" style={{ color: screenColors.subtext, fontSize: fs(14), marginTop: 4 }}>
                                Adjust font size for better readability
                            </AccessibleText>
                        </View>

                        <View style={[styles.segment, { backgroundColor: screenColors.surface }]}>
                            {(["Small", "Medium", "Large"] as TextSize[]).map(
                                (size) => (
                                    <TouchableOpacity
                                        key={size}
                                        style={[
                                            styles.segmentBtn,
                                            textSize === size &&
                                            (highContrast ? { backgroundColor: "#000000", borderWidth: 2, borderColor: "#FFFFFF" } : styles.activeSegment),
                                        ]}
                                        onPress={() => setTextSize(size)}
                                        accessibilityRole="radio"
                                        accessibilityState={{ checked: textSize === size }}
                                        accessibilityLabel={`${size} font size`}
                                        accessibilityHint={`Double tap to set font scale to ${size}`}
                                    >
                                        <AccessibleText
                                            style={{
                                                color: textSize === size ? "#FFFFFF" : screenColors.text,
                                                fontSize: fs(14),
                                                fontWeight: '700'
                                            }}
                                        >
                                            {size}
                                        </AccessibleText>
                                    </TouchableOpacity>
                                )
                            )}
                        </View>
                    </View>

                    {/* HIGH CONTRAST */}
                    <View style={[styles.switchCard, { backgroundColor: screenColors.card }, cardBorder]}>
                        <View style={styles.switchText}>
                            <AccessibleText variant="title" style={{ color: screenColors.text, fontSize: fs(16) }}>
                                High Contrast
                            </AccessibleText>

                            <AccessibleText variant="body" style={{ color: screenColors.subtext, fontSize: fs(14), marginTop: 4 }}>
                                Improve visibility with stronger colors
                            </AccessibleText>
                        </View>

                        <Switch
                            value={highContrast}
                            onValueChange={setHighContrast}
                            trackColor={{
                                false: highContrast ? "#7E7383" : "#CFC2D4",
                                true: highContrast ? "#000000" : "#6B21A8",
                            }}
                            thumbColor="#FFFFFF"
                            accessibilityLabel="High Contrast"
                            accessibilityHint="Toggles high contrast black and white color themes"
                        />
                    </View>

                    {/* SCREEN READER */}
                    <View style={[styles.switchCard, { backgroundColor: screenColors.card }, cardBorder]}>
                        <View style={styles.switchText}>
                            <AccessibleText variant="title" style={{ color: screenColors.text, fontSize: fs(16) }}>
                                Screen Reader
                            </AccessibleText>

                            <AccessibleText variant="body" style={{ color: screenColors.subtext, fontSize: fs(14), marginTop: 4 }}>
                                Enable spoken feedback support
                            </AccessibleText>
                        </View>

                        <Switch
                            value={screenReader}
                            onValueChange={setScreenReader}
                            trackColor={{
                                false: highContrast ? "#7E7383" : "#CFC2D4",
                                true: highContrast ? "#000000" : "#6B21A8",
                            }}
                            thumbColor="#FFFFFF"
                            accessibilityLabel="Screen Reader Spoken Feedback"
                            accessibilityHint="Toggles accessibility voice navigation compatibility"
                        />
                    </View>

                    {/* REDUCE MOTION */}
                    <View style={[styles.switchCard, { backgroundColor: screenColors.card }, cardBorder]}>
                        <View style={styles.switchText}>
                            <AccessibleText variant="title" style={{ color: screenColors.text, fontSize: fs(16) }}>
                                Reduce Motion
                            </AccessibleText>

                            <AccessibleText variant="body" style={{ color: screenColors.subtext, fontSize: fs(14), marginTop: 4 }}>
                                Minimize animations and transitions
                            </AccessibleText>
                        </View>

                        <Switch
                            value={reduceMotion}
                            onValueChange={setReduceMotion}
                            trackColor={{
                                false: highContrast ? "#7E7383" : "#CFC2D4",
                                true: highContrast ? "#000000" : "#6B21A8",
                            }}
                            thumbColor="#FFFFFF"
                            accessibilityLabel="Reduce Motion"
                            accessibilityHint="Disables dynamic screen transition animations"
                        />
                    </View>
                </View>

                {/* NOTIFICATIONS */}
                <View style={styles.section}>
                    <AccessibleText variant="overline" style={{ color: highContrast ? "#000000" : "#6B21A8", marginBottom: 16 }}>
                        NOTIFICATIONS
                    </AccessibleText>

                    <View style={[styles.switchCard, { backgroundColor: screenColors.card }, cardBorder]}>
                        <View style={styles.switchText}>
                            <AccessibleText variant="title" style={{ color: screenColors.text, fontSize: fs(16) }}>
                                Push Notifications
                            </AccessibleText>

                            <AccessibleText variant="body" style={{ color: screenColors.subtext, fontSize: fs(14), marginTop: 4 }}>
                                Receive important updates instantly
                            </AccessibleText>
                        </View>

                        <Switch
                            value={pushNotif}
                            onValueChange={setPushNotif}
                            trackColor={{
                                false: highContrast ? "#7E7383" : "#CFC2D4",
                                true: highContrast ? "#000000" : "#6B21A8",
                            }}
                            thumbColor="#FFFFFF"
                            accessibilityLabel="Push Notifications"
                            accessibilityHint="Toggles receiving instant push notifications"
                        />
                    </View>
                </View>
            </ScrollView>

            {/* FOOTER */}
            <View style={[styles.footer, { backgroundColor: screenColors.background, paddingBottom: Math.max(insets.bottom, 24) }]}>
                <AccessibleButton
                    accessibilityLabel="Continue"
                    accessibilityHint="Saves preferences and proceeds to the next screen"
                    onPress={handleContinue}
                    disabled={loading}
                    style={highContrast ? { backgroundColor: '#000000' } : undefined}
                >
                    {loading ? <ActivityIndicator color="#fff" /> : "Continue"}
                </AccessibleButton>
            </View>
        </SafeScreen>
    );
};

export default AccessibilityScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F9F8FF",
    },

    // HEADER
    header: {
        height: 64,
        paddingHorizontal: 24,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "rgba(249,248,255,0.9)",
    },

    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
    },

    backButton: {
        width: 32,
        height: 32,
        borderRadius: 999,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },

    backArrow: {
        fontSize: 20,
        color: "#581C87",
        fontWeight: "700",
    },

    headerTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#581C87",
    },

    progressWrapper: {
        flexDirection: "row",
        gap: 8,
    },

    activeProgress: {
        width: 24,
        height: 8,
        borderRadius: 999,
        backgroundColor: "#6B21A8",
    },

    progressDot: {
        width: 8,
        height: 8,
        borderRadius: 999,
        backgroundColor: "rgba(207,194,212,0.4)",
    },

    // CONTENT
    content: {
        paddingHorizontal: 24,
        paddingTop: 30,
        paddingBottom: 180,
    },

    heroSection: {
        marginBottom: 40,
    },

    heroTitle: {
        fontSize: 30,
        lineHeight: 38,
        fontWeight: "700",
        color: "#1A1B20",
        marginBottom: 8,
    },

    heroSubtitle: {
        fontSize: 16,
        lineHeight: 24,
        color: "#4C4452",
    },

    // SECTION
    section: {
        marginBottom: 40,
    },

    sectionHeading: {
        fontSize: 12,
        letterSpacing: 1.2,
        fontWeight: "700",
        color: "#6B21A8",
        marginBottom: 16,
    },

    // CARD
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,

        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.05)",

        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },

    cardText: {
        marginBottom: 16,
    },

    cardTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1A1B20",
        marginBottom: 4,
    },

    cardSubtitle: {
        fontSize: 14,
        lineHeight: 20,
        color: "#4C4452",
    },

    // SEGMENT
    segment: {
        flexDirection: "row",
        backgroundColor: "#F4F3FA",
        borderRadius: 14,
        padding: 4,
    },

    segmentBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: "center",
    },

    activeSegment: {
        backgroundColor: "#6B21A8",
    },

    segmentText: {
        color: "#4C4452",
        fontWeight: "600",
    },

    activeSegmentText: {
        color: "#FFFFFF",
        fontWeight: "700",
    },

    // SWITCH CARD
    switchCard: {
        height: 100,
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,

        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",

        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.05)",

        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },

    switchText: {
        flex: 1,
        paddingRight: 16,
    },

    // FOOTER
    footer: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,

        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 24,

        backgroundColor: "#F9F8FF",
    },

    buttonContainer: {
        borderRadius: 999,
        overflow: "hidden",

        shadowColor: "#500088",
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },

    buttonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
    },
});