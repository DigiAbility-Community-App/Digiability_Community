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
  Plus
} from "lucide-react-native";
import * as Speech from "expo-speech";
import Markdown from "react-native-markdown-display";
import { useForumStore, ForumAnswer } from "../../store/forumStore";
import { useAuthStore } from "../../store/authStore";
import CreateAnswerModal from "./CreateAnswerModal";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

function isValidImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim().toLowerCase();
  if (trimmed === "" || trimmed === "null" || trimmed === "undefined" || trimmed === "nothing" || trimmed.length < 8) return false;
  return trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:image/") || trimmed.startsWith("file://");
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

  const [satisfactionFlow, setSatisfactionFlow] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [dyslexiaMode, setDyslexiaMode] = useState(false);
  const [showSummaryDrawer, setShowSummaryDrawer] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    fetchQuestionDetails(questionId);
    fetchBookmarks();
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

  const openReportModal = (type: "question" | "answer", id: string) => {
    setReportTarget({ type, id });
    setReportReason("");
    setReportModalVisible(true);
  };

  const handleReportSubmit = async () => {
    if (!reportReason.trim()) {
      Alert.alert("Reason Required", "Please specify why you are reporting this content.");
      return;
    }

    try {
      const payload: any = { reason: reportReason.trim() };
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
      Alert.alert("Error", "Failed to submit report.");
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
      lineHeight: dyslexia ? 28 : 20,
      letterSpacing: dyslexia ? 1.6 : 0,
      fontWeight: dyslexia ? ("700" as const) : ("400" as const),
    },
    paragraph: {
      marginBottom: 10,
    }
  });

  const textStyle = dyslexiaMode
    ? { letterSpacing: 1.6, lineHeight: 28, fontWeight: "700" as const }
    : {};

  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" as const }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" as const };

  const renderQuestionHeader = () => (
    <View style={[styles.questionSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
      {/* AUTHOR DETAILS */}
      <View style={styles.authorRow}>
        <View style={styles.authorLeft}>
          <View style={[styles.avatar, { backgroundColor: colors.secondary }]}>
            <AccessibleText style={styles.avatarText}>
              {currentQuestion.author.name.charAt(0).toUpperCase()}
            </AccessibleText>
          </View>
          <View>
            <View style={styles.authorNameContainer}>
              <AccessibleText style={[styles.authorName, { color: colors.text }, textStyle]}>
                {currentQuestion.author.name}
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
            <AccessibleText variant="caption" style={[styles.authorMeta, { color: colors.subtext }]}>
              {currentQuestion.author.role?.toUpperCase()} •{" "}
              {formatPostDate(currentQuestion.createdAt)}
            </AccessibleText>
          </View>
        </View>

        {/* OPTIONS Row */}
        <View style={styles.optionsRow}>
          <TouchableOpacity
            onPress={() => handleSpeakText(currentQuestion.title + ". " + (currentQuestion.description || ""), currentQuestion.id)}
            style={styles.optionIcon}
            accessibilityRole="button"
            accessibilityLabel={speakingId === currentQuestion.id ? "Stop reading question aloud" : "Read question aloud"}
            accessibilityHint="Uses text-to-speech to read the question title and description"
          >
            {speakingId === currentQuestion.id ? (
              <VolumeX size={20} color={colors.error} />
            ) : (
              <Volume2 size={20} color={colors.subtext} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleToggleBookmark}
            style={styles.optionIcon}
            accessibilityRole="button"
            accessibilityLabel={isBookmarked ? "Remove bookmark" : "Bookmark this discussion"}
            accessibilityState={{ selected: isBookmarked }}
          >
            <Bookmark size={20} color={isBookmarked ? colors.badge : colors.subtext} fill={isBookmarked ? colors.badge : "none"} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => openReportModal("question", currentQuestion.id)}
            style={styles.optionIcon}
            accessibilityRole="button"
            accessibilityLabel="Report this question"
          >
            <Flag size={18} color={colors.subtext} />
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
        </View>
      </View>

      {/* QUESTION BODY */}
      <AccessibleText variant="title" style={[styles.questionTitle, { color: colors.text }, textStyle]}>
        {currentQuestion.title}
      </AccessibleText>
      {currentQuestion.description && (
        <Markdown style={getMarkdownStyles(dyslexiaMode)}>
          {currentQuestion.description}
        </Markdown>
      )}

      {/* QUESTION IMAGE */}
      {isValidImageUrl(currentQuestion.imageUrl) && (
        <View>
          <Image
            source={{ uri: currentQuestion.imageUrl as string }}
            style={styles.questionImage}
            accessible={true}
            accessibilityLabel={isValidAltText(currentQuestion.altText) ? currentQuestion.altText! : "Uploaded question image"}
          />
          {isValidAltText(currentQuestion.altText) && (
            <AccessibleText variant="caption" style={[styles.altTextHint, { color: colors.subtext }]}>
              Alt text: {currentQuestion.altText}
            </AccessibleText>
          )}
        </View>
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
      {/* Note: this success-state green is a semantic status color with no
          equivalent slot in ThemeColors, so it is intentionally left as a
          literal (consistent with how other converted screens treat
          success/error accent colors that fall outside the palette). */}
      {isSolved && (
        <View style={styles.resolvedBanner}>
          <CheckCircle2 size={18} color="#16A34A" style={{ marginRight: 8 }} />
          <AccessibleText variant="body" style={styles.resolvedBannerText}>
            This discussion has been resolved.
          </AccessibleText>
        </View>
      )}

      <AccessibleText variant="title" style={[styles.answersListHeader, { color: colors.text }]}>
        Answers ({currentQuestion.answers?.length ?? 0})
      </AccessibleText>
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
          {/* VOTING BUTTONS */}
          <View style={styles.votingContainer}>
            <TouchableOpacity
              style={styles.voteBtn}
              onPress={() => handleVote(item.id, "UP")}
              accessibilityRole="button"
              accessibilityLabel="Upvote this answer"
            >
              <ChevronUp size={24} color={colors.subtext} />
            </TouchableOpacity>
            <AccessibleText variant="body" style={[styles.voteCount, { color: colors.subtext }]}>
              {item.upvotes - item.downvotes}
            </AccessibleText>
            <TouchableOpacity
              style={styles.voteBtn}
              onPress={() => handleVote(item.id, "DOWN")}
              accessibilityRole="button"
              accessibilityLabel="Downvote this answer"
            >
              <ChevronDown size={24} color={colors.subtext} />
            </TouchableOpacity>
          </View>

          {/* ANSWER BODY */}
          <View style={{ flex: 1 }}>
            {/* META */}
            <View style={styles.answerHeader}>
              <View>
                <View style={styles.authorNameContainer}>
                  <AccessibleText style={[styles.answerAuthorName, { color: colors.text }, textStyle]}>
                    {item.author.name}
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
                <AccessibleText variant="caption" style={[styles.answerTime, { color: colors.subtext }]}>
                  {item.author.role?.toUpperCase()} •{" "}
                  {formatPostDate(item.createdAt)}
                </AccessibleText>
              </View>

              <View style={styles.answerActions}>
                <TouchableOpacity
                  onPress={() => handleSpeakText(item.content || "", item.id)}
                  style={{ marginRight: 12 }}
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
                    style={{ marginRight: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Delete this answer"
                  >
                    <Trash2 size={16} color={colors.error} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => openReportModal("answer", item.id)}
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

            {/* IMAGE */}
            {isValidImageUrl(item.imageUrl) && (
              <View>
                <Image
                  source={{ uri: item.imageUrl as string }}
                  style={styles.answerImage}
                  accessible={true}
                  accessibilityLabel={isValidAltText(item.altText) ? item.altText! : "Answer image"}
                />
                {isValidAltText(item.altText) && (
                  <AccessibleText variant="caption" style={[styles.altTextHint, { color: colors.subtext }]}>
                    Alt text: {item.altText}
                  </AccessibleText>
                )}
              </View>
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the previous screen"
        >
          <ArrowLeft size={24} color={colors.text} />
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
          accessibilityHint={dyslexiaMode ? "Turns off the dyslexia-friendly reading mode" : "Turns on the dyslexia-friendly reading mode"}
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
        contentContainerStyle={styles.listContent}
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
      {/* The absolute positioning lives on this wrapper View, NOT on the
          AccessibleButton: AccessibleButton applies its `style` to an inner
          Animated.View, so position:absolute there collapses the outer
          Pressable (the touch target) to 0×0 and taps do nothing. */}
      {!isSolved && (
        <View style={styles.replyFabWrapper} pointerEvents="box-none">
          <AccessibleButton
            variant="primary"
            accessibilityLabel="Post your answer"
            style={[styles.replyFab, { shadowColor: colors.primary }]}
            onPress={() => setIsAnswerModalOpen(true)}
          >
            <Plus size={24} color="#FFFFFF" style={{ marginRight: 6 }} />
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
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReportModalVisible(false)}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={() => setReportModalVisible(false)}>
          <View style={styles.reportOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ width: "100%", alignItems: "center" }}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={[styles.reportContent, { backgroundColor: colors.card }]}>
                  <AccessibleText variant="title" style={[styles.reportTitle, { color: colors.text }]}>
                    Report Content
                  </AccessibleText>
                  <AccessibleText variant="body" style={[styles.reportSubtitle, { color: colors.subtext }]}>
                    Why are you reporting this {reportTarget?.type}? Please provide a reason:
                  </AccessibleText>

                  <TextInput
                    style={[
                      styles.reportInput,
                      { backgroundColor: colors.surface, color: colors.text },
                      highContrast && { borderWidth: 1, borderColor: "#000000" },
                    ]}
                    placeholder="e.g. Abusive behavior, spam, misinformation..."
                    placeholderTextColor={colors.subtext}
                    value={reportReason}
                    onChangeText={setReportReason}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    accessibilityLabel="Report reason"
                    accessibilityHint="Explain why you are reporting this content"
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
                    >
                      Submit Report
                    </AccessibleButton>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
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
  questionSection: {
    padding: 20,
    borderBottomWidth: 1
  },
  authorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16
  },
  authorLeft: {
    flexDirection: "row",
    alignItems: "center"
  },
  authorNameContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  repBadge: {
    borderWidth: 0.5,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 6
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
    fontWeight: "700"
  },
  authorMeta: {
    fontSize: 11
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  optionIcon: {
    padding: 6,
    marginLeft: 6
  },
  questionTitle: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
    marginBottom: 10
  },
  questionImage: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    resizeMode: "cover",
    marginBottom: 8,
    marginTop: 10
  },
  altTextHint: {
    fontSize: 11,
    fontStyle: "italic",
    marginBottom: 14
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 14,
    marginTop: 8
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
    marginLeft: 4,
    fontWeight: "600"
  },
  aiSummaryBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: "auto"
  },
  aiSummaryBadgeText: {
    fontSize: 11,
    fontWeight: "700"
  },
  reopenButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 14
  },
  reopenButtonText: {
    fontSize: 12,
    fontWeight: "700"
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
  answersListHeader: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 24
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
    backgroundColor: "#F0FDF4"
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
  votingContainer: {
    alignItems: "center",
    marginRight: 12,
    width: 32
  },
  voteBtn: {
    padding: 4
  },
  voteCount: {
    fontSize: 14,
    fontWeight: "800",
    marginVertical: 2
  },
  answerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10
  },
  answerAuthorName: {
    fontSize: 13,
    fontWeight: "700"
  },
  answerTime: {
    fontSize: 10
  },
  answerActions: {
    flexDirection: "row",
    alignItems: "center"
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
  reportOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  reportContent: {
    borderRadius: 20,
    width: "100%",
    padding: 20
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8
  },
  reportSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12
  },
  reportInput: {
    borderRadius: 10,
    padding: 12,
    height: 80,
    fontSize: 14,
    marginBottom: 16
  },
  reportActions: {
    flexDirection: "row",
    gap: 10
  },
  reportBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center"
  }
});
