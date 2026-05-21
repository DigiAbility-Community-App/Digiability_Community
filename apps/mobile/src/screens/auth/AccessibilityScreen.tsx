import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
    Switch,
    ActivityIndicator,
    Alert,
} from "react-native";

import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";

import { MainStackParamList } from "@navigation/MainNavigator";
import { useAuthStore } from "@store/authStore";

import {
    defaultAccessibilityPreferences,
    getAccessibilityPreferences,
    saveAccessibilityPreferences,
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

    const [emailNotif, setEmailNotif] = useState(
        defaultAccessibilityPreferences.emailNotif
    );

    const [smsNotif, setSmsNotif] = useState(
        defaultAccessibilityPreferences.smsNotif
    );

    const [loading, setLoading] = useState(false);

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
                setEmailNotif(savedPreferences.emailNotif);
                setSmsNotif(savedPreferences.smsNotif);
            } catch {
                // Optional during onboarding
            }
        };

        loadPreferences();

        return () => {
            isMounted = false;
        };
    }, [user?.id]);

    const continueToNext = () => {
        if (!user?.role) {
            navigation.replace("RoleSelection");
        } else if (!user?.profileComplete) {
            navigation.replace("Profile");
        } else {
            navigation.reset({
                index: 0,
                routes: [{ name: "Home" }],
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
            await saveAccessibilityPreferences(user.id, {
                textSize,
                highContrast,
                screenReader,
                reduceMotion,
                language: "English",
                pushNotif,
                emailNotif,
                smsNotif,
            });
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

    return (
        <SafeAreaView style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.backArrow}>←</Text>
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>
                        Preferences
                    </Text>
                </View>

                {/* Progress */}
                <View style={styles.progressWrapper}>
                    <View style={styles.activeProgress} />
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
                    <Text style={styles.heroTitle}>
                        Accessibility Preferences
                    </Text>

                    <Text style={styles.heroSubtitle}>
                        Customize the app for your needs
                    </Text>
                </View>

                {/* VISUAL */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeading}>
                        VISUAL
                    </Text>

                    {/* TEXT SIZE */}
                    <View style={styles.card}>
                        <View style={styles.cardText}>
                            <Text style={styles.cardTitle}>
                                Text Size
                            </Text>

                            <Text style={styles.cardSubtitle}>
                                Adjust font size for better readability
                            </Text>
                        </View>

                        <View style={styles.segment}>
                            {(["Small", "Medium", "Large"] as TextSize[]).map(
                                (size) => (
                                    <TouchableOpacity
                                        key={size}
                                        style={[
                                            styles.segmentBtn,
                                            textSize === size &&
                                            styles.activeSegment,
                                        ]}
                                        onPress={() => setTextSize(size)}
                                    >
                                        <Text
                                            style={
                                                textSize === size
                                                    ? styles.activeSegmentText
                                                    : styles.segmentText
                                            }
                                        >
                                            {size}
                                        </Text>
                                    </TouchableOpacity>
                                )
                            )}
                        </View>
                    </View>

                    {/* HIGH CONTRAST */}
                    <View style={styles.switchCard}>
                        <View style={styles.switchText}>
                            <Text style={styles.cardTitle}>
                                High Contrast
                            </Text>

                            <Text style={styles.cardSubtitle}>
                                Improve visibility with stronger colors
                            </Text>
                        </View>

                        <Switch
                            value={highContrast}
                            onValueChange={setHighContrast}
                            trackColor={{
                                false: "#CFC2D4",
                                true: "#6B21A8",
                            }}
                            thumbColor="#FFFFFF"
                        />
                    </View>

                    {/* SCREEN READER */}
                    <View style={styles.switchCard}>
                        <View style={styles.switchText}>
                            <Text style={styles.cardTitle}>
                                Screen Reader
                            </Text>

                            <Text style={styles.cardSubtitle}>
                                Enable spoken feedback support
                            </Text>
                        </View>

                        <Switch
                            value={screenReader}
                            onValueChange={setScreenReader}
                            trackColor={{
                                false: "#CFC2D4",
                                true: "#6B21A8",
                            }}
                            thumbColor="#FFFFFF"
                        />
                    </View>

                    {/* REDUCE MOTION */}
                    <View style={styles.switchCard}>
                        <View style={styles.switchText}>
                            <Text style={styles.cardTitle}>
                                Reduce Motion
                            </Text>

                            <Text style={styles.cardSubtitle}>
                                Minimize animations and transitions
                            </Text>
                        </View>

                        <Switch
                            value={reduceMotion}
                            onValueChange={setReduceMotion}
                            trackColor={{
                                false: "#CFC2D4",
                                true: "#6B21A8",
                            }}
                            thumbColor="#FFFFFF"
                        />
                    </View>
                </View>

                {/* AUDIO */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeading}>
                        AUDIO
                    </Text>

                    <View style={styles.switchCard}>
                        <View style={styles.switchText}>
                            <Text style={styles.cardTitle}>
                                Push Notifications
                            </Text>

                            <Text style={styles.cardSubtitle}>
                                Receive important updates instantly
                            </Text>
                        </View>

                        <Switch
                            value={pushNotif}
                            onValueChange={setPushNotif}
                            trackColor={{
                                false: "#CFC2D4",
                                true: "#6B21A8",
                            }}
                            thumbColor="#FFFFFF"
                        />
                    </View>

                    <View style={styles.switchCard}>
                        <View style={styles.switchText}>
                            <Text style={styles.cardTitle}>
                                Email Notifications
                            </Text>

                            <Text style={styles.cardSubtitle}>
                                Receive updates through email
                            </Text>
                        </View>

                        <Switch
                            value={emailNotif}
                            onValueChange={setEmailNotif}
                            trackColor={{
                                false: "#CFC2D4",
                                true: "#6B21A8",
                            }}
                            thumbColor="#FFFFFF"
                        />
                    </View>
                </View>

                {/* MOTOR */}
                <View style={styles.section}>
                    <Text style={styles.sectionHeading}>
                        MOTOR
                    </Text>

                    <View style={styles.switchCard}>
                        <View style={styles.switchText}>
                            <Text style={styles.cardTitle}>
                                SMS Notifications
                            </Text>

                            <Text style={styles.cardSubtitle}>
                                Get alerts through SMS messages
                            </Text>
                        </View>

                        <Switch
                            value={smsNotif}
                            onValueChange={setSmsNotif}
                            trackColor={{
                                false: "#CFC2D4",
                                true: "#6B21A8",
                            }}
                            thumbColor="#FFFFFF"
                        />
                    </View>

                    <View style={styles.switchCard}>
                        <View style={styles.switchText}>
                            <Text style={styles.cardTitle}>
                                Reduce Gestures
                            </Text>

                            <Text style={styles.cardSubtitle}>
                                Easier interactions with simpler taps
                            </Text>
                        </View>

                        <Switch
                            value={reduceMotion}
                            onValueChange={setReduceMotion}
                            trackColor={{
                                false: "#CFC2D4",
                                true: "#6B21A8",
                            }}
                            thumbColor="#FFFFFF"
                        />
                    </View>
                </View>
            </ScrollView>

            {/* FOOTER */}
            <View style={styles.footer}>
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={handleContinue}
                    disabled={loading}
                    style={styles.buttonContainer}
                >
                    <LinearGradient
                        colors={["#500088", "#6B21A8"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.button}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>
                                Continue
                            </Text>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
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

        fontFamily: "Inter-Bold",
    },

    heroSubtitle: {
        fontSize: 16,
        lineHeight: 24,
        color: "#4C4452",

        fontFamily: "Inter-Regular",
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

        fontFamily: "Inter-Bold",
    },

    cardSubtitle: {
        fontSize: 14,
        lineHeight: 20,
        color: "#4C4452",

        fontFamily: "Inter-Regular",
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

    button: {
        height: 56,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 999,
    },

    buttonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",

        fontFamily: "Inter-Bold",
    },
});