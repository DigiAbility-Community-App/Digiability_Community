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
import { MainStackParamList } from "@navigation/MainNavigator";
import { useAuthStore } from "@store/authStore";
import {
    defaultAccessibilityPreferences,
    getAccessibilityPreferences,
    saveAccessibilityPreferences,
    TextSize,
} from "@services/storageService";

type Props = {
    navigation: NativeStackNavigationProp<MainStackParamList, "Accessibility">;
};

const AccessibilityScreen = ({ navigation }: Props) => {
    const user = useAuthStore((state) => state.user);
    const [textSize, setTextSize] = useState<TextSize>(defaultAccessibilityPreferences.textSize);

    const [highContrast, setHighContrast] = useState(defaultAccessibilityPreferences.highContrast);
    const [screenReader, setScreenReader] = useState(defaultAccessibilityPreferences.screenReader);
    const [reduceMotion, setReduceMotion] = useState(defaultAccessibilityPreferences.reduceMotion);

    const [pushNotif, setPushNotif] = useState(defaultAccessibilityPreferences.pushNotif);
    const [emailNotif, setEmailNotif] = useState(defaultAccessibilityPreferences.emailNotif);
    const [smsNotif, setSmsNotif] = useState(defaultAccessibilityPreferences.smsNotif);
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        let isMounted = true;

        const loadPreferences = async () => {
            if (!user?.id) return;

            try {
                const savedPreferences = await getAccessibilityPreferences(user.id);
                if (!savedPreferences || !isMounted) return;

                setTextSize(savedPreferences.textSize);
                setHighContrast(savedPreferences.highContrast);
                setScreenReader(savedPreferences.screenReader);
                setReduceMotion(savedPreferences.reduceMotion);
                setPushNotif(savedPreferences.pushNotif);
                setEmailNotif(savedPreferences.emailNotif);
                setSmsNotif(savedPreferences.smsNotif);
            } catch {
                // Accessibility preferences are optional during onboarding.
            }
        };

        loadPreferences();

        return () => {
            isMounted = false;
        };
    }, [user?.id]);

    const continueToHome = () => {
        navigation.reset({
            index: 0,
            routes: [{ name: "Home" }],
        });
    };

    const handleContinue = async () => {
        if (!user?.id) {
            continueToHome();
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
            continueToHome();
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
            >
                {/* HEADER */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.back}>←</Text>
                    </TouchableOpacity>
                </View>

                {/* PROGRESS */}
                <View style={styles.progress}>
                    <View style={styles.inactiveDot} />
                    <View style={styles.activeBar} />
                    <View style={styles.inactiveDot} />
                </View>

                {/* TITLE */}
                <Text style={styles.title}>Make the app work for you</Text>
                <Text style={styles.subtitle}>
                    You can change these anytime in Settings
                </Text>

                {/* TEXT SIZE */}
                <Text style={styles.sectionTitle}>Text Size</Text>
                <View style={styles.segment}>
                    {(["Small", "Medium", "Large"] as TextSize[]).map((size) => (
                        <TouchableOpacity
                            key={size}
                            style={[
                                styles.segmentBtn,
                                textSize === size && styles.activeSegment,
                            ]}
                            onPress={() => setTextSize(size)}
                        >
                            <Text
                                style={
                                    textSize === size
                                        ? styles.activeText
                                        : styles.inactiveText
                                }
                            >
                                {size}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* DISPLAY */}
                <Text style={styles.sectionTitle}>Display</Text>
                <View style={styles.row}>
                    <Text>High Contrast</Text>
                    <Switch value={highContrast} onValueChange={setHighContrast} />
                </View>

                <View style={styles.row}>
                    <Text>Screen Reader</Text>
                    <Switch value={screenReader} onValueChange={setScreenReader} />
                </View>

                <View style={styles.row}>
                    <Text>Reduce Motion</Text>
                    <Switch value={reduceMotion} onValueChange={setReduceMotion} />
                </View>

                {/* LANGUAGE */}
                <Text style={styles.sectionTitle}>Language</Text>
                <View style={styles.dropdown}>
                    <Text>English</Text>
                </View>

                {/* NOTIFICATIONS */}
                <Text style={styles.sectionTitle}>Notifications</Text>
                <View style={styles.row}>
                    <Text>Push Notifications</Text>
                    <Switch value={pushNotif} onValueChange={setPushNotif} />
                </View>

                <View style={styles.row}>
                    <Text>Email</Text>
                    <Switch value={emailNotif} onValueChange={setEmailNotif} />
                </View>

                <View style={styles.row}>
                    <Text>SMS</Text>
                    <Switch value={smsNotif} onValueChange={setSmsNotif} />
                </View>

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleContinue}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Continue</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

export default AccessibilityScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F6F6F6",
    },

    content: {
        padding: 16,
        paddingBottom: 32,
    },

    header: {
        height: 50,
        justifyContent: "center",
    },

    back: {
        fontSize: 20,
    },

    progress: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginVertical: 10,
        gap: 6,
    },

    inactiveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: "#aaa",
    },

    activeBar: {
        width: 24,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#8A38F5",
    },

    title: {
        fontSize: 22,
        fontWeight: "bold",
        marginTop: 10,
    },

    subtitle: {
        color: "#666",
        marginBottom: 20,
    },

    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        marginTop: 20,
    },

    segment: {
        flexDirection: "row",
        backgroundColor: "#fff",
        borderRadius: 10,
        padding: 4,
        marginTop: 10,
    },

    segmentBtn: {
        flex: 1,
        padding: 10,
        alignItems: "center",
        borderRadius: 8,
    },

    activeSegment: {
        backgroundColor: "#8A38F5",
    },

    activeText: {
        color: "#fff",
        fontWeight: "bold",
    },

    inactiveText: {
        color: "#666",
    },

    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 15,
        backgroundColor: "#fff",
        padding: 12,
        borderRadius: 10,
    },

    dropdown: {
        backgroundColor: "#fff",
        padding: 15,
        borderRadius: 10,
        marginTop: 10,
    },

    button: {
        marginTop: 28,
        backgroundColor: "#8A38F5",
        padding: 16,
        borderRadius: 12,
        alignItems: "center",
        marginBottom: 8,
    },

    buttonDisabled: {
        opacity: 0.7,
    },

    buttonText: {
        color: "#fff",
        fontWeight: "bold",
    },
});
