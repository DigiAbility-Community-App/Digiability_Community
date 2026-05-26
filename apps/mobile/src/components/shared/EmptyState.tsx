import React from 'react';
import { View, StyleSheet, Image, ViewStyle, TextStyle } from 'react-native';
import { AccessibleText } from './AccessibleText';
import { AccessibleButton } from './AccessibleButton';

interface EmptyStateProps {
  title: string;
  description: string;
  illustrationUrl?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  illustrationUrl,
  actionLabel,
  onActionPress,
  style
}) => {
  return (
    <View style={[styles.container, style]} accessibilityRole="summary">
      {illustrationUrl ? (
        <Image
          source={{ uri: illustrationUrl }}
          style={styles.image}
          resizeMode="contain"
          accessible={false} // Avoid screen reader reading image without alt text
        />
      ) : (
        <View style={styles.iconPlaceholder} />
      )}
      <AccessibleText style={styles.title} accessibilityRole="header">
        {title}
      </AccessibleText>
      <AccessibleText style={styles.description}>
        {description}
      </AccessibleText>
      {actionLabel && onActionPress && (
        <AccessibleButton
          accessibilityLabel={actionLabel}
          onPress={onActionPress}
          variant="primary"
          style={styles.button}
        >
          {actionLabel}
        </AccessibleButton>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'transparent',
  },
  image: {
    width: 140,
    height: 140,
    marginBottom: 20,
    opacity: 0.8,
  },
  iconPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    minWidth: 180,
    minHeight: 48,
    borderRadius: 24,
  },
});
