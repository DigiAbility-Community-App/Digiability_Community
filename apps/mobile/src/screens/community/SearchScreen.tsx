import React, { useState, useEffect } from "react";
import {
  View,
  Text,
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
  "Community"
];

const SearchScreen = () => {
  const navigation = useNavigation<any>();
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

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#1A1B20" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Advanced Search</Text>
        <TouchableOpacity onPress={handleClearFilters}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.filterSection} keyboardShouldPersistTaps="handled">
        {/* KEYWORD INPUT */}
        <View style={styles.searchBar}>
          <Search size={18} color="#6B7280" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Type search terms..."
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={handleSearch}
          />
        </View>

        {/* STATUS FILTER */}
        <Text style={styles.sectionLabel}>DISCUSSION STATUS</Text>
        <View style={styles.statusRow}>
          <TouchableOpacity
            style={[styles.statusBtn, selectedStatus === "SOLVED" && styles.activeStatusBtn]}
            onPress={() => setSelectedStatus(selectedStatus === "SOLVED" ? null : "SOLVED")}
          >
            <Text style={[styles.statusBtnText, selectedStatus === "SOLVED" && styles.activeStatusBtnText]}>
              Solved
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.statusBtn, selectedStatus === "UNSOLVED" && styles.activeStatusBtn]}
            onPress={() => setSelectedStatus(selectedStatus === "UNSOLVED" ? null : "UNSOLVED")}
          >
            <Text style={[styles.statusBtnText, selectedStatus === "UNSOLVED" && styles.activeStatusBtnText]}>
              Unsolved
            </Text>
          </TouchableOpacity>
        </View>

        {/* CATEGORY SELECTOR */}
        <Text style={styles.sectionLabel}>CATEGORIES</Text>
        <View style={styles.categoriesContainer}>
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.catBadge, active && styles.activeCatBadge]}
                onPress={() => setSelectedCategory(active ? null : cat)}
              >
                <Text style={[styles.catText, active && styles.activeCatText]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* SEARCH TRIGGER */}
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Search Discussions</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* RESULTS LIST */}
      <View style={{ flex: 1 }}>
        <Text style={styles.resultsHeader}>Search Results ({questions.length})</Text>

        <FlatList
          data={questions}
          keyExtractor={(item) => item.id}
          renderItem={renderSearchCard}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator size="large" color="#500088" style={{ marginTop: 24 }} />
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
                color="#500088"
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
    flex: 1,
    backgroundColor: "#FAF8FF"
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
  backBtn: {
    padding: 8
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1B20"
  },
  clearText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#EF4444"
  },
  filterSection: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEDF4",
    maxHeight: 320
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F3FA",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1A1B20",
    fontWeight: "500"
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#9CA3AF",
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
    borderRadius: 10,
    backgroundColor: "#F4F3FA"
  },
  activeStatusBtn: {
    backgroundColor: "#E2D3FD",
    borderWidth: 1,
    borderColor: "#9333EA"
  },
  statusBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4C4452"
  },
  activeStatusBtnText: {
    color: "#7E22CE"
  },
  categoriesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16
  },
  catBadge: {
    backgroundColor: "#F4F3FA",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  activeCatBadge: {
    backgroundColor: "#500088"
  },
  catText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4C4452"
  },
  activeCatText: {
    color: "#FFFFFF"
  },
  searchBtn: {
    backgroundColor: "#500088",
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12
  },
  searchBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14
  },
  resultsHeader: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4C4452",
    paddingHorizontal: 16,
    paddingTop: 16
  },
  listContent: {
    padding: 16
  }
});
