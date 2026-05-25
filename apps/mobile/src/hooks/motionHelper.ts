import { Animated } from 'react-native';

/**
 * Runs a standard timing animation if permitted.
 * If reduceMotion preference is active, the animation completes instantly (duration = 0).
 */
export const animateIfAllowed = (
  reduceMotion: boolean,
  value: Animated.Value | Animated.ValueXY,
  config: Animated.TimingAnimationConfig
): Animated.CompositeAnimation => {
  if (reduceMotion) {
    return Animated.timing(value, {
      ...config,
      duration: 0, // Bypass animation duration
      delay: 0,    // Bypass start delays
    });
  }
  return Animated.timing(value, config);
};
