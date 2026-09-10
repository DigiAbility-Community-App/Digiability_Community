import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  TextInput,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  MessageCircle,
  Flag,
  RotateCcw,
  Check,
  Eye,
  Trash2,
  HelpCircle,
  Bookmark,
  Sparkles,
  Volume2,
  VolumeX,
  Type,
  X,
  Plus,
  Heart
} from "lucide-react-native";
import * as Speech from "expo-speech";
import Markdown from "react-native-markdown-display";
import { MediaViewer } from "../../components/chat/MediaViewer";
import { useForumStore, ForumAnswer } from "../../store/forumStore";
import { useAuthStore } from "../../store/authStore";
import { formatUserDisplayName } from "../../utils/formatUserName";
import CreateAnswerModal from "./CreateAnswerModal";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

function isValidImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (
    trimmed === "" ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "undefined" ||
    trimmed.toLowerCase() === "nothing" ||
    trimmed.toLowerCase() === "none" ||
    trimmed.length < 10
  ) {
    return false;
  }
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("file://")
  );
}

function isValidAltText(alt?: string | null): boolean {
  if (!alt || typeof alt !== "string") return false;
  const trimmed = alt.trim().toLowerCase();
  return trimmed !== "" && trimmed !== "nothing" && trimmed !== "null" && trimmed !== "undefined" && trimmed !== "none";
}

function formatPostDate(dateInput: any): string {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

const QuestionDetailsScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { questionId } = route.params;

  const { colors, highContrast } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const {
    currentQuestion,
    currentQuestionSummary,
    bookmarks,
    loading,
    actionLoading,
    fetchQuestionDetails,
    fetchQuestionSummary,
    toggleBookmark,
    fetchBookmarks,
    createAnswer,
    deleteQuestion,
    deleteAnswer,
    voteAnswer,
    acceptAnswer,
    reopenQuestion,
    reportContent
  } = useForumStore();

  const [isAnswerModalOpen, setIsAnswerModalOpen] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: "question" | "answer"; id: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportCustomCategory, setReportCustomCategory] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  const [satisfactionFlow, setSatisfactionFlow] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [dyslexiaMode, setDyslexiaMode] = useState(false);
  const [showSummaryDrawer, setShowSummaryDrawer] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [selectedMedia, setSelectedMedia] = useState<{ src: string; alt?: string } | null>(null);

  useEffect(() => {
    fetchQuestionDetails(questionId);
  }, [questionId]);

  // Clean up speaking on unmount
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  if (loading && !currentQuestion) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <AccessibleText variant="body" style={[styles.loadingText, { color: colors.primary }]}>
          Loading discussion...
        </AccessibleText>
      </View>
    );
  }

  if (!currentQuestion) {
    return (
      <View style={styles.errorContainer}>
        <AccessibleText variant="body" style={[styles.errorText, { color: colors.error }]}>
          Discussion not found.
        </AccessibleText>
        <AccessibleButton
          variant="primary"
          accessibilityLabel="Go back"
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          Go Back
        </AccessibleButton>
      </View>
    );
  }

  const isOwner = currentQuestion.authorId === user?.id;
  const isSolved = currentQuestion.status === "SOLVED";
  const hasAnswers = currentQuestion.answers && currentQuestion.answers.length > 0;
  const isBookmarked = bookmarks.some(b => b.id === currentQuestion.id);

  const handlePostAnswer = async (content: string, imageUri: string | null) => {
    try {
      await createAnswer({
        questionId: currentQuestion.id,
        content,
        imageUri
      });
      Alert.alert("Success", "Your answer has been posted!");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to post answer.");
    }
  };

  const handleVote = async (answerId: string, type: "UP" | "DOWN") => {
    if (!user) {
      Alert.alert("Log In", "You must be logged in to vote.");
      return;
    }
    await voteAnswer(answerId, type);
  };

  const handleAcceptAnswer = async (answerId: string) => {
    Alert.alert("Accept Answer", "Are you sure you want to mark this answer as accepted?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, Accept",
        onPress: async () => {
          await acceptAnswer(answerId);
          setSatisfactionFlow(false);
        }
      }
    ]);
  };

  const handleReopen = () => {
    Alert.alert("Reopen Question", "Reopening will allow members to post new answers.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reopen",
        onPress: async () => {
          await reopenQuestion(currentQuestion.id);
        }
      }
    ]);
  };

  const handleDeleteQuestion = () => {
    Alert.alert("Delete Question", "Are you sure you want to delete this question?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteQuestion(currentQuestion.id);
          navigation.goBack();
        }
      }
    ]);
  };

  const handleDeleteAnswer = (answerId: string) => {
    Alert.alert("Delete Answer", "Are you sure you want to delete your answer?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteAnswer(answerId);
        }
      }
    ]);
  };

  const REPORT_REASONS = [
    { key: "SPAM", label: "Spam" },
    { key: "HARASSMENT", label: "Harassment" },
    { key: "HATE_SPEECH", label: "Hate Speech" },
    { key: "INAPPROPRIATE_CONTENT", label: "Inappropriate Content" },
    { key: "MISINFORMATION", label: "Misinformation" },
    { key: "OTHER", label: "Other" },
  ];

  const openReportModal = (type: "question" | "answer", id: string) => {
    setReportTarget({ type, id });
    setReportReason("");
    setReportCustomCategory("");
    setReportDetails("");
    setReportModalVisible(true);
  };

  const handleReportSubmit = async () => {
    if (!reportReason) {
      Alert.alert("Reason Required", "Please select a reason for reporting this content.");
      return;
    }
    if (reportReason === "OTHER" && !reportCustomCategory.trim()) {
      Alert.alert("Category Required", "Please specify a category for 'Other'.");
      return;
    }
    if (reportSubmitting) return;

    setReportSubmitting(true);
    try {
      const selectedLabel = reportReason === "OTHER"
        ? `Other: ${reportCustomCategory.trim()}`
        : REPORT_REASONS.find(r => r.key === reportReason)?.label || reportReason;

      const fullReason = reportDetails.trim()
        ? `${selectedLabel}: ${reportDetails.trim()}`
        : selectedLabel;
      const payload: any = { reason: fullReason };
      if (reportTarget) {
        if (reportTarget.type === "question") {
          payload.questionId = reportTarget.id;
        } else {
          payload.answerId = reportTarget.id;
        }
      }

      await reportContent(payload);
      setReportModalVisible(false);
      Alert.alert("Thank You", "Your report has been submitted to the moderation team.");
    } catch (e: any) {
      Alert.alert("Error", "Failed to submit report. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleSpeakText = (text: string, id: string) => {
    if (speakingId === id) {
      Speech.stop();
      setSpeakingId(null);
    } else {
      Speech.stop();
      setSpeakingId(id);
      Speech.speak(text, {
        onDone: () => setSpeakingId(null),
        onError: () => setSpeakingId(null)
      });
    }
  };

  const handleToggleBookmark = async () => {
    if (!user) {
      Alert.alert("Authentication Needed", "Log in to bookmark discussions.");
      return;
    }
    await toggleBookmark(currentQuestion.id);
  };

  const handleOpenSummary = async () => {
    setShowSummaryDrawer(true);
    if (!currentQuestionSummary) {
      setLoadingSummary(true);
      await fetchQuestionSummary(currentQuestion.id);
      setLoadingSummary(false);
    }
  };

  // Custom typography style mapper for Dyslexia Mode
  const getMarkdownStyles = (dyslexia: boolean) => ({
    body: {
      color: dyslexia ? "#000000" : colors.text,
      fontSize: dyslexia ? 16 : 14,
      lineHeight: dyslexia ? 24 : 20,
      letterSpacing: dyslexia ? 1.4 : 0,
      fontWeight: dyslexia ? ("700" as const) : ("400" as const),
      margin: 0,
      padding: 0,
    },
    paragraph: {
      marginTop: 2,
      marginBottom: 6,
    },
  });

  const textStyle = dyslexiaMode
    ? { letterSpacing: 1.6, lineHeight: 28, fontWeight: "700" as const }
    : {};

  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" as const }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" as const };

  const renderQuestionHeader = () => (
    <View style={styles.headerContainer}>
      <View style={[styles.questionCard, { backgroundColor: colors.card }, cardBorder]}>
        {/* AUTHOR DETAILS */}
        <View style={styles.authorRow}>
          <View style={styles.authorLeft}>
            <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
              <AccessibleText style={styles.avatarText}>
                {currentQuestion.author.name.charAt(0).toUpperCase()}
              </AccessibleText>
            </View>
            <View style={styles.authorInfo}>
              <View style={styles.authorNameContainer}>
                <AccessibleText numberOfLines={1} style={[styles.authorName, { color: colors.text }, textStyle]}>
                  {formatUserDisplayName(currentQuestion.author)}
                </AccessibleText>
                {currentQuestion.author.forumStats && currentQuestion.author.forumStats.reputation > 0 && (
                  <View
                    style={[
                      styles.repBadge,
                      { backgroundColor: highContrast ? "#FFFFFF" : "#FFFBEB", borderColor: colors.badge },
                    ]}
                  >
                    <AccessibleText variant="overline" style={[styles.repText, { color: colors.badge }]}>
                      ★ {currentQuestion.author.forumStats.reputation}
                    </AccessibleText>
                  </View>
                )}
              </View>
              <AccessibleText numberOfLines={1} variant="caption" style={[styles.authorMeta, { color: colors.subtext }]}>
                {currentQuestion.author.role?.toUpperCase()} •{" "}
                {formatPostDate(currentQuestion.createdAt)}
              </AccessibleText>
            </View>
          </View>

          {/* OPTIONS Row (TTS, Delete if owner, Flag) */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              onPress={() => handleSpeakText(currentQuestion.title + ". " + (currentQuestion.description || ""), currentQuestion.id)}
              style={styles.optionIcon}
              accessibilityRole="button"
              accessibilityLabel={speakingId === currentQuestion.id ? "Stop reading question aloud" : "Read question aloud"}
              accessibilityHint="Uses text-to-speech to read the question title and description"
            >
              {speakingId === currentQuestion.id ? (
                <VolumeX size={18} color={colors.error} />
              ) : (
                <Volume2 size={18} color={colors.subtext} />
              )}
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity
                onPress={handleDeleteQuestion}
                style={styles.optionIcon}
                accessibilityRole="button"
                accessibilityLabel="Delete this question"
              >
                <Trash2 size={18} color={colors.error} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => openReportModal("question", currentQuestion.id)}
              style={styles.optionIcon}
              accessibilityRole="button"
              accessibilityLabel="Report this question"
            >
              <Flag size={18} color={colors.subtext} />
            </TouchableOpacity>
          </View>
        </View>

        {/* QUESTION TITLE */}
        <AccessibleText variant="title" style={[styles.questionTitle, { color: colors.text }, textStyle]}>
          {currentQuestion.title}
        </AccessibleText>

        {/* QUESTION DESCRIPTION */}
        {currentQuestion.description ? (
          <View style={styles.descriptionWrapper}>
            <Markdown style={getMarkdownStyles(dyslexiaMode)}>
              {currentQuestion.description}
            </Markdown>
          </View>
        ) : null}

        {/* QUESTION IMAGE - Clickable to open pinch-to-zoom MediaViewer */}
        {!failedImages[currentQuestion.id] && isValidImageUrl(currentQuestion.imageUrl) && (
          <TouchableOpacity
            style={styles.imageContainer}
            activeOpacity={0.9}
            onPress={() =>
              setSelectedMedia({
                src: currentQuestion.imageUrl as string,
                alt: isValidAltText(currentQuestion.altText)
                  ? currentQuestion.altText!
                  : currentQuestion.title,
              })
            }
            accessibilityRole="button"
            accessibilityLabel={
              isValidAltText(currentQuestion.altText)
                ? currentQuestion.altText!
                : "Uploaded question image"
            }
            accessibilityHint="Tap to view image full screen with zoom and download"
          >
            <Image
              source={{ uri: currentQuestion.imageUrl as string }}
              style={styles.questionImage}
              resizeMode="cover"
              onError={() => setFailedImages((prev) => ({ ...prev, [currentQuestion.id]: true }))}
              accessible={true}
              accessibilityLabel={isValidAltText(currentQuestion.altText) ? currentQuestion.altText! : "Uploaded question image"}
            />
            {isValidAltText(currentQuestion.altText) && (
              <AccessibleText variant="caption" style={[styles.altTextHint, { color: colors.subtext }]}>
                Alt text: {currentQuestion.altText}
              </AccessibleText>
            )}
          </TouchableOpacity>
        )}

        {/* QUESTION FOOTER / TAGS */}
        {Array.isArray(currentQuestion.tags) && currentQuestion.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {currentQuestion.tags.map((tag) => (
              <View key={tag.id} style={[styles.tagBadge, { backgroundColor: colors.surface }]}>
                <AccessibleText variant="caption" style={[styles.tagText, { color: colors.secondary }]}>
                  #{tag.name.toLowerCase()}
                </AccessibleText>
              </View>
            ))}
          </View>
        )}

        {/* VIEW COUNT & VIEWS */}
        <View style={[styles.statRow, { borderTopColor: colors.border }]}>
          <View style={styles.statItem}>
            <Eye size={14} color={colors.subtext} />
            <AccessibleText variant="caption" style={[styles.statText, { color: colors.subtext }]}>
              {currentQuestion.views} Views
            </AccessibleText>
          </View>
          <View style={styles.statItem}>
            <MessageCircle size={14} color={colors.subtext} />
            <AccessibleText variant="caption" style={[styles.statText, { color: colors.subtext }]}>
              {currentQuestion.answerCount} Answers
            </AccessibleText>
          </View>

          {/* AI SUMMARY ACTION */}
          {hasAnswers && (
            <TouchableOpacity
              style={[
                styles.aiSummaryBadge,
                { backgroundColor: highContrast ? "#FFFFFF" : "#FAF5FF", borderColor: colors.secondary },
              ]}
              onPress={handleOpenSummary}
              accessibilityRole="button"
              accessibilityLabel="View AI summary of this discussion"
            >
              <Sparkles size={13} color={colors.secondary} style={{ marginRight: 4 }} />
              <AccessibleText variant="caption" style={[styles.aiSummaryBadgeText, { color: colors.secondary }]}>
                AI Summary
              </AccessibleText>
            </TouchableOpacity>
          )}
        </View>

        {/* OWNER REOPEN CONTROLLER */}
        {isOwner && isSolved && (
          <TouchableOpacity
            style={[
              styles.reopenButton,
              { backgroundColor: highContrast ? "#FFFFFF" : "#F3E8FF" },
              highContrast && { borderWidth: 1, borderColor: "#000000" },
            ]}
            onPress={handleReopen}
            accessibilityRole="button"
            accessibilityLabel="Reopen discussion"
            accessibilityHint="Allows members to post new answers again"
          >
            <RotateCcw size={16} color={colors.secondary} style={{ marginRight: 6 }} />
            <AccessibleText variant="caption" style={[styles.reopenButtonText, { color: colors.secondary }]}>
              Reopen Discussion
            </AccessibleText>
          </TouchableOpacity>
        )}

        {/* SATISFACTION SURVEY PROMPT */}
        {isOwner && !isSolved && hasAnswers && (
          <View
            style={[
              styles.satisfactionCard,
              { backgroundColor: highContrast ? "#FFFFFF" : "#F5F3FF" },
              { borderColor: highContrast ? "#000000" : "#C084FC" },
            ]}
          >
            {!satisfactionFlow ? (
              <>
                <HelpCircle size={20} color={colors.secondary} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <AccessibleText variant="body" style={[styles.satisfactionTitle, { color: colors.primary }]}>
                    Did this solve your problem?
                  </AccessibleText>
                  <AccessibleText variant="caption" style={[styles.satisfactionSubtitle, { color: colors.secondary }]}>
                    Help others in the community by highlighting the answer.
                  </AccessibleText>
                </View>
                <View style={styles.satisfactionButtons}>
                  <TouchableOpacity
                    style={[
                      styles.satBtn,
                      { backgroundColor: colors.surface },
                      highContrast && { borderWidth: 1, borderColor: "#000000" },
                    ]}
                    onPress={() => Alert.alert("Tip", "You can wait for more replies from other community members!")}
                    accessibilityRole="button"
                    accessibilityLabel="No, this did not solve my problem"
                  >
                    <AccessibleText variant="caption" style={[styles.satBtnNoText, { color: colors.subtext }]}>
                      No
                    </AccessibleText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.satBtn, { backgroundColor: colors.secondary }]}
                    onPress={() => setSatisfactionFlow(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Yes, this solved my problem"
                  >
                    <AccessibleText variant="caption" style={styles.satBtnYesText}>
                      Yes
                    </AccessibleText>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={{ flex: 1 }}>
                <View style={styles.satHeaderRow}>
                  <CheckCircle2 size={18} color="#16A34A" style={{ marginRight: 8 }} />
                  <AccessibleText variant="body" style={styles.satSelectTitle}>
                    Which answer solved your issue?
                  </AccessibleText>
                </View>
                <AccessibleText variant="caption" style={[styles.satSelectDesc, { color: colors.text }]}>
                  Scroll down and tap the checkmark icon (<Check size={12} color={colors.subtext} />) on the answer that helped you.
                </AccessibleText>
                <TouchableOpacity
                  style={styles.satCancelLink}
                  onPress={() => setSatisfactionFlow(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel marking an answer as accepted"
                >
                  <AccessibleText variant="caption" style={[styles.satCancelLinkText, { color: colors.error }]}>
                    Cancel
                  </AccessibleText>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* RESOLVED STATE BANNER */}
        {isSolved && (
          <View style={styles.resolvedBanner}>
            <CheckCircle2 size={18} color="#16A34A" style={{ marginRight: 8 }} />
            <AccessibleText variant="body" style={styles.resolvedBannerText}>
              This discussion has been resolved.
            </AccessibleText>
          </View>
        )}
      </View>

      {/* SECTION TITLE: Answers (N) */}
      <View style={styles.answersSectionHeader}>
        <AccessibleText variant="title" style={[styles.answersListHeader, { color: colors.text }]}>
          Answers ({currentQuestion.answers?.length ?? 0})
        </AccessibleText>
      </View>
    </View>
  );

  const renderAnswerCard = ({ item }: { item: ForumAnswer }) => {
    const isAnswerAuthor = item.authorId === user?.id;
    const isAccepted = item.isAccepted;

    return (
      <View
        style={[
          styles.answerCard,
          { backgroundColor: colors.card },
          cardBorder,
          isAccepted && styles.acceptedAnswerCard,
        ]}
      >
        {/* ACCEPTED CORNER MARK */}
        {isAccepted && (
          <View style={styles.acceptedMarker}>
            <CheckCircle2 size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
            <AccessibleText variant="overline" style={styles.acceptedMarkerText}>
              ACCEPTED ANSWER
            </AccessibleText>
          </View>
        )}

        <View style={styles.answerContentRow}>
          {/* LIKE BUTTON */}
          <View style={styles.likeContainer}>
            <TouchableOpacity
              style={[
                styles.likeBtn,
                item.isLiked && styles.likeBtnActive,
                { backgroundColor: item.isLiked ? (highContrast ? "#000000" : "#FEE2E2") : (highContrast ? colors.surface : "#F3F4F6") },
                highContrast && { borderWidth: 1, borderColor: "#000000" },
              ]}
              onPress={() => handleVote(item.id, "UP")}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={item.isLiked ? `Liked, ${item.upvotes ?? 0} likes. Tap to unlike` : `Like this answer, ${item.upvotes ?? 0} likes`}
            >
              <Heart
                size={18}
                color={item.isLiked ? (highContrast ? "#FFFFFF" : "#EF4444") : colors.subtext}
                fill={item.isLiked ? (highContrast ? "#FFFFFF" : "#EF4444") : "transparent"}
              />
              <AccessibleText
                variant="caption"
                style={[
                  styles.likeCount,
                  { color: item.isLiked ? (highContrast ? "#FFFFFF" : "#DC2626") : colors.subtext },
                  item.isLiked && { fontWeight: "800" },
                ]}
              >
                {item.upvotes ?? 0}
              </AccessibleText>
            </TouchableOpacity>
          </View>

          {/* ANSWER BODY */}
          <View style={{ flex: 1 }}>
            {/* META */}
            <View style={styles.answerHeader}>
              <View style={styles.answerAuthorInfo}>
                <View style={styles.authorNameContainer}>
                  <AccessibleText numberOfLines={1} style={[styles.answerAuthorName, { color: colors.text }, textStyle]}>
                    {formatUserDisplayName(item.author)}
                  </AccessibleText>
                  {item.author.forumStats && item.author.forumStats.reputation > 0 && (
                    <View
                      style={[
                        styles.repBadge,
                        { backgroundColor: highContrast ? "#FFFFFF" : "#FFFBEB", borderColor: colors.badge },
                      ]}
                    >
                      <AccessibleText variant="overline" style={[styles.repText, { color: colors.badge }]}>
                        ★ {item.author.forumStats.reputation}
                      </AccessibleText>
                    </View>
                  )}
                </View>
                <AccessibleText numberOfLines={1} variant="caption" style={[styles.answerTime, { color: colors.subtext }]}>
                  {item.author.role?.toUpperCase()} •{" "}
                  {formatPostDate(item.createdAt)}
                </AccessibleText>
              </View>

              <View style={styles.answerActions}>
                <TouchableOpacity
                  onPress={() => handleSpeakText(item.content || "", item.id)}
                  style={styles.answerActionIcon}
                  accessibilityRole="button"
                  accessibilityLabel={speakingId === item.id ? "Stop reading answer aloud" : "Read answer aloud"}
                  accessibilityHint="Uses text-to-speech to read the answer content"
                >
                  {speakingId === item.id ? (
                    <VolumeX size={16} color={colors.error} />
                  ) : (
                    <Volume2 size={16} color={colors.subtext} />
                  )}
                </TouchableOpacity>
                {isAnswerAuthor && (
                  <TouchableOpacity
                    onPress={() => handleDeleteAnswer(item.id)}
                    style={styles.answerActionIcon}
                    accessibilityRole="button"
                    accessibilityLabel="Delete this answer"
                  >
                    <Trash2 size={16} color={colors.error} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => openReportModal("answer", item.id)}
                  style={styles.answerActionIcon}
                  accessibilityRole="button"
                  accessibilityLabel="Report this answer"
                >
                  <Flag size={16} color={colors.subtext} />
                </TouchableOpacity>
              </View>
            </View>

            {/* CONTENT */}
            {item.content && (
              <Markdown style={getMarkdownStyles(dyslexiaMode)}>
                {item.content}
              </Markdown>
            )}

            {/* IMAGE - Clickable to open pinch-to-zoom MediaViewer */}
            {!failedImages[item.id] && isValidImageUrl(item.imageUrl) && (
              <TouchableOpacity
                style={styles.imageContainer}
                activeOpacity={0.9}
                onPress={() =>
                  setSelectedMedia({
                    src: item.imageUrl as string,
                    alt: isValidAltText(item.altText) ? item.altText! : "Answer image",
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={
                  isValidAltText(item.altText) ? item.altText! : "Answer image"
                }
                accessibilityHint="Tap to view image full screen with zoom and download"
              >
                <Image
                  source={{ uri: item.imageUrl as string }}
                  style={styles.answerImage}
                  resizeMode="cover"
                  onError={() => setFailedImages((prev) => ({ ...prev, [item.id]: true }))}
                  accessible={true}
                  accessibilityLabel={isValidAltText(item.altText) ? item.altText! : "Answer image"}
                />
                {isValidAltText(item.altText) && (
                  <AccessibleText variant="caption" style={[styles.altTextHint, { color: colors.subtext }]}>
                    Alt text: {item.altText}
                  </AccessibleText>
                )}
              </TouchableOpacity>
            )}

            {/* ACCEPT LINK FOR OWNER */}
            {/* Note: the accepted/solved green (#16A34A) is a semantic status
                color with no ThemeColors equivalent, so it is intentionally
                left as a literal here and in the stylesheet below. */}
            {isOwner && !isSolved && (satisfactionFlow || !isAccepted) && (
              <TouchableOpacity
                style={[styles.acceptLinkBtn, satisfactionFlow && styles.satisfactionHighlightBtn]}
                onPress={() => handleAcceptAnswer(item.id)}
                accessibilityRole="button"
                accessibilityLabel={satisfactionFlow ? "Mark this answer as the one that solved it" : "Mark this answer as accepted"}
              >
                <Check size={16} color={satisfactionFlow ? "#FFFFFF" : "#16A34A"} />
                <AccessibleText
                  variant="caption"
                  style={[styles.acceptLinkBtnText, satisfactionFlow && styles.satisfactionHighlightBtnText]}
                >
                  {satisfactionFlow ? "This Answer Solved It!" : "Mark Accepted"}
                </AccessibleText>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScreenWrapper statusBarStyle="dark" withBottomSafeArea={false}>
      {/* HEADER */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: Math.max(insets.top, 10),
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the previous screen"
        >
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <AccessibleText variant="title" style={[styles.headerTitle, { color: colors.text }]}>
          Discussion Details
        </AccessibleText>
        <TouchableOpacity
          onPress={() => setDyslexiaMode(!dyslexiaMode)}
          style={[
            styles.dyslexiaBtn,
            { backgroundColor: colors.surface },
            dyslexiaMode && { backgroundColor: colors.secondary },
            highContrast && { borderWidth: 2, borderColor: "#000000" },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Toggle dyslexia layout helper"
          accessibilityHint={
            dyslexiaMode
              ? "Turns off the dyslexia-friendly reading mode"
              : "Turns on the dyslexia-friendly reading mode"
          }
          accessibilityState={{ selected: dyslexiaMode }}
        >
          <Type size={18} color={dyslexiaMode ? "#FFFFFF" : colors.subtext} />
        </TouchableOpacity>
      </View>

      {/* CONTENT LIST */}
      <FlatList
        data={currentQuestion.answers || []}
        keyExtractor={(item) => item.id}
        renderItem={renderAnswerCard}
        ListHeaderComponent={renderQuestionHeader}
        contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom + 80, 100) }]}
        ListEmptyComponent={
          <View style={styles.emptyAnswers}>
            <MessageCircle size={32} color={colors.subtext} style={{ marginBottom: 8 }} />
            <AccessibleText variant="body" style={[styles.emptyAnswersText, { color: colors.subtext }]}>
              No answers posted yet.
            </AccessibleText>
            <AccessibleText variant="caption" style={[styles.emptyAnswersSubtitle, { color: colors.subtext }]}>
              Be the first to provide a helpful answer!
            </AccessibleText>
          </View>
        }
      />

      {/* FLOAT REPLY BUTTON */}
      {!isSolved && (
        <View style={[styles.replyFabWrapper, { bottom: Math.max(insets.bottom + 16, 24) }]} pointerEvents="box-none">
          <AccessibleButton
            variant="primary"
            accessibilityLabel="Post your answer"
            style={[styles.replyFab, { shadowColor: colors.primary }]}
            onPress={() => setIsAnswerModalOpen(true)}
          >
            <Plus size={22} color="#FFFFFF" style={{ marginRight: 6 }} />
            <AccessibleText variant="button" style={styles.replyFabText}>
              Answer
            </AccessibleText>
          </AccessibleButton>
        </View>
      )}

      {/* WRITE REPLY MODAL */}
      <CreateAnswerModal
        visible={isAnswerModalOpen}
        onClose={() => setIsAnswerModalOpen(false)}
        onSubmit={handlePostAnswer}
        loading={actionLoading}
      />

      {/* AI THREAD SUMMARY DRAWER MODAL */}
      <Modal
        visible={showSummaryDrawer}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSummaryDrawer(false)}
      >
        <View style={styles.drawerOverlay}>
          <View style={[styles.drawerContent, { backgroundColor: colors.card }]}>
            <View style={[styles.drawerHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.drawerTitleRow}>
                <Sparkles size={20} color={colors.secondary} style={{ marginRight: 6 }} />
                <AccessibleText variant="title" style={[styles.drawerTitle, { color: colors.text }]}>
                  AI Thread Summary
                </AccessibleText>
              </View>
              <TouchableOpacity
                onPress={() => setShowSummaryDrawer(false)}
                style={styles.drawerCloseBtn}
                accessibilityRole="button"
                accessibilityLabel="Close AI thread summary"
              >
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {loadingSummary ? (
              <View style={styles.drawerLoaderContainer}>
                <ActivityIndicator size="large" color={colors.secondary} />
                <AccessibleText variant="body" style={[styles.drawerLoaderText, { color: colors.secondary }]}>
                  Generating thread summary...
                </AccessibleText>
              </View>
            ) : (
              <ScrollView style={styles.drawerScroll}>
                <Markdown style={getMarkdownStyles(dyslexiaMode)}>
                  {currentQuestionSummary || "*No answers summarized yet. Thread ongoing.*"}
                </Markdown>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* REPORT REASON MODAL */}
      {/* No statusBarTranslucent: on Android it puts the modal window in a
          no-limits layout where adjustResize insets never reach it, so the
          keyboard avoidance below silently stops working and the details
          field ends up under the keyboard. The chat ReportModal — which is
          not reported as broken — also omits it. */}
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.reportBackdrop}>
          <TouchableWithoutFeedback onPress={() => setReportModalVisible(false)}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>

          {/* flex: 1 matters — KeyboardAvoidingView measures its own frame to
              compute the offset, and without it the frame is content-sized
              inside a flex-end parent, making the avoidance a no-op. */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ width: "100%", justifyContent: "flex-end", flex: 1 }}
            keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
          >
            <View style={[styles.reportContent, { backgroundColor: colors.card }]}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                <AccessibleText variant="title" style={[styles.reportTitle, { color: colors.text }]}>
                  Report {reportTarget?.type === "answer" ? "Answer" : "Post"}
                </AccessibleText>
                <AccessibleText variant="body" style={[styles.reportSubtitle, { color: colors.subtext }]}>
                  Select a reason for reporting this content:
                </AccessibleText>

                {/* Predefined reason chips */}
                <View style={styles.reportReasonGrid}>
                  {REPORT_REASONS.map((r) => (
                    <TouchableOpacity
                      key={r.key}
                      style={[
                        styles.reportReasonChip,
                        {
                          borderColor: reportReason === r.key ? colors.primary : colors.border,
                          backgroundColor: reportReason === r.key
                            ? (highContrast ? "#000" : "#F3E8FF")
                            : colors.surface,
                        },
                      ]}
                      onPress={() => setReportReason(r.key)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: reportReason === r.key }}
                      accessibilityLabel={r.label}
                    >
                      <AccessibleText
                        variant="caption"
                        style={{
                          color: reportReason === r.key
                            ? (highContrast ? "#fff" : colors.primary)
                            : colors.text,
                          fontWeight: reportReason === r.key ? "700" : "400",
                        }}
                      >
                        {r.label}
                      </AccessibleText>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Custom category input if 'Other' is chosen */}
                {reportReason === "OTHER" && (
                  <TextInput
                    style={[
                      styles.reportCustomInput,
                      { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                      highContrast && { borderWidth: 1, borderColor: "#000000" },
                    ]}
                    placeholder="Specify category (e.g. Copyright, Impersonation)"
                    placeholderTextColor={colors.subtext}
                    value={reportCustomCategory}
                    onChangeText={setReportCustomCategory}
                    maxLength={80}
                    autoCapitalize="sentences"
                    accessibilityLabel="Custom report category"
                  />
                )}

                {/* Optional details input */}
                <TextInput
                  style={[
                    styles.reportInput,
                    { backgroundColor: colors.surface, color: colors.text, marginTop: 12 },
                    highContrast && { borderWidth: 1, borderColor: "#000000" },
                  ]}
                  placeholder="Additional details (optional)"
                  placeholderTextColor={colors.subtext}
                  value={reportDetails}
                  onChangeText={setReportDetails}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  accessibilityLabel="Additional details"
                  accessibilityHint="Optionally add more context about this report"
                />

                <View style={styles.reportActions}>
                  <AccessibleButton
                    variant="outline"
                    accessibilityLabel="Cancel report"
                    style={styles.reportBtn}
                    onPress={() => setReportModalVisible(false)}
                  >
                    Cancel
                  </AccessibleButton>

                  <AccessibleButton
                    variant="danger"
                    accessibilityLabel="Submit report"
                    style={styles.reportBtn}
                    onPress={handleReportSubmit}
                    disabled={reportSubmitting || !reportReason || (reportReason === "OTHER" && !reportCustomCategory.trim())}
                  >
                    {reportSubmitting ? "Submitting..." : "Submit Report"}
                  </AccessibleButton>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* MEDIA VIEWER (Full Screen Zoom, Pan, Download, Share) */}
      <MediaViewer
        visible={!!selectedMedia}
        src={selectedMedia?.src || ""}
        alt={selectedMedia?.alt}
        isVideo={false}
        onClose={() => setSelectedMedia(null)}
      />
    </ScreenWrapper>
  );
};

export default QuestionDetailsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  loadingText: {
    marginTop: 12,
    fontWeight: "700"
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  errorText: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16
  },
  backBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  backButton: {
    padding: 8
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800"
  },
  dyslexiaBtn: {
    padding: 8,
    borderRadius: 8
  },
  listContent: {
    paddingBottom: 100
  },
  headerContainer: {
    paddingBottom: 2,
  },
  questionCard: {
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 16,
    marginTop: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  authorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  authorLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  authorInfo: {
    flex: 1,
    flexShrink: 1,
  },
  authorNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  repBadge: {
    borderWidth: 0.5,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  repText: {
    fontSize: 9,
    fontWeight: "bold"
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14
  },
  authorName: {
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
  },
  authorMeta: {
    fontSize: 11
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  optionIcon: {
    padding: 6,
    borderRadius: 6,
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
    marginBottom: 6,
    marginTop: 2
  },
  descriptionWrapper: {
    marginBottom: 8,
  },
  imageContainer: {
    marginVertical: 8,
  },
  questionImage: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    marginBottom: 4,
  },
  altTextHint: {
    fontSize: 11,
    fontStyle: "italic",
    marginBottom: 8
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
    marginBottom: 10
  },
  tagBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 6
  },
  tagText: {
    fontSize: 11,
    fontWeight: "700"
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 6
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16
  },
  statText: {
    fontSize: 12,
  },
  aiSummaryBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: "auto"
  },
  aiSummaryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 4
  },
  reopenButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderRadius: 10,
    marginTop: 12
  },
  reopenButtonText: {
    fontWeight: "700",
    fontSize: 13
  },
  satisfactionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    marginTop: 16
  },
  satisfactionTitle: {
    fontSize: 14,
    fontWeight: "800"
  },
  satisfactionSubtitle: {
    fontSize: 11,
    marginTop: 2
  },
  satisfactionButtons: {
    flexDirection: "row",
    marginLeft: 8
  },
  satBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 6
  },
  satBtnNoText: {
    fontSize: 12,
    fontWeight: "700"
  },
  satBtnYesText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  satHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4
  },
  satSelectTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#16A34A"
  },
  satSelectDesc: {
    fontSize: 12,
    lineHeight: 16
  },
  satCancelLink: {
    marginTop: 8,
    alignSelf: "flex-end"
  },
  satCancelLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#EF4444"
  },
  resolvedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    padding: 12,
    borderRadius: 12,
    marginTop: 16
  },
  resolvedBannerText: {
    color: "#15803D",
    fontWeight: "800",
    fontSize: 13
  },
  answersSectionHeader: {
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 4,
  },
  answersListHeader: {
    fontSize: 16,
    fontWeight: "800",
  },
  answerCard: {
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
    position: "relative"
  },
  acceptedAnswerCard: {
    borderWidth: 2,
    borderColor: "#16A34A",
    backgroundColor: "#F0FDF4",
    paddingTop: 32
  },
  acceptedMarker: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "#16A34A",
    borderBottomRightRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 1
  },
  acceptedMarkerText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5
  },
  answerContentRow: {
    flexDirection: "row",
    marginTop: 6
  },
  likeContainer: {
    marginRight: 12,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 2,
  },
  likeBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 14,
    minWidth: 42,
    gap: 4,
  },
  likeBtnActive: {
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  likeCount: {
    fontSize: 12,
    fontWeight: "700",
  },
  answerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10
  },
  answerAuthorInfo: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  answerAuthorName: {
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  answerTime: {
    fontSize: 10
  },
  answerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  answerActionIcon: {
    padding: 4,
  },
  answerImage: {
    width: "100%",
    height: 150,
    borderRadius: 12,
    resizeMode: "cover",
    marginBottom: 8,
    marginTop: 10
  },
  acceptLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4
  },
  acceptLinkBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#16A34A",
    marginLeft: 4
  },
  satisfactionHighlightBtn: {
    backgroundColor: "#16A34A",
    borderColor: "#16A34A"
  },
  satisfactionHighlightBtnText: {
    color: "#FFFFFF"
  },
  emptyAnswers: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20
  },
  emptyAnswersText: {
    fontSize: 14,
    fontWeight: "700"
  },
  emptyAnswersSubtitle: {
    fontSize: 12,
    marginTop: 4
  },
  replyFabWrapper: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  replyFab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8
  },
  replyFabText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14
  },
  // DRAWER MODAL
  drawerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end"
  },
  drawerContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: SCREEN_HEIGHT * 0.65,
    padding: 20
  },
  drawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingBottom: 14,
    marginBottom: 16
  },
  drawerTitleRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: "800"
  },
  drawerCloseBtn: {
    padding: 4
  },
  drawerLoaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  drawerLoaderText: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 10
  },
  drawerScroll: {
    flex: 1
  },
  // REPORT MODAL
  reportBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 30 : 24,
  },
  reportContent: {
    borderRadius: 28,
    width: "100%",
    paddingTop: 22,
    paddingHorizontal: 22,
    paddingBottom: 16,
    maxHeight: "92%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  reportTitle: {
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 6,
  },
  reportSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  reportReasonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  reportReasonChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  reportCustomInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    marginTop: 10,
  },
  reportInput: {
    borderRadius: 12,
    padding: 14,
    height: 80,
    fontSize: 14,
    marginBottom: 16,
  },
  reportActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 14,
    marginBottom: 16,
  },
  reportBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
});
