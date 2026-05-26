import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  TextInput,
  Dimensions,
  ScrollView
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

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const QuestionDetailsScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { questionId } = route.params;

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#500088" />
        <Text style={styles.loadingText}>Loading discussion...</Text>
      </View>
    );
  }

  if (!currentQuestion) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Discussion not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
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
      color: dyslexia ? "#000000" : "#374151",
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

  const renderQuestionHeader = () => (
    <View style={styles.questionSection}>
      {/* AUTHOR DETAILS */}
      <View style={styles.authorRow}>
        <View style={styles.authorLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {currentQuestion.author.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <View style={styles.authorNameContainer}>
              <Text style={[styles.authorName, textStyle]}>{currentQuestion.author.name}</Text>
              {currentQuestion.author.forumStats && currentQuestion.author.forumStats.reputation > 0 && (
                <View style={styles.repBadge}>
                  <Text style={styles.repText}>★ {currentQuestion.author.forumStats.reputation}</Text>
                </View>
              )}
            </View>
            <Text style={styles.authorMeta}>
              {currentQuestion.author.role?.toUpperCase()} •{" "}
              {new Date(currentQuestion.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* OPTIONS Row */}
        <View style={styles.optionsRow}>
          <TouchableOpacity onPress={() => handleSpeakText(currentQuestion.title + ". " + (currentQuestion.description || ""), currentQuestion.id)} style={styles.optionIcon}>
            {speakingId === currentQuestion.id ? (
              <VolumeX size={20} color="#EF4444" />
            ) : (
              <Volume2 size={20} color="#6B7280" />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleToggleBookmark} style={styles.optionIcon}>
            <Bookmark size={20} color={isBookmarked ? "#FBBF24" : "#6B7280"} fill={isBookmarked ? "#FBBF24" : "none"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openReportModal("question", currentQuestion.id)} style={styles.optionIcon}>
            <Flag size={18} color="#6B7280" />
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity onPress={handleDeleteQuestion} style={styles.optionIcon}>
              <Trash2 size={18} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* QUESTION BODY */}
      <Text style={[styles.questionTitle, textStyle]}>{currentQuestion.title}</Text>
      {currentQuestion.description && (
        <Markdown style={getMarkdownStyles(dyslexiaMode)}>
          {currentQuestion.description}
        </Markdown>
      )}

      {/* QUESTION IMAGE */}
      {currentQuestion.imageUrl && (
        <View>
          <Image
            source={{ uri: currentQuestion.imageUrl }}
            style={styles.questionImage}
            accessible={true}
            accessibilityLabel={currentQuestion.altText || "Uploaded question image"}
          />
          {currentQuestion.altText && (
            <Text style={styles.altTextHint}>Alt text: {currentQuestion.altText}</Text>
          )}
        </View>
      )}

      {/* QUESTION FOOTER / TAGS */}
      <View style={styles.tagsContainer}>
        {currentQuestion.tags.map((tag) => (
          <View key={tag.id} style={styles.tagBadge}>
            <Text style={styles.tagText}>#{tag.name.toLowerCase()}</Text>
          </View>
        ))}
      </View>

      {/* VIEW COUNT & VIEWS */}
      <View style={styles.statRow}>
        <View style={styles.statItem}>
          <Eye size={14} color="#6B7280" />
          <Text style={styles.statText}>{currentQuestion.views} Views</Text>
        </View>
        <View style={styles.statItem}>
          <MessageCircle size={14} color="#6B7280" />
          <Text style={styles.statText}>{currentQuestion.answerCount} Answers</Text>
        </View>
        
        {/* AI SUMMARY ACTION */}
        {hasAnswers && (
          <TouchableOpacity style={styles.aiSummaryBadge} onPress={handleOpenSummary}>
            <Sparkles size={13} color="#7E22CE" style={{ marginRight: 4 }} />
            <Text style={styles.aiSummaryBadgeText}>AI Summary</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* OWNER REOPEN CONTROLLER */}
      {isOwner && isSolved && (
        <TouchableOpacity style={styles.reopenButton} onPress={handleReopen}>
          <RotateCcw size={16} color="#7E22CE" style={{ marginRight: 6 }} />
          <Text style={styles.reopenButtonText}>Reopen Discussion</Text>
        </TouchableOpacity>
      )}

      {/* SATISFACTION SURVEY PROMPT */}
      {isOwner && !isSolved && hasAnswers && (
        <View style={styles.satisfactionCard}>
          {!satisfactionFlow ? (
            <>
              <HelpCircle size={20} color="#7E22CE" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.satisfactionTitle}>Did this solve your problem?</Text>
                <Text style={styles.satisfactionSubtitle}>
                  Help others in the community by highlighting the answer.
                </Text>
              </View>
              <View style={styles.satisfactionButtons}>
                <TouchableOpacity
                  style={[styles.satBtn, styles.satBtnNo]}
                  onPress={() => Alert.alert("Tip", "You can wait for more replies from other community members!")}
                >
                  <Text style={styles.satBtnNoText}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.satBtn, styles.satBtnYes]}
                  onPress={() => setSatisfactionFlow(true)}
                >
                  <Text style={styles.satBtnYesText}>Yes</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={{ flex: 1 }}>
              <View style={styles.satHeaderRow}>
                <CheckCircle2 size={18} color="#16A34A" style={{ marginRight: 8 }} />
                <Text style={styles.satSelectTitle}>Which answer solved your issue?</Text>
              </View>
              <Text style={styles.satSelectDesc}>
                Scroll down and tap the checkmark icon (<Check size={12} color="#4B5563" />) on the answer that helped you.
              </Text>
              <TouchableOpacity style={styles.satCancelLink} onPress={() => setSatisfactionFlow(false)}>
                <Text style={styles.satCancelLinkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* RESOLVED STATE BANNER */}
      {isSolved && (
        <View style={styles.resolvedBanner}>
          <CheckCircle2 size={18} color="#16A34A" style={{ marginRight: 8 }} />
          <Text style={styles.resolvedBannerText}>This discussion has been resolved.</Text>
        </View>
      )}

      <Text style={styles.answersListHeader}>Answers ({currentQuestion.answers?.length ?? 0})</Text>
    </View>
  );

  const renderAnswerCard = ({ item }: { item: ForumAnswer }) => {
    const isAnswerAuthor = item.authorId === user?.id;
    const isAccepted = item.isAccepted;

    return (
      <View style={[styles.answerCard, isAccepted && styles.acceptedAnswerCard]}>
        {/* ACCEPTED CORNER MARK */}
        {isAccepted && (
          <View style={styles.acceptedMarker}>
            <CheckCircle2 size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.acceptedMarkerText}>ACCEPTED ANSWER</Text>
          </View>
        )}

        <View style={styles.answerContentRow}>
          {/* VOTING BUTTONS */}
          <View style={styles.votingContainer}>
            <TouchableOpacity style={styles.voteBtn} onPress={() => handleVote(item.id, "UP")}>
              <ChevronUp size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.voteCount}>{item.upvotes - item.downvotes}</Text>
            <TouchableOpacity style={styles.voteBtn} onPress={() => handleVote(item.id, "DOWN")}>
              <ChevronDown size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* ANSWER BODY */}
          <View style={{ flex: 1 }}>
            {/* META */}
            <View style={styles.answerHeader}>
              <View>
                <View style={styles.authorNameContainer}>
                  <Text style={[styles.answerAuthorName, textStyle]}>{item.author.name}</Text>
                  {item.author.forumStats && item.author.forumStats.reputation > 0 && (
                    <View style={styles.repBadge}>
                      <Text style={styles.repText}>★ {item.author.forumStats.reputation}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.answerTime}>
                  {item.author.role?.toUpperCase()} •{" "}
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
              
              <View style={styles.answerActions}>
                <TouchableOpacity onPress={() => handleSpeakText(item.content || "", item.id)} style={{ marginRight: 12 }}>
                  {speakingId === item.id ? (
                    <VolumeX size={16} color="#EF4444" />
                  ) : (
                    <Volume2 size={16} color="#6B7280" />
                  )}
                </TouchableOpacity>
                {isAnswerAuthor && (
                  <TouchableOpacity onPress={() => handleDeleteAnswer(item.id)} style={{ marginRight: 12 }}>
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => openReportModal("answer", item.id)}>
                  <Flag size={16} color="#6B7280" />
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
            {item.imageUrl && (
              <View>
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.answerImage}
                  accessible={true}
                  accessibilityLabel={item.altText || "Answer image"}
                />
                {item.altText && (
                  <Text style={styles.altTextHint}>Alt text: {item.altText}</Text>
                )}
              </View>
            )}

            {/* ACCEPT LINK FOR OWNER */}
            {isOwner && !isSolved && (satisfactionFlow || !isAccepted) && (
              <TouchableOpacity
                style={[styles.acceptLinkBtn, satisfactionFlow && styles.satisfactionHighlightBtn]}
                onPress={() => handleAcceptAnswer(item.id)}
              >
                <Check size={16} color={satisfactionFlow ? "#FFFFFF" : "#16A34A"} />
                <Text style={[styles.acceptLinkBtnText, satisfactionFlow && styles.satisfactionHighlightBtnText]}>
                  {satisfactionFlow ? "This Answer Solved It!" : "Mark Accepted"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color="#1A1B20" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Discussion Details</Text>
        <TouchableOpacity
          onPress={() => setDyslexiaMode(!dyslexiaMode)}
          style={[styles.dyslexiaBtn, dyslexiaMode && styles.dyslexiaBtnActive]}
          accessibilityRole="button"
          accessibilityLabel="Toggle dyslexia layout helper"
        >
          <Type size={18} color={dyslexiaMode ? "#FFFFFF" : "#6B7280"} />
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
            <MessageCircle size={32} color="#9CA3AF" style={{ marginBottom: 8 }} />
            <Text style={styles.emptyAnswersText}>No answers posted yet.</Text>
            <Text style={styles.emptyAnswersSubtitle}>
              Be the first to provide a helpful answer!
            </Text>
          </View>
        }
      />

      {/* FLOAT REPLY BUTTON */}
      {!isSolved && (
        <TouchableOpacity
          style={styles.replyFab}
          onPress={() => setIsAnswerModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Post your answer"
        >
          <Plus size={24} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.replyFabText}>Answer</Text>
        </TouchableOpacity>
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
          <View style={styles.drawerContent}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerTitleRow}>
                <Sparkles size={20} color="#7E22CE" style={{ marginRight: 6 }} />
                <Text style={styles.drawerTitle}>AI Thread Summary</Text>
              </View>
              <TouchableOpacity onPress={() => setShowSummaryDrawer(false)} style={styles.drawerCloseBtn}>
                <X size={20} color="#1A1B20" />
              </TouchableOpacity>
            </View>

            {loadingSummary ? (
              <View style={styles.drawerLoaderContainer}>
                <ActivityIndicator size="large" color="#7E22CE" />
                <Text style={styles.drawerLoaderText}>Generating thread summary...</Text>
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
      >
        <View style={styles.reportOverlay}>
          <View style={styles.reportContent}>
            <Text style={styles.reportTitle}>Report Content</Text>
            <Text style={styles.reportSubtitle}>
              Why are you reporting this {reportTarget?.type}? Please provide a reason:
            </Text>

            <TextInput
              style={styles.reportInput}
              placeholder="e.g. Abusive behavior, spam, misinformation..."
              placeholderTextColor="#9CA3AF"
              value={reportReason}
              onChangeText={setReportReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.reportActions}>
              <TouchableOpacity
                style={[styles.reportBtn, styles.reportCancelBtn]}
                onPress={() => setReportModalVisible(false)}
              >
                <Text style={styles.reportCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reportBtn, styles.reportSubmitBtn]}
                onPress={handleReportSubmit}
              >
                <Text style={styles.reportSubmitText}>Submit Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default QuestionDetailsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF8FF"
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAF8FF"
  },
  loadingText: {
    marginTop: 12,
    color: "#500088",
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
    color: "#EF4444",
    fontWeight: "700",
    marginBottom: 16
  },
  backBtn: {
    backgroundColor: "#500088",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  backBtnText: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEDF4"
  },
  backButton: {
    padding: 8
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1B20"
  },
  dyslexiaBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F3F4F6"
  },
  dyslexiaBtnActive: {
    backgroundColor: "#7E22CE"
  },
  listContent: {
    paddingBottom: 100
  },
  questionSection: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEDF4"
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
    backgroundColor: "#FFFBEB",
    borderColor: "#FBBF24",
    borderWidth: 0.5,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginLeft: 6
  },
  repText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#D97706"
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#9333EA",
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
    color: "#1A1B20"
  },
  authorMeta: {
    fontSize: 11,
    color: "#6B7280"
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
    color: "#1A1B20",
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
    color: "#6B7280",
    marginBottom: 14
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 14,
    marginTop: 8
  },
  tagBadge: {
    backgroundColor: "#F4F3FA",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    marginBottom: 6
  },
  tagText: {
    color: "#661AA3",
    fontSize: 11,
    fontWeight: "700"
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
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
    color: "#6B7280",
    marginLeft: 4,
    fontWeight: "600"
  },
  aiSummaryBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF5FF",
    borderWidth: 0.5,
    borderColor: "#D8B4FE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: "auto"
  },
  aiSummaryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7E22CE"
  },
  reopenButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 14
  },
  reopenButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7E22CE"
  },
  satisfactionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F3FF",
    borderWidth: 1.5,
    borderColor: "#C084FC",
    borderRadius: 16,
    padding: 16,
    marginTop: 16
  },
  satisfactionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#581C87"
  },
  satisfactionSubtitle: {
    fontSize: 11,
    color: "#7E22CE",
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
  satBtnNo: {
    backgroundColor: "#E5E7EB"
  },
  satBtnNoText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4B5563"
  },
  satBtnYes: {
    backgroundColor: "#7E22CE"
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
    color: "#374151",
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
    color: "#4C4452",
    marginTop: 24
  },
  answerCard: {
    backgroundColor: "#FFFFFF",
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
    color: "#4B5563",
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
    fontWeight: "700",
    color: "#1A1B20"
  },
  answerTime: {
    fontSize: 10,
    color: "#6B7280"
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
    fontWeight: "700",
    color: "#4B5563"
  },
  emptyAnswersSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4
  },
  replyFab: {
    position: "absolute",
    bottom: 20,
    left: "50%",
    transform: [{ translateX: -60 }],
    backgroundColor: "#500088",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: "#500088",
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
    backgroundColor: "#FFFFFF",
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
    borderBottomColor: "#EEEDF4",
    paddingBottom: 14,
    marginBottom: 16
  },
  drawerTitleRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1B20"
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
    color: "#7E22CE",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    width: "100%",
    padding: 20
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1B20",
    marginBottom: 8
  },
  reportSubtitle: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 18,
    marginBottom: 12
  },
  reportInput: {
    backgroundColor: "#F4F3FA",
    borderRadius: 10,
    padding: 12,
    height: 80,
    fontSize: 14,
    color: "#1A1B20",
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
  },
  reportCancelBtn: {
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  reportSubmitBtn: {
    backgroundColor: "#EF4444"
  },
  reportCancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4B5563"
  },
  reportSubmitText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF"
  }
});
