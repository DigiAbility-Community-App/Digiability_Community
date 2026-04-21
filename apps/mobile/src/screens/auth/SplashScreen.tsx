import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '@navigation/AuthNavigator';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Splash'>;
};

const SplashScreen = ({ navigation }: Props) => {
  const dot1Anim = useRef(new Animated.Value(0.3)).current;
  const dot2Anim = useRef(new Animated.Value(0.3)).current;
  const dot3Anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Navigate to Welcome Screen after 3 seconds
    const timer = setTimeout(() => {
      navigation.replace('Welcome');
    }, 3000);

    // Animate loading dots
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

    return () => clearTimeout(timer);
  }, [navigation, dot1Anim, dot2Anim, dot3Anim]);

  return (
    <LinearGradient
      colors={['#F9F8FF', '#E9D5FF']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>

        {/* Decorative elements - using absolute positioning to simulate blur/glow */}
        <View style={styles.decorTopRight} />
        <View style={styles.decorBottomLeft} />

        {/* Center Content */}
        <View style={styles.centerContent}>
          {/* Logo Container */}
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={['#500088', '#6b21a8']}
              style={styles.innerLogoContainer}
            >
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </LinearGradient>
          </View>

          {/* Brand Identity */}
          <Text style={styles.title}>DigiAbility</Text>

          {/* Tagline */}
          <Text style={styles.tagline}>
            Empowering abilities, connecting hearts
          </Text>
        </View>

        {/* Loading Indicator */}
        <View style={styles.loadingContainer}>
          <Animated.View style={[styles.loadingDot, { opacity: dot1Anim }]} />
          <Animated.View style={[styles.loadingDot, { opacity: dot2Anim }]} />
          <Animated.View style={[styles.loadingDot, { opacity: dot3Anim }]} />
        </View>

      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decorTopRight: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: 'rgba(241, 219, 255, 0.3)', // primary-fixed/30
    transform: [{ scale: 1.5 }], // To simulate spread/blur slightly without intensive SVG blur
  },
  decorBottomLeft: {
    position: 'absolute',
    bottom: -120,
    left: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255, 221, 184, 0.2)', // secondary-fixed/20
    transform: [{ scale: 1.5 }],
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 300,
    zIndex: 10,
  },
  logoContainer: {
    marginBottom: 32,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 40,
    // Add subtle shadow for the "glass" look
    shadowColor: '#500088',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  innerLogoContainer: {
    width: 96,
    height: 96,
    borderRadius: 32,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2D1B5E',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 24,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7C3AED',
    marginHorizontal: 6,
  },
});

export default SplashScreen;
