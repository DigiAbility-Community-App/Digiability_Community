// ─────────────────────────────────────────────────────────────
// ForumsTab — Community discussions list
//
// Features:
//   • Search input with instant / submit filter
//   • Category dropdown selector (modal picker instead of horizontal scroll)
//   • Sort by Latest (Date), Top Views (Views), Comments (Answers)
//   • Full Ascending (↑) / Descending (↓) support with instant UI reordering
//   • Infinite scrolling & pull-to-refresh
//   • Floating Action Button to ask a question
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Globe,
  Stethoscope,
  ScrollText,
  Accessibility,
  GraduationCap,
  Briefcase,
  Brain,
  Scale,
  Laptop,
  HeartHandshake,
  Users,
  Search,
  Plus,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  Filter,
} from "lucide-react-native";
import { useForumStore, ForumQuestion } from "../../store/forumStore";
import { ForumQuestionCard } from "../shared/ForumQuestionCard";
import { ForumSkeletonCard } from "../shared/ForumSkeletonCard";
import { EmptyState } from "../shared/EmptyState";

const CATEGORIES = [
  { id: "all", name: "All Categories", Icon: Globe },
  { id: "Healthcare", name: "Healthcare", Icon: Stethoscope },
  { id: "Government Schemes", name: "Government Schemes", Icon: ScrollText },
  { id: "Accessibility", name: "Accessibility", Icon: Accessibility },
  { id: "Education", name: "Education", Icon: GraduationCap },
  { id: "Jobs", name: "Jobs & Careers", Icon: Briefcase },
  { id: "Mental Health", name: "Mental Health", Icon: Brain },
  { id: "Legal Help", name: "Legal Help", Icon: Scale },
  { id: "Assistive Technology", name: "Assistive Tech", Icon: Laptop },
  { id: "Caregiver Support", name: "Caregiver Support", Icon: HeartHandshake },
  { id: "Community", name: "Community", Icon: Users },
  { id: "Document", name: "Documents & IDs", Icon: ScrollText },
  { id: "Others", name: "Others", Icon: Globe },
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
    resetFilters,
  } = useForumStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

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
    setIsCategoryModalOpen(false);
    setFilters({
      category: categoryId === "all" ? undefined : categoryId,
    });
    fetchQuestions(true);
  };

  const handleSortSelect = (sortType: "newest" | "popular" | "answers") => {
    // If user clicks the currently active sort type, toggle direction
    if (filters.sort === sortType) {
      const newOrder = sortOrder === "desc" ? "asc" : "desc";
      setSortOrder(newOrder);
      setFilters({ sort: sortType, order: newOrder });
    } else {
      setFilters({ sort: sortType, order: sortOrder });
    }
    fetchQuestions(true);
  };

  const handleToggleSortOrder = () => {
    const newOrder = sortOrder === "desc" ? "asc" : "desc";
    setSortOrder(newOrder);
    setFilters({ order: newOrder });
    fetchQuestions(true);
  };

  // Client-side instant sort guarantee
  const sortedQuestions = useMemo(() => {
    const list = [...questions];
    const sortField = filters.sort || "newest";
    const isAsc = sortOrder === "asc";

    return list.sort((a, b) => {
      let comparison = 0;
      if (sortField === "newest") {
        const timeA = new Date(a.createdAt).getTime() || 0;
        const timeB = new Date(b.createdAt).getTime() || 0;
        comparison = timeA - timeB;
      } else if (sortField === "popular") {
        comparison = (a.views || 0) - (b.views || 0);
      } else if (sortField === "answers") {
        comparison = (a.answerCount || 0) - (b.answerCount || 0);
      }
      return isAsc ? comparison : -comparison;
    });
  }, [questions, filters.sort, sortOrder]);

  const activeCategoryObj =
    CATEGORIES.find((c) => c.id === selectedCategory) || CATEGORIES[0];
  const ActiveCatIcon = activeCategoryObj.Icon;

  const currentSortLabel =
    filters.sort === "popular"
      ? "Top Views"
      : filters.sort === "answers"
      ? "Comments"
      : "Latest";

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
        {/* Search bar */}
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
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery("");
                setFilters({ search: undefined });
                fetchQuestions(true);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* CATEGORY DROPDOWN BUTTON */}
        <TouchableOpacity
          style={styles.dropdownBtn}
          activeOpacity={0.8}
          onPress={() => setIsCategoryModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Category filter: ${activeCategoryObj.name}`}
          accessibilityHint="Opens dropdown to filter discussions by category"
        >
          <View style={styles.dropdownLeft}>
            <View style={styles.dropdownIconCircle}>
              <ActiveCatIcon size={16} color="#500088" />
            </View>
            <View>
              <Text style={styles.dropdownSublabel}>CATEGORY</Text>
              <Text style={styles.dropdownValue}>{activeCategoryObj.name}</Text>
            </View>
          </View>
          <ChevronDown size={18} color="#500088" strokeWidth={2.2} />
        </TouchableOpacity>

        {/* SORT ROW & ASC/DESC TOGGLE */}
        <View style={styles.sortRow}>
          <View style={styles.sortTypeContainer}>
            <Text style={styles.sortLabel}>SORT BY</Text>
            <View style={styles.sortButtons}>
              <TouchableOpacity
                style={[
                  styles.sortBtn,
                  (filters.sort === "newest" || !filters.sort) && styles.activeSortBtn,
                ]}
                onPress={() => handleSortSelect("newest")}
              >
                <Text
                  style={[
                    styles.sortBtnText,
                    (filters.sort === "newest" || !filters.sort) && styles.activeSortBtnText,
                  ]}
                >
                  Latest
                </Text>
                {(filters.sort === "newest" || !filters.sort) && (
                  sortOrder === "asc" ? (
                    <ArrowUp size={12} color="#FFFFFF" strokeWidth={2.5} style={{ marginLeft: 2 }} />
                  ) : (
                    <ArrowDown size={12} color="#FFFFFF" strokeWidth={2.5} style={{ marginLeft: 2 }} />
                  )
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sortBtn,
                  filters.sort === "popular" && styles.activeSortBtn,
                ]}
                onPress={() => handleSortSelect("popular")}
              >
                <Text
                  style={[
                    styles.sortBtnText,
                    filters.sort === "popular" && styles.activeSortBtnText,
                  ]}
                >
                  Top Views
                </Text>
                {filters.sort === "popular" && (
                  sortOrder === "asc" ? (
                    <ArrowUp size={12} color="#FFFFFF" strokeWidth={2.5} style={{ marginLeft: 2 }} />
                  ) : (
                    <ArrowDown size={12} color="#FFFFFF" strokeWidth={2.5} style={{ marginLeft: 2 }} />
                  )
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sortBtn,
                  filters.sort === "answers" && styles.activeSortBtn,
                ]}
                onPress={() => handleSortSelect("answers")}
              >
                <Text
                  style={[
                    styles.sortBtnText,
                    filters.sort === "answers" && styles.activeSortBtnText,
                  ]}
                >
                  Comments
                </Text>
                {filters.sort === "answers" && (
                  sortOrder === "asc" ? (
                    <ArrowUp size={12} color="#FFFFFF" strokeWidth={2.5} style={{ marginLeft: 2 }} />
                  ) : (
                    <ArrowDown size={12} color="#FFFFFF" strokeWidth={2.5} style={{ marginLeft: 2 }} />
                  )
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ASC / DESC DIRECTION TOGGLE BUTTON */}
          <TouchableOpacity
            style={[styles.orderToggleBtn, sortOrder === "asc" && styles.orderToggleBtnAsc]}
            onPress={handleToggleSortOrder}
            accessibilityRole="button"
            accessibilityLabel={`Order: ${sortOrder === "desc" ? "Descending (Highest first)" : "Ascending (Lowest first)"}`}
            accessibilityHint="Toggle between ascending and descending order"
          >
            {sortOrder === "desc" ? (
              <ArrowDown size={14} color="#500088" strokeWidth={2.2} />
            ) : (
              <ArrowUp size={14} color="#500088" strokeWidth={2.2} />
            )}
            <Text style={styles.orderToggleText}>
              {sortOrder === "desc" ? "Desc (High→Low)" : "Asc (Low→High)"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* QUESTIONS LIST */}
      <FlatList
        data={sortedQuestions}
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

      {/* CATEGORY DROPDOWN MODAL */}
      <Modal
        visible={isCategoryModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCategoryModalOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsCategoryModalOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.dropdownModal}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderTitleRow}>
                    <Filter size={18} color="#500088" style={{ marginRight: 8 }} />
                    <Text style={styles.modalTitle}>Select Category</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsCategoryModalOpen(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalList}
                  showsVerticalScrollIndicator={false}
                >
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    const CatIcon = cat.Icon;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.categoryOption,
                          isSelected && styles.categoryOptionActive,
                        ]}
                        onPress={() => handleCategorySelect(cat.id)}
                      >
                        <View style={styles.categoryOptionLeft}>
                          <View
                            style={[
                              styles.catOptionIcon,
                              isSelected && styles.catOptionIconActive,
                            ]}
                          >
                            <CatIcon
                              size={18}
                              color={isSelected ? "#500088" : "#6B7280"}
                            />
                          </View>
                          <Text
                            style={[
                              styles.categoryOptionText,
                              isSelected && styles.categoryOptionTextActive,
                            ]}
                          >
                            {cat.name}
                          </Text>
                        </View>
                        {isSelected && (
                          <Check size={18} color="#500088" strokeWidth={2.5} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export default ForumsTab;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF8FF",
  },
  searchSection: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEDF4",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F3FA",
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1A1B20",
    fontWeight: "500",
  },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F7F4FD",
    borderWidth: 1,
    borderColor: "#E2D3FD",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  dropdownLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dropdownIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EDE4FC",
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownSublabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#7C3AED",
    letterSpacing: 0.5,
  },
  dropdownValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1B20",
    marginTop: 1,
  },
  sortRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F4F3FA",
  },
  sortTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    flexWrap: "wrap",
    gap: 6,
  },
  sortLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#9CA3AF",
    letterSpacing: 0.5,
    marginRight: 2,
  },
  sortButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#F4F3FA",
  },
  activeSortBtn: {
    backgroundColor: "#500088",
  },
  sortBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
  },
  activeSortBtnText: {
    color: "#FFFFFF",
  },
  orderToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#F7F4FD",
    borderWidth: 1,
    borderColor: "#E2D3FD",
    marginLeft: 6,
  },
  orderToggleBtnAsc: {
    backgroundColor: "#EDE4FC",
    borderColor: "#C084FC",
  },
  orderToggleText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#500088",
  },
  listContent: {
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 190 : 170,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: Platform.OS === "ios" ? 120 : 100,
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
    elevation: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  dropdownModal: {
    width: "100%",
    maxHeight: "75%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F3FA",
    marginBottom: 8,
  },
  modalHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1A1B20",
  },
  modalList: {
    maxHeight: 380,
  },
  categoryOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  categoryOptionActive: {
    backgroundColor: "#F7F4FD",
  },
  categoryOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  catOptionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F4F3FA",
    justifyContent: "center",
    alignItems: "center",
  },
  catOptionIconActive: {
    backgroundColor: "#EDE4FC",
  },
  categoryOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4C4452",
  },
  categoryOptionTextActive: {
    color: "#500088",
    fontWeight: "800",
  },
});