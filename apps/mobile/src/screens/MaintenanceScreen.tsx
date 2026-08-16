import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Wrench, Shield, RefreshCw, Clock, Heart, Mail } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { AccessibleText } from '../components/shared/AccessibleText';
import { useSystemStore } from '../store/systemStore';

interface MaintenanceScreenProps {
  onRetry?: () => void;
}

export default function MaintenanceScreen({ onRetry }: MaintenanceScreenProps) {
  const { colors, highContrast } = useTheme();
  const checkMaintenanceStatus = useSystemStore((s) => s.checkMaintenanceStatus);
  const [checking, setChecking] = useState(false);

  const handleRefresh = async () => {
    setChecking(true);
    try {
      if (onRetry) {
        await onRetry();
      } else {
        await checkMaintenanceStatus();
      }
    } finally {
      setTimeout(() => setChecking(false), 500);
    }
  };

  const handleSupportEmail = () => {
    Linking.openURL('mailto:support@digiability.org?subject=Maintenance%20Query').catch(() => {});
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* HEADER ICON BANNER */}
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={['#7004DC', '#9A3FF5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconCircle}
          >
            <Wrench size={48} color="#FFFFFF" strokeWidth={2.2} />
          </LinearGradient>
          <View style={styles.clockBadge}>
            <Clock size={16} color="#7004DC" strokeWidth={2.5} />
          </View>
        </View>

        {/* STATUS BADGE */}
        <View style={styles.statusPill}>
          <View style={styles.pulsingDot} />
          <AccessibleText style={styles.statusPillText}>
            SYSTEM UPDATE IN PROGRESS
          </AccessibleText>
        </View>

        {/* HEADLINE */}
        <AccessibleText style={[styles.title, { color: colors.text }]}>
          Under Scheduled Maintenance
        </AccessibleText>

        <AccessibleText style={[styles.description, { color: colors.subtext }]}>
          We are performing essential system updates and improvements to provide you with a faster,
          more accessible experience. DigiAbility will be back shortly.
        </AccessibleText>

        {/* REASSURANCE CARDS */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.miniIconBg}>
              <Shield size={18} color="#7004DC" strokeWidth={2} />
            </View>
            <View style={styles.infoTextWrapper}>
              <AccessibleText style={styles.infoTitle}>Data & Privacy Protected</AccessibleText>
              <AccessibleText style={styles.infoSubtitle}>
                Your profile, messages, and care circle connections remain fully safe and secure.
              </AccessibleText>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.miniIconBg}>
              <Heart size={18} color="#7004DC" strokeWidth={2} />
            </View>
            <View style={styles.infoTextWrapper}>
              <AccessibleText style={styles.infoTitle}>Continuous Care</AccessibleText>
              <AccessibleText style={styles.infoSubtitle}>
                Emergency SOS numbers and hotlines continue to be active via standard phone service.
              </AccessibleText>
            </View>
          </View>
        </View>

        {/* ACTION BUTTON */}
        <TouchableOpacity
          onPress={handleRefresh}
          disabled={checking}
          activeOpacity={0.85}
          style={[
            styles.refreshButton,
            { backgroundColor: highContrast ? '#000000' : '#7004DC' },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Check server status"
        >
          {checking ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View style={styles.buttonInner}>
              <RefreshCw size={18} color="#FFFFFF" strokeWidth={2.2} />
              <AccessibleText style={styles.buttonText}>Check Status & Retry</AccessibleText>
            </View>
          )}
        </TouchableOpacity>

        {/* SUPPORT FOOTER */}
        <TouchableOpacity
          onPress={handleSupportEmail}
          style={styles.supportButton}
          activeOpacity={0.7}
        >
          <Mail size={16} color="#7004DC" strokeWidth={2} />
          <AccessibleText style={styles.supportText}>
            Need urgent help? Contact Support
          </AccessibleText>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  iconCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7004DC',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  clockBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3EEFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D2A500',
    marginRight: 8,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7004DC',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 28,
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#ECE7F2',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  miniIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F3EEFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoTextWrapper: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1C1C',
    marginBottom: 2,
  },
  infoSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: '#7D7387',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0EBF5',
    marginVertical: 14,
  },
  refreshButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7004DC',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 16,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  supportText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7004DC',
  },
});
