import React, { useEffect } from "react";
import {
  View,
  Text,
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

const SolvedQuestionsScreen = () => {
  const navigation = useNavigation<any>();
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#1A1B20" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Resolved Q&A</Text>
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
    backgroundColor: "#F4FAF6" // light green hue
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E8EAE6"
  },
  backBtn: {
    padding: 8
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1B20"
  },
  listContent: {
    padding: 16
  }
});
