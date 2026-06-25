import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { Play, Clock, Star } from "lucide-react-native";

const MOCK_COURSES = [
  {
    id: "crs-1",
    title: "Introduction to Assistive Technologies",
    instructor: "Dr. Emily Chen",
    level: "Beginner",
    duration: "2h 15m",
    rating: 4.8,
    reviews: 142,
    emoji: "💻",
  },
  {
    id: "crs-2",
    title: "Navigating Disability Rights in the Workplace",
    instructor: "Legal Advocates Group",
    level: "Intermediate",
    duration: "1h 45m",
    rating: 4.9,
    reviews: 89,
    emoji: "⚖️",
  },
  {
    id: "crs-3",
    title: "Inclusive Design Principles",
    instructor: "Alex Rivera, UX Lead",
    level: "Advanced",
    duration: "3h 30m",
    rating: 4.7,
    reviews: 210,
    emoji: "🎨",
  },
  {
    id: "crs-4",
    title: "Self-Advocacy Masterclass",
    instructor: "Sarah Jenkins",
    level: "All Levels",
    duration: "1h 20m",
    rating: 4.9,
    reviews: 315,
    emoji: "🗣️",
  },
  {
    id: "crs-5",
    title: "Caregiver Support: Stress Management",
    instructor: "Wellness Institute",
    level: "Beginner",
    duration: "2h 00m",
    rating: 4.6,
    reviews: 56,
    emoji: "🧘",
  },
  {
    id: "crs-6",
    title: "Financial Planning with Disability Benefits",
    instructor: "Mark Thompson, CPA",
    level: "Intermediate",
    duration: "4h 10m",
    rating: 4.8,
    reviews: 178,
    emoji: "📊",
  }
];

export const LearnScreen = () => {
  const navigation = useNavigation<any>();
  const { colors, spacing, highContrast } = useTheme();

  return (
    <ScreenWrapper>
      <AppHeader title="Learning Academy" hideBackButton={true} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === "ios" ? 150 : 120 }]}
      >
        <AccessibleText style={{ color: colors.subtext, fontSize: 14, marginBottom: 20, paddingHorizontal: 4 }}>
          Enhance your skills with accessible, community-led courses.
        </AccessibleText>

        {MOCK_COURSES.map(course => (
          <TouchableOpacity 
            key={course.id} 
            style={[styles.courseCard, { backgroundColor: colors.card }]}
            activeOpacity={0.9}
            onPress={() => Alert.alert("Start Course", `Starting course: ${course.title}`)}
          >
            <View style={styles.courseImage}>
              <AccessibleText style={{ fontSize: 48 }}>{course.emoji}</AccessibleText>
              <View style={styles.courseDuration}>
                <Clock size={12} color="#fff" />
                <AccessibleText style={{ color: "#fff", fontSize: 11, fontWeight: "600", marginLeft: 4 }}>
                  {course.duration}
                </AccessibleText>
              </View>
            </View>
            
            <View style={styles.courseContent}>
              <AccessibleText style={{ color: "#500088", fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginBottom: 6 }}>
                {course.level}
              </AccessibleText>
              
              <AccessibleText variant="title" style={{ fontSize: 16, marginBottom: 4, lineHeight: 22 }}>
                {course.title}
              </AccessibleText>
              
              <AccessibleText style={{ color: colors.subtext, fontSize: 13, marginBottom: 14 }}>
                by {course.instructor}
              </AccessibleText>
              
              <View style={styles.courseMeta}>
                <View style={styles.ratingRow}>
                  <Star size={14} color="#F59E0B" fill="#F59E0B" />
                  <AccessibleText style={{ color: colors.text, fontSize: 13, fontWeight: "600", marginLeft: 4 }}>
                    {course.rating}
                  </AccessibleText>
                  <AccessibleText style={{ color: colors.subtext, fontSize: 13, marginLeft: 4 }}>
                    ({course.reviews})
                  </AccessibleText>
                </View>
                
                <View style={styles.startBtn}>
                  <Play size={12} color="#500088" fill="#500088" />
                  <AccessibleText style={{ color: "#500088", fontSize: 12, fontWeight: "700", marginLeft: 4 }}>
                    Start
                  </AccessibleText>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ScreenWrapper>
  );
};

export default LearnScreen;

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  courseCard: {
    borderRadius: 20,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#500088",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  courseImage: {
    height: 120,
    backgroundColor: "#F3E8FF",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  courseDuration: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  courseContent: {
    padding: 18,
  },
  courseMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 14,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  }
});
