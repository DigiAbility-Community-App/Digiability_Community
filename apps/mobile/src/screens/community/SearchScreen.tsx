import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft, Search, Filter } from "lucide-react-native";
import { useForumStore, ForumQuestion } from "../../store/forumStore";
import { ForumQuestionCard } from "../../components/shared/ForumQuestionCard";
import { EmptyState } from "../../components/shared/EmptyState";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";

const CATEGORIES = [
  "Healthcare",
  "Government Schemes",
  "Accessibility",
  "Education",
  "Jobs",
  "Mental Health",
  "Legal Help",
  "Assistive Technology",
  "Caregiver Support",
  "Community",
  "Document",
  "Others"
];

const SearchScreen = () => {
  const navigation = useNavigation<any>();
  const { colors, highContrast } = useTheme();
  const {
    questions,
    loading,
    nextCursor,
    setFilters,
    fetchQuestions,
    resetFilters
  } = useForumStore();

  const [keyword, setKeyword] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<"SOLVED" | "UNSOLVED" | null>(null);

  useEffect(() => {
    resetFilters();
  }, []);

  const handleSearch = () => {
    setFilters({
      search: keyword.trim() || undefined,
      category: selectedCategory || undefined,
      status: selectedStatus || undefined
    });
    fetchQuestions(true);
  };

  const handleClearFilters = () => {
    setKeyword("");
    setSelectedCategory(null);
    setSelectedStatus(null);
    resetFilters();
    fetchQuestions(true);
  };

  const handleLoadMore = () => {
    if (!loading && nextCursor) {
      fetchQuestions(false);
    }
  };

  const renderSearchCard = ({ item }: { item: ForumQuestion }) => (
    <ForumQuestionCard
      question={item}
      onPress={() => navigation.navigate("QuestionDetails", { questionId: item.id })}
    />
  );

  const activeAccentBg = highContrast ? "#FFFFFF" : "#E2D3FD";
  const activeAccentBorder = highContrast ? "#000000" : "#9333EA";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
          Advanced Search
        </AccessibleText>
        <TouchableOpacity
          onPress={handleClearFilters}
          accessibilityRole="button"
          accessibilityLabel="Clear all filters"
        >
          <AccessibleText variant="body" style={[styles.clearText, { color: colors.error }]}>
            Clear
          </AccessibleText>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={[styles.filterSection, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* KEYWORD INPUT */}
        <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
          <Search size={18} color={colors.subtext} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Type search terms..."
            placeholderTextColor={colors.subtext}
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={handleSearch}
            accessibilityLabel="Search keyword"
            accessibilityHint="Type search terms and submit to filter discussions"
          />
        </View>

        {/* STATUS FILTER */}
        <AccessibleText variant="overline" style={styles.sectionLabel}>
          DISCUSSION STATUS
        </AccessibleText>
        <View style={styles.statusRow}>
          <TouchableOpacity
            style={[
              styles.statusBtn,
              { backgroundColor: colors.surface },
              selectedStatus === "SOLVED" && { backgroundColor: activeAccentBg, borderWidth: 1, borderColor: activeAccentBorder },
            ]}
            onPress={() => setSelectedStatus(selectedStatus === "SOLVED" ? null : "SOLVED")}
            accessibilityRole="button"
            accessibilityLabel="Filter: Solved discussions"
            accessibilityState={{ selected: selectedStatus === "SOLVED" }}
          >
            <AccessibleText
              variant="caption"
              style={[styles.statusBtnText, { color: selectedStatus === "SOLVED" ? colors.secondary : colors.text }]}
            >
              Solved
            </AccessibleText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statusBtn,
              { backgroundColor: colors.surface },
              selectedStatus === "UNSOLVED" && { backgroundColor: activeAccentBg, borderWidth: 1, borderColor: activeAccentBorder },
            ]}
            onPress={() => setSelectedStatus(selectedStatus === "UNSOLVED" ? null : "UNSOLVED")}
            accessibilityRole="button"
            accessibilityLabel="Filter: Unsolved discussions"
            accessibilityState={{ selected: selectedStatus === "UNSOLVED" }}
          >
            <AccessibleText
              variant="caption"
              style={[styles.statusBtnText, { color: selectedStatus === "UNSOLVED" ? colors.secondary : colors.text }]}
            >
              Unsolved
            </AccessibleText>
          </TouchableOpacity>
        </View>

        {/* CATEGORY SELECTOR */}
        <AccessibleText variant="overline" style={styles.sectionLabel}>
          CATEGORIES
        </AccessibleText>
        <View style={styles.categoriesContainer}>
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.catBadge, { backgroundColor: active ? colors.primary : colors.surface }]}
                onPress={() => setSelectedCategory(active ? null : cat)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by category: ${cat}`}
                accessibilityState={{ selected: active }}
              >
                <AccessibleText variant="caption" style={[styles.catText, { color: active ? "#FFFFFF" : colors.text }]}>
                  {cat}
                </AccessibleText>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* SEARCH TRIGGER */}
        <AccessibleButton
          variant="primary"
          accessibilityLabel="Search discussions"
          accessibilityHint="Applies the selected keyword and filters"
          style={styles.searchBtn}
          onPress={handleSearch}
        >
          Search Discussions
        </AccessibleButton>
      </ScrollView>

      {/* RESULTS LIST */}
      <View style={{ flex: 1 }}>
        <AccessibleText variant="label" style={[styles.resultsHeader, { color: colors.text }]}>
          Search Results ({questions.length})
        </AccessibleText>

        <FlatList
          data={questions}
          keyExtractor={(item) => item.id}
          renderItem={renderSearchCard}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
            ) : (
              <EmptyState
                title="No Discussions Found"
                description="Use the filters above to find specific community questions or try a different keyword."
              />
            )
          }
          ListFooterComponent={
            loading && questions.length > 0 ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginVertical: 16 }}
              />
            ) : null
          }
        />
      </View>
    </View>
  );
};

export default SearchScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1
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
  clearText: {
    fontSize: 14,
    fontWeight: "700"
  },
  filterSection: {
    padding: 16,
    borderBottomWidth: 1,
    maxHeight: 320
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500"
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 8
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16
  },
  statusBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 10
  },
  statusBtnText: {
    fontSize: 12,
    fontWeight: "700"
  },
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16
  },
  catBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  catText: {
    fontSize: 11,
    fontWeight: "600"
  },
  searchBtn: {
    height: 44,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 12
  },
  resultsHeader: {
    fontSize: 13,
    fontWeight: "800",
    paddingHorizontal: 16,
    paddingTop: 16
  },
  listContent: {
    padding: 16
  }
});
