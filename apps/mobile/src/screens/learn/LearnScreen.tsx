import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { BookOpen, GraduationCap, Sparkles, Search, ChevronRight, Check } from "lucide-react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const UPCOMING_COURSES = [
  {
    id: "digital-acc",
    icon: "📱",
    title: "Digital Accessibility Guides",
    description: "Master native screen readers (VoiceOver/TalkBack), screen magnifiers, and voice control utilities.",
    duration: "4 modules",
  },
  {
    id: "living-skills",
    icon: "♿",
    title: "Independent Living Skills",
    description: "Learn practical tips for home adaptation, adaptive cooking techniques, and public transit navigation.",
    duration: "6 modules",
  },
  {
    id: "legal-rights",
    icon: "⚖️",
    title: "Rights & Benefits Navigator",
    description: "Understand government schemes, education scholarships, and legal protections available to you.",
    duration: "3 modules",
  },
];

export const LearnScreen = () => {
  const navigation = useNavigation<any>();
  const { colors, spacing, highContrast } = useTheme();
  
  // Interactive poll state
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [searchVal, setSearchVal] = useState("");

  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };

  const handleTopicToggle = (topicId: string) => {
    if (hasVoted) return;
    if (selectedTopics.includes(topicId)) {
      setSelectedTopics(selectedTopics.filter(id => id !== topicId));
    } else {
      setSelectedTopics([...selectedTopics, topicId]);
    }
  };

  const handleVoteSubmit = () => {
    if (selectedTopics.length > 0) {
      setHasVoted(true);
    }
  };

  const handleReturnHome = () => {
    navigation.navigate("Home");
  };

  const pollTopics = [
    { id: "voiceover", label: "VoiceOver Tutorials" },
    { id: "govt-schemes", label: "Govt Scheme Guides" },
    { id: "assistive-tech", label: "Assistive Tech Reviews" },
    { id: "career-skills", label: "Career & Interview Skills" },
  ];

  return (
    <ScreenWrapper>
      {/* HEADER */}
      <AppHeader title="Learn & Resources" hideBackButton={true} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Platform.OS === "ios" ? 150 : 120 }]}
      >
        {/* HERO CARD */}
        <LinearGradient
          colors={highContrast ? ["#000000", "#000000"] : ["#500088", "#7E22CE"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.heroCard,
            highContrast && { borderWidth: 2, borderColor: "#FFFFFF" },
          ]}
        >
          <View style={styles.heroContent}>
            <View style={[styles.heroIconBg, { backgroundColor: "rgba(255, 255, 255, 0.15)" }]}>
              <BookOpen color="#FFFFFF" size={32} strokeWidth={2} />
            </View>
            <View style={styles.heroTextContainer}>
              <AccessibleText variant="heroTitle" style={{ color: "#FFFFFF", fontSize: 24, lineHeight: 30 }}>
                Learn Hub
              </AccessibleText>
              <AccessibleText variant="body" style={{ color: "rgba(255,255,255,0.85)", marginTop: 4 }}>
                Courses, webinars, and guides for digital and daily independence.
              </AccessibleText>
            </View>
          </View>
        </LinearGradient>

        {/* SEARCH BAR MOCK */}
        <View style={[styles.searchMock, { backgroundColor: colors.card }, cardBorder]}>
          <Search color={colors.subtext} size={20} style={{ marginRight: spacing.sm }} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search learning materials..."
            placeholderTextColor={colors.subtext}
            value={searchVal}
            onChangeText={setSearchVal}
            editable={false} // Mock state
          />
        </View>

        {/* STATUS CARD */}
        <View style={[styles.statusCard, { backgroundColor: colors.card }, cardBorder]}>
          <View style={[styles.iconWrapper, { backgroundColor: highContrast ? "#FFFFFF" : "#F4F3FA" }]}>
            <GraduationCap color={colors.primary} size={28} />
          </View>
          <AccessibleText variant="title" style={{ textAlign: "center", marginTop: spacing.md }}>
            Academy Under Construction
          </AccessibleText>
          <AccessibleText variant="body" style={{ color: colors.subtext, textAlign: "center", marginTop: spacing.sm, lineHeight: 22 }}>
            Our educational team is curating high-quality guides, digital tutorials, and video modules optimize for screen readers and accessibility.
          </AccessibleText>
        </View>

        {/* DYNAMIC TOPIC POLL */}
        <View style={[styles.pollCard, { backgroundColor: colors.card }, cardBorder]}>
          <AccessibleText variant="title" style={{ fontSize: 16, marginBottom: spacing.xs }}>
            {hasVoted ? "🎉 Thank you for your feedback!" : "💡 Vote for Upcoming Topics"}
          </AccessibleText>
          <AccessibleText variant="body" style={{ color: colors.subtext, fontSize: 13, marginBottom: spacing.md }}>
            {hasVoted 
              ? "We have logged your votes and will prioritize these guides in our next course update."
              : "Which accessibility guide or topic would you like us to publish first? Select all that apply."}
          </AccessibleText>

          {!hasVoted ? (
            <View style={styles.pollOptions}>
              {pollTopics.map((topic) => {
                const isSelected = selectedTopics.includes(topic.id);
                return (
                  <TouchableOpacity
                    key={topic.id}
                    onPress={() => handleTopicToggle(topic.id)}
                    style={[
                      styles.pollOption,
                      {
                        backgroundColor: isSelected ? (highContrast ? "#000000" : "#F3E8FF") : colors.background,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderWidth: isSelected || highContrast ? 2 : 1,
                      }
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={topic.label}
                  >
                    <AccessibleText variant="body" style={{ 
                      color: isSelected ? colors.primary : colors.text, 
                      fontWeight: isSelected ? "700" : "500",
                      flex: 1
                    }}>
                      {topic.label}
                    </AccessibleText>
                    {isSelected && (
                      <Check color={colors.primary} size={18} strokeWidth={3} />
                    )}
                  </TouchableOpacity>
                );
              })}

              <AccessibleButton
                accessibilityLabel="Submit your topics vote"
                onPress={handleVoteSubmit}
                disabled={selectedTopics.length === 0}
                variant={selectedTopics.length === 0 ? "outline" : "primary"}
                style={{ marginTop: spacing.sm }}
              >
                Submit Vote
              </AccessibleButton>
            </View>
          ) : (
            <View style={styles.votedContainer}>
              {pollTopics.map((topic) => {
                const isSelected = selectedTopics.includes(topic.id);
                return (
                  <View key={topic.id} style={styles.votedRow}>
                    <AccessibleText variant="body" style={{ 
                      color: isSelected ? colors.primary : colors.text,
                      fontWeight: isSelected ? "700" : "400"
                    }}>
                      {topic.label} {isSelected && "✅"}
                    </AccessibleText>
                    <View style={styles.progressContainer}>
                      <View style={[
                        styles.progressBar, 
                        { 
                          width: isSelected ? "85%" : "40%", 
                          backgroundColor: isSelected ? colors.primary : colors.subtext 
                        }
                      ]} />
                      <AccessibleText variant="caption" style={{ marginLeft: 8 }}>
                        {isSelected ? "85%" : "40%"}
                      </AccessibleText>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* UPCOMING SHOWCASE */}
        <AccessibleText variant="label" style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
          UPCOMING TRACKS
        </AccessibleText>

        {UPCOMING_COURSES.map((course) => (
          <View
            key={course.id}
            style={[styles.courseCard, { backgroundColor: colors.card }, cardBorder]}
          >
            <View style={styles.courseHeader}>
              <View style={styles.courseIconContainer}>
                <AccessibleText style={{ fontSize: 26 }}>{course.icon}</AccessibleText>
              </View>
              <View style={styles.courseTitleContainer}>
                <AccessibleText variant="title" style={{ fontSize: 16 }}>
                  {course.title}
                </AccessibleText>
                <AccessibleText variant="caption" style={{ color: colors.primary, fontWeight: "700" }}>
                  {course.duration}
                </AccessibleText>
              </View>
            </View>
            <AccessibleText variant="body" style={{ color: colors.subtext, marginTop: spacing.sm, lineHeight: 20 }}>
              {course.description}
            </AccessibleText>
          </View>
        ))}

        {/* RETURN BUTTON */}
        <AccessibleButton
          accessibilityLabel="Return to Home Dashboard"
          accessibilityHint="Navigates back to the main Home screen"
          onPress={handleReturnHome}
          style={{ marginTop: spacing.xl }}
        >
          Return to Dashboard
        </AccessibleButton>
      </ScrollView>
    </ScreenWrapper>
  );
};

export default LearnScreen;

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 16,
    paddingHorizontal: 24,
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#500088",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  heroContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroIconBg: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  heroTextContainer: {
    flex: 1,
  },
  searchMock: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
  },
  statusCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  pollCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  pollOptions: {
    gap: 10,
  },
  pollOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
  },
  votedContainer: {
    gap: 12,
  },
  votedRow: {
    gap: 4,
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  courseCard: {
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  courseHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  courseIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  courseTitleContainer: {
    flex: 1,
    gap: 2,
    flexDirection: "column",
    alignItems: "flex-start",
  },
});
