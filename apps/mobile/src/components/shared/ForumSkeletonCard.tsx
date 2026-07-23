import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

interface ForumSkeletonCardProps {
  style?: ViewStyle;
}

export const ForumSkeletonCard: React.FC<ForumSkeletonCardProps> = ({ style }) => {
  const { reduceMotion } = useTheme();
  const shimmerActive = useRef(new Animated.Value(0.3)).current;

  // Shimmer pulse — skipped when Reduce Motion is on; placeholders just
  // render at a static mid-opacity instead of pulsing indefinitely.
  useEffect(() => {
    if (reduceMotion) {
      shimmerActive.setValue(0.5);
      return;
    }

    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerActive, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true
        }),
        Animated.timing(shimmerActive, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true
        })
      ])
    );
    shimmerAnimation.start();
    return () => shimmerAnimation.stop();
  }, [shimmerActive, reduceMotion]);

  return (
    <View
      style={[styles.card, style]}
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading content"
    >
      <View style={styles.headerRow}>
        {/* User avatar placeholder */}
        <Animated.View style={[styles.avatar, { opacity: shimmerActive }]} />
        <View style={styles.headerTexts}>
          {/* User name placeholder */}
          <Animated.View style={[styles.textLineShort, { opacity: shimmerActive }]} />
          {/* Date placeholder */}
          <Animated.View style={[styles.textLineTiny, { opacity: shimmerActive }]} />
        </View>
      </View>

      {/* Title placeholder */}
      <Animated.View style={[styles.textLineLong, { opacity: shimmerActive, marginTop: 12 }]} />
      <Animated.View style={[styles.textLineLong, { opacity: shimmerActive, width: '80%', marginTop: 8 }]} />

      <View style={styles.footerRow}>
        {/* Category badge placeholder */}
        <Animated.View style={[styles.badge, { opacity: shimmerActive }]} />
        {/* Comments/views placeholders */}
        <View style={styles.metaRow}>
          <Animated.View style={[styles.metaDot, { opacity: shimmerActive }]} />
          <Animated.View style={[styles.metaDot, { opacity: shimmerActive }]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
  },
  headerTexts: {
    marginLeft: 10,
    flex: 1,
  },
  textLineShort: {
    width: '40%',
    height: 12,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  textLineTiny: {
    width: '20%',
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
    marginTop: 6,
  },
  textLineLong: {
    width: '100%',
    height: 14,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  badge: {
    width: 80,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  metaRow: {
    flexDirection: 'row',
  },
  metaDot: {
    width: 40,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
    marginLeft: 8,
  },
});
