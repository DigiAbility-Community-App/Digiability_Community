import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
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

type Props = NativeStackScreenProps<ChatsStackParamList, "NewChat">;

interface UserResult {
  id: string;
  name: string;
  email: string;
}

const NewChatScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

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
        recipientAvatar: "👤",
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

  const renderSearchResult = ({ item }: { item: UserResult }) => (
    <TouchableOpacity style={styles.searchResultItem} onPress={() => startChat(item)} activeOpacity={0.7}>
      <View style={styles.resultAvatar}>
        <Text style={styles.resultAvatarText}>{getInitials(item.name)}</Text>
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>{item.name}</Text>
        <Text style={styles.resultEmail}>{item.email}</Text>
      </View>
      <View style={styles.addBtnSmall}>
        <Text style={styles.addBtnSmallText}>✉️</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenWrapper statusBarStyle="light">
      <Animated.View style={[styles.header, { paddingTop: insets.top + 8, opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>New Chat</Text>
          <Text style={styles.headerSubtitle}>Search for people to message</Text>
        </View>
      </Animated.View>

      <KeyboardAwareScrollView style={styles.content} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}>
        <View style={styles.section}>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {isSearching && <ActivityIndicator size="small" color="#8A38F5" style={styles.searchSpinner} />}
          </View>
          
          {hasSearched && !isSearching && searchResults.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔎</Text>
              <Text style={styles.emptyText}>No members found for "{searchQuery}"</Text>
            </View>
          )}

          {searchResults.length > 0 && (
            <View style={styles.resultsCard}>
              {searchResults.map((item) => (
                <React.Fragment key={item.id}>{renderSearchResult({ item })}</React.Fragment>
              ))}
            </View>
          )}
        </View>
        {isCreating && (
          <View style={styles.overlayLoading}>
            <ActivityIndicator size="large" color="#8A38F5" />
          </View>
        )}
      </KeyboardAwareScrollView>
    </ScreenWrapper>
  );
};

export default NewChatScreen;

const styles = StyleSheet.create({
  header: { backgroundColor: "#500088", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: "row", alignItems: "center" },
  backBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center", marginRight: 14 },
  backText: { color: "#fff", fontSize: 22, fontWeight: "700" },
  headerCenter: { flex: 1 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: 0.3 },
  headerSubtitle: { color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 2 },
  content: { flex: 1, paddingTop: 20 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, paddingHorizontal: 14, shadowColor: "#8A38F5", shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  searchIcon: { fontSize: 16, marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: "#1a1a1a", paddingVertical: 14 },
  searchSpinner: { marginLeft: 8 },
  resultsCard: { backgroundColor: "#fff", borderRadius: 16, marginTop: 10, overflow: "hidden", shadowColor: "#8A38F5", shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  searchResultItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f5f0fa" },
  resultAvatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#EDE9FE", justifyContent: "center", alignItems: "center", marginRight: 12 },
  resultAvatarText: { fontSize: 15, fontWeight: "700", color: "#6B21A8" },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 15, fontWeight: "600", color: "#1a1a1a" },
  resultEmail: { fontSize: 12, color: "#999", marginTop: 1 },
  addBtnSmall: { width: 32, height: 32, borderRadius: 12, backgroundColor: "#EDE9FE", justifyContent: "center", alignItems: "center" },
  addBtnSmallText: { fontSize: 14 },
  emptyState: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 32, marginBottom: 8 },
  emptyText: { fontSize: 14, color: "#666", fontWeight: "500", textAlign: "center" },
  overlayLoading: { position: "absolute", top: 100, left: 0, right: 0, alignItems: "center" }
});
