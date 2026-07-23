import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChatsStackParamList } from "@navigation/ChatsStack";
import { chatService } from "@services/chatService";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { ArrowLeft, Search, SearchX, MessageCircle } from "lucide-react-native";
import { useTheme } from "../../theme/ThemeContext";
import { animateIfAllowed } from "../../hooks/motionHelper";
import { AccessibleText } from "../../components/shared/AccessibleText";

type Props = NativeStackScreenProps<ChatsStackParamList, "NewChat">;

interface UserResult {
  id: string;
  name: string;
  email: string;
}

const NewChatScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const { colors, highContrast, reduceMotion } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animateIfAllowed(reduceMotion, headerAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion]);

  useEffect(() => {
    // Fetch all users on mount
    const fetchAllUsers = async () => {
      setIsSearching(true);
      try {
        const results = await chatService.searchUsers("");
        setSearchResults(results);
        setHasSearched(true);
      } catch (err) {
        console.error("Failed to fetch initial users:", err);
      } finally {
        setIsSearching(false);
      }
    };
    fetchAllUsers();
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      setHasSearched(true);
      try {
        const results = await chatService.searchUsers(text.trim());
        setSearchResults(results);
      } catch (err) {
        console.error("Search failed:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  }, []);

  const startChat = useCallback(async (selectedUser: UserResult) => {
    setIsCreating(true);
    try {
      const conversation = await chatService.createDirectChat(selectedUser.id);
      navigation.replace("Chat", {
        conversationId: conversation.id,
        recipientName: selectedUser.name,
        recipientAvatar: "",
      });
    } catch (err: any) {
      console.error("Failed to start chat:", err);
      Alert.alert("Error", err?.response?.data?.message || "Failed to start chat.");
    } finally {
      setIsCreating(false);
    }
  }, [navigation]);

  const getInitials = (name: string) => {
    return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  };

  // ── Theme-derived, high-contrast-aware card outline ─────────
  // Keeps white cards/rows visible against a (also white, under high
  // contrast) screen background — same convention as ChatScreen.tsx.
  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };

  const renderSearchResult = ({ item }: { item: UserResult }) => (
    <TouchableOpacity
      style={[styles.searchResultItem, { borderBottomColor: colors.border }]}
      onPress={() => startChat(item)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Start chat with ${item.name}`}
      accessibilityHint="Opens a direct message conversation"
    >
      <View style={[styles.resultAvatar, { backgroundColor: colors.surface }]}>
        <AccessibleText variant="body" style={[styles.resultAvatarText, { color: colors.secondary }]}>
          {getInitials(item.name)}
        </AccessibleText>
      </View>
      <View style={styles.resultInfo}>
        <AccessibleText variant="body" style={[styles.resultName, { color: colors.text }]}>
          {item.name}
        </AccessibleText>
        <AccessibleText variant="caption" style={[styles.resultEmail, { color: colors.subtext }]}>
          {item.email}
        </AccessibleText>
      </View>
      <View style={[styles.addBtnSmall, { backgroundColor: colors.surface }]}>
        <MessageCircle size={18} color={colors.primary} strokeWidth={2} />
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenWrapper statusBarStyle="light">
      <Animated.View
        style={[
          styles.header,
          {
            backgroundColor: colors.primary,
            paddingTop: insets.top + 8,
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the previous screen"
        >
          <ArrowLeft size={24} color={colors.white} strokeWidth={2.2} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <AccessibleText variant="title" style={[styles.headerTitle, { color: colors.white }]}>
            New Chat
          </AccessibleText>
          <AccessibleText variant="caption" style={[styles.headerSubtitle, { color: "rgba(255,255,255,0.6)" }]}>
            Search for people to message
          </AccessibleText>
        </View>
      </Animated.View>

      <KeyboardAwareScrollView style={styles.content} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}>
        <View style={styles.section}>
          <View style={[styles.searchContainer, { backgroundColor: colors.card, shadowColor: colors.primary }, cardBorder]}>
            <Search size={16} color={colors.text} strokeWidth={2} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search by name..."
              placeholderTextColor={colors.subtext}
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel="Search people by name"
            />
            {isSearching && <ActivityIndicator size="small" color={colors.primary} style={styles.searchSpinner} />}
          </View>

          {hasSearched && !isSearching && searchResults.length === 0 && (
            <View style={styles.emptyState}>
              <SearchX size={32} color={colors.subtext} strokeWidth={1.8} style={styles.emptyIcon} />
              <AccessibleText variant="body" style={[styles.emptyText, { color: colors.subtext }]}>
                No members found for "{searchQuery}"
              </AccessibleText>
            </View>
          )}

          {searchResults.length > 0 && (
            <View style={[styles.resultsCard, { backgroundColor: colors.card, shadowColor: colors.primary }, cardBorder]}>
              {searchResults.map((item) => (
                <React.Fragment key={item.id}>{renderSearchResult({ item })}</React.Fragment>
              ))}
            </View>
          )}
        </View>
        {isCreating && (
          <View style={styles.overlayLoading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
      </KeyboardAwareScrollView>
    </ScreenWrapper>
  );
};

export default NewChatScreen;

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: "row", alignItems: "center" },
  backBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center", marginRight: 14 },
  headerCenter: { flex: 1 },
  headerTitle: { letterSpacing: 0.3 },
  headerSubtitle: { marginTop: 2 },
  content: { flex: 1, paddingTop: 20 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  searchContainer: { flexDirection: "row", alignItems: "center", borderRadius: 16, paddingHorizontal: 14, shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 14 },
  searchSpinner: { marginLeft: 8 },
  resultsCard: { borderRadius: 16, marginTop: 10, overflow: "hidden", shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  searchResultItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  resultAvatar: { width: 42, height: 42, borderRadius: 14, justifyContent: "center", alignItems: "center", marginRight: 12 },
  resultAvatarText: { fontWeight: "700" },
  resultInfo: { flex: 1 },
  resultName: { fontWeight: "600" },
  resultEmail: { marginTop: 1 },
  addBtnSmall: { width: 32, height: 32, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  emptyState: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 20 },
  emptyIcon: { marginBottom: 8 },
  emptyText: { fontWeight: "500", textAlign: "center" },
  overlayLoading: { position: "absolute", top: 100, left: 0, right: 0, alignItems: "center" }
});
