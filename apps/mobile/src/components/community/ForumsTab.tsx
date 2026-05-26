import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ScrollView,
  ActivityIndicator,
  RefreshControl
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Search, Plus } from "lucide-react-native";
import { useForumStore, ForumQuestion } from "../../store/forumStore";
import { ForumQuestionCard } from "../shared/ForumQuestionCard";
import { ForumSkeletonCard } from "../shared/ForumSkeletonCard";
import { EmptyState } from "../shared/EmptyState";

const CATEGORIES = [
  { id: "all", name: "All", emoji: "🌐" },
  { id: "Healthcare", name: "Healthcare", emoji: "🏥" },
  { id: "Government Schemes", name: "Schemes", emoji: "📜" },
  { id: "Accessibility", name: "Accessibility", emoji: "♿" },
  { id: "Education", name: "Education", emoji: "🎓" },
  { id: "Jobs", name: "Jobs", emoji: "💼" },
  { id: "Mental Health", name: "Mental Health", emoji: "🧠" },
  { id: "Legal Help", name: "Legal Help", emoji: "⚖️" },
  { id: "Assistive Technology", name: "Assistive Tech", emoji: "💻" },
  { id: "Caregiver Support", name: "Caregiver", emoji: "🤝" },
  { id: "Community", name: "Community", emoji: "👥" }
];

const ForumsTab = () => {
  const navigation = useNavigation<any>();
  const {
    questions,
    loading,
    filters,
    nextCursor,
    setFilters,
    fetchQuestions,
    resetFilters
  } = useForumStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    resetFilters();
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

  const handleSearchSubmit = () => {
    setFilters({ search: searchQuery });
    fetchQuestions(true);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setFilters({
      category: categoryId === "all" ? undefined : categoryId
    });
    fetchQuestions(true);
  };

  const handleSortSelect = (sortType: "newest" | "popular" | "answers") => {
    setFilters({ sort: sortType });
    fetchQuestions(true);
  };

  const renderPostCard = ({ item }: { item: ForumQuestion }) => (
    <ForumQuestionCard
      question={item}
      onPress={() => navigation.navigate("QuestionDetails", { questionId: item.id })}
    />
  );

  return (
    <View style={styles.container}>
      {/* SEARCH AND FILTERS CONTAINER */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={18} color="#6B7280" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search questions..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
        </View>

        {/* CATEGORY SELECTOR */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryBtn, active && styles.activeCategoryBtn]}
                onPress={() => handleCategorySelect(cat.id)}
              >
                <Text style={styles.categoryBtnText}>
                  {cat.emoji} {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* SORT ROW */}
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>SORT BY</Text>
          <View style={styles.sortButtons}>
            <TouchableOpacity
              style={[
                styles.sortBtn,
                filters.sort === "newest" && styles.activeSortBtn
              ]}
              onPress={() => handleSortSelect("newest")}
            >
              <Text
                style={[
                  styles.sortBtnText,
                  filters.sort === "newest" && styles.activeSortBtnText
                ]}
              >
                Latest
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sortBtn,
                filters.sort === "popular" && styles.activeSortBtn
              ]}
              onPress={() => handleSortSelect("popular")}
            >
              <Text
                style={[
                  styles.sortBtnText,
                  filters.sort === "popular" && styles.activeSortBtnText
                ]}
              >
                Top Views
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sortBtn,
                filters.sort === "answers" && styles.activeSortBtn
              ]}
              onPress={() => handleSortSelect("answers")}
            >
              <Text
                style={[
                  styles.sortBtnText,
                  filters.sort === "answers" && styles.activeSortBtnText
                ]}
              >
                Comments
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* QUESTIONS LIST */}
      <FlatList
        data={questions}
        keyExtractor={(item) => item.id}
        renderItem={renderPostCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading && questions.length === 0}
            onRefresh={handleRefresh}
            colors={["#500088"]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          loading ? (
            <View>
              <ForumSkeletonCard />
              <ForumSkeletonCard />
              <ForumSkeletonCard />
            </View>
          ) : (
            <EmptyState
              title="No Questions Found"
              description="Be the first to ask a question in this category or start a discussion."
              actionLabel="Ask a Question"
              onActionPress={() => navigation.navigate("AskQuestion")}
            />
          )
        }
        ListFooterComponent={
          loading && questions.length > 0 ? (
            <ActivityIndicator
              size="small"
              color="#500088"
              style={{ marginVertical: 16 }}
            />
          ) : null
        }
      />

      {/* FLOATING ACTION BUTTON */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("AskQuestion")}
        accessibilityRole="button"
        accessibilityLabel="Ask a new question"
      >
        <Plus size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

export default ForumsTab;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF8FF"
  },
  searchSection: {
    paddingTop: 16,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEDF4"
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F3FA",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 12
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1A1B20",
    fontWeight: "500"
  },
  categoryScroll: {
    paddingBottom: 12
  },
  categoryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F4F3FA",
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center"
  },
  activeCategoryBtn: {
    backgroundColor: "#E2D3FD",
    borderWidth: 1,
    borderColor: "#9333EA"
  },
  categoryBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4C4452"
  },
  sortRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F4F3FA"
  },
  sortLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#9CA3AF",
    letterSpacing: 0.5
  },
  sortButtons: {
    flexDirection: "row"
  },
  sortBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    marginLeft: 6
  },
  activeSortBtn: {
    backgroundColor: "#500088"
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280"
  },
  activeSortBtnText: {
    color: "#FFFFFF"
  },
  listContent: {
    padding: 16,
    paddingBottom: 100
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#500088",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#500088",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8
  }
});