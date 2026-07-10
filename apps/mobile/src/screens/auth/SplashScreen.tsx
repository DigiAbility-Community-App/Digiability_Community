import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '@navigation/AuthNavigator';
import { useAuthStore } from '@store/authStore';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Splash'>;
};

const { width, height } = Dimensions.get('window');

const SplashScreen = ({ navigation }: Props) => {
  const user = useAuthStore((s) => s.user);
  const pendingBanInfo = useAuthStore((s) => s.pendingBanInfo);
  const clearPendingBanInfo = useAuthStore((s) => s.clearPendingBanInfo);

  const dot1Anim = useRef(new Animated.Value(1)).current;
  const dot2Anim = useRef(new Animated.Value(0.6)).current;
  const dot3Anim = useRef(new Animated.Value(0.3)).current;

  // Loading animation
  useEffect(() => {
    const animateDot = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateDot(dot1Anim, 0);
    animateDot(dot2Anim, 200);
    animateDot(dot3Anim, 400);
  }, []);

  // Navigation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (pendingBanInfo) {
        const info = pendingBanInfo;
        clearPendingBanInfo();
        navigation.replace('AccountSuspended', info);
      } else {
        navigation.replace('Welcome');
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [navigation, pendingBanInfo, clearPendingBanInfo]);

  return (
    <LinearGradient
      colors={['#F9F8FF', '#E9D5FF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>

        {/* Decorative Background Circles */}
        <View style={styles.topCircle} />
        <View style={styles.bottomCircle} />

        {/* Glass Overlay */}
        <View style={styles.glassOverlay} />

        {/* Main Content */}
        <View style={styles.contentContainer}>

          {/* Logo Card */}
          <View style={styles.logoOuterContainer}>
            <View style={styles.logoShadow} />

            <LinearGradient
              colors={['#500088', '#6B21A8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoInnerContainer}
            >
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </LinearGradient>
          </View>

          {/* Title */}
          <Text style={styles.title}>DigiAbility</Text>

          {/* Subtitle */}
          <Text style={styles.tagline}>
            Empowering abilities, connecting hearts
          </Text>
        </View>

        {/* Loading Dots */}
        <View style={styles.loadingContainer}>
          <Animated.View
            style={[styles.loadingDot, { opacity: dot1Anim }]}
          />
          <Animated.View
            style={[styles.loadingDot, { opacity: dot2Anim }]}
          />
          <Animated.View
            style={[styles.loadingDot, { opacity: dot3Anim }]}
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },

  // Background Decorative Shapes
  topCircle: {
    position: 'absolute',
    top: -120,
    right: -120,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  bottomCircle: {
    position: 'absolute',
    bottom: -140,
    left: -140,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(124,58,237,0.08)',
  },

  glassOverlay: {
    position: 'absolute',
    width: width,
    height: height,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },

  // Main Content
  contentContainer: {
    width: '100%',
    maxWidth: 385,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  // Logo Card
  logoOuterContainer: {
    width: 176,
    height: 162,
    borderRadius: 40,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginBottom: 34,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  logoShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 40,
    shadowColor: '#500088',
    shadowOffset: {
      width: 0,
      height: 20,
    },
    shadowOpacity: 0.08,
    shadowRadius: 25,
    elevation: 10,
  },

  logoInnerContainer: {
    width: 144,
    height: 130,
    borderRadius: 32,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  logo: {
    width: 80,
    height: 120,
  },

  // Typography
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#2D1B5E',
    letterSpacing: -0.9,
    lineHeight: 54,
    textAlign: 'center',
    marginBottom: 8,

    // If Plus Jakarta Sans installed
    fontFamily: 'PlusJakartaSans-Bold',
  },

  tagline: {
    fontSize: 16,
    fontWeight: '400',
    color: '#6B7280',
    lineHeight: 26,
    textAlign: 'center',
    maxWidth: 310,

    // If Plus Jakarta Sans installed
    fontFamily: 'PlusJakartaSans-Regular',
  },

  // Loading
  loadingContainer: {
    position: 'absolute',
    bottom: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7C3AED',
    marginHorizontal: 6,
  },
});