import React, { useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft } from "lucide-react-native";
import { useForumStore, ForumQuestion } from "../../store/forumStore";
import { ForumQuestionCard } from "../../components/shared/ForumQuestionCard";
import { EmptyState } from "../../components/shared/EmptyState";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";

const SolvedQuestionsScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const {
    questions,
    loading,
    nextCursor,
    setFilters,
    fetchQuestions,
    resetFilters
  } = useForumStore();

  useEffect(() => {
    resetFilters();
    setFilters({ status: "SOLVED" });
    fetchQuestions(true);
  }, []);

  const handleRefresh = () => {
    fetchQuestions(true);
  };

  const handleLoadMore = () => {
    if (!loading && nextCursor) {
      fetchQuestions(false);
    }
  };

  const renderSolvedCard = ({ item }: { item: ForumQuestion }) => {
    return (
      <ForumQuestionCard
        question={item}
        onPress={() => navigation.navigate("QuestionDetails", { questionId: item.id })}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <AccessibleText variant="title" style={[styles.headerTitle, { color: colors.text }]}>
          Resolved Q&A
        </AccessibleText>
        <View style={{ width: 40 }} />
      </View>

      {/* LIST */}
      <FlatList
        data={questions}
        keyExtractor={(item) => item.id}
        renderItem={renderSolvedCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading && questions.length === 0}
            onRefresh={handleRefresh}
            colors={["#16A34A"]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#16A34A" style={{ marginTop: 40 }} />
          ) : (
            <EmptyState
              title="No Resolved Questions"
              description="Solved discussions will appear here once marked as resolved by their owners."
            />
          )
        }
        ListFooterComponent={
          loading && questions.length > 0 ? (
            <ActivityIndicator
              size="small"
              color="#16A34A"
              style={{ marginVertical: 16 }}
            />
          ) : null
        }
      />
    </View>
  );
};

export default SolvedQuestionsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Note: light green hue is an intentional "resolved/solved" identity color
    // for this screen (matching the green accents used for solved status
    // elsewhere — resolvedBanner, solvedBadge, the loading spinner tint below).
    // It has no ThemeColors equivalent, so it's intentionally left as a
    // literal, consistent with how QuestionDetailsScreen.tsx treats this
    // same semantic color family.
    backgroundColor: "#F4FAF6"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  backBtn: {
    padding: 8
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800"
  },
  listContent: {
    padding: 16
  }
});
