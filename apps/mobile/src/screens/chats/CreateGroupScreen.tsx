import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Animated,
  Alert,
  Platform,
  ActionSheetIOS,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChatsStackParamList } from "@navigation/ChatsStack";
import { chatService } from "@services/chatService";
import { useAuthStore } from "@store/authStore";
import { useChatStore } from "@store/chatStore";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Heart, Users, X, Search, SearchX, Lightbulb, HeartHandshake } from "lucide-react-native";

// ─────────────────────────────────────────────────────────
// Create Group (Care Circle) Screen
//
// Allows users to:
// 1. Name their Care Circle
// 2. Search and select community members
// 3. Create the group conversation
//
// Uses the same purple/accessibility design system.
// ─────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<ChatsStackParamList, "CreateGroup">;

interface UserResult {
  id: string;
  name: string;
  email: string;
}

const CreateGroupScreen = ({ navigation, route }: Props) => {
  const user = useAuthStore((s) => s.user);
  const addConversation = useChatStore((s) => s.addConversation);
  const insets = useSafeAreaInsets();
  
  const subType = route.params?.subType;
  const isCareCircle = subType === 'CARE_CIRCLE';

  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  // Use a map to store member roles { [userId]: role }
  const [selectedMembers, setSelectedMembers] = useState<{user: UserResult, role: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [allUsers, setAllUsers] = useState<UserResult[]>([]);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Load all users immediately so they're visible without typing
  useEffect(() => {
    chatService.searchUsers('').then((results) => {
      setAllUsers(results);
    }).catch(() => {});
  }, []);

  // Debounced search
  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (text.trim().length < 1) {
        setSearchResults([]);
        setHasSearched(false);
        return;
      }

      searchTimeoutRef.current = setTimeout(async () => {
        setIsSearching(true);
        setHasSearched(true);
        try {
          const results = await chatService.searchUsers(text.trim());
          const selectedIds = new Set(selectedMembers.map((m) => m.user.id));
          setSearchResults(results.filter((r) => !selectedIds.has(r.id)));
        } catch (err) {
          console.error("Search failed:", err);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 400);
    },
    [selectedMembers]
  );

  // The list shown in the search results area:
  // — when query is empty: all users (minus already selected)
  // — when query is typed: filtered search results
  const displayedResults = searchQuery.trim().length < 1
    ? allUsers.filter((u) => !selectedMembers.some((m) => m.user.id === u.id))
    : searchResults;

  const addMember = useCallback((member: UserResult) => {
    setSelectedMembers((prev) => {
      if (prev.find((m) => m.user.id === member.id)) return prev;
      return [...prev, { user: member, role: 'MEMBER' }];
    });
    setSearchResults((prev) => prev.filter((r) => r.id !== member.id));
    setSearchQuery("");
    setHasSearched(false);
  }, []);

  const removeMember = useCallback((memberId: string) => {
    setSelectedMembers((prev) => prev.filter((m) => m.user.id !== memberId));
  }, []);

  const updateMemberRole = useCallback((memberId: string, role: string) => {
    setSelectedMembers((prev) => 
      prev.map(m => m.user.id === memberId ? { ...m, role } : m)
    );
  }, []);

  const handleCreate = useCallback(async () => {
    if (!groupName.trim()) {
      Alert.alert("Name Required", "Please enter a name.");
      return;
    }

    setIsCreating(true);
    try {
      let conversation;
      if (subType === 'CARE_CIRCLE') {
        conversation = await chatService.createCareCircle(groupName.trim(), description.trim());
      } else {
        conversation = await chatService.createGroup(groupName.trim(), description.trim());
      }

      // Send invites to all selected members — they must accept before joining.
      // For Care Circles, the invite carries the assigned role (CAREGIVER, MENTOR, etc.).
      // For general groups, every invite defaults to MEMBER.
      if (selectedMembers.length > 0) {
        const inviteLabel = subType === 'CARE_CIRCLE' ? 'Care Circle' : 'Group';
        const invitePromises = selectedMembers.map((m) =>
          chatService.sendInvite(
            conversation.id,
            m.user.id,
            m.role,
            `You have been invited to join the ${inviteLabel} "${groupName.trim()}"`,
          )
        );
        await Promise.allSettled(invitePromises);
      }

      // Refresh conversations in the store so GroupChatScreen and GroupInfoScreen
      // can find this conversation with properly enriched participants (names, etc.)
      try {
        const convos = await chatService.getConversations();
        useChatStore.getState().setConversations(convos);
      } catch {
        // If refresh fails, manually add a minimal version so screens don't break
        const currentUser = useAuthStore.getState().user;
        const rawMembers: any[] = conversation.members || [];
        const mappedConv = {
          ...conversation,
          participants: rawMembers.map((m: any) => ({
            userId: m.userId,
            role: m.role,
            lastReadSequenceNo: 0,
            isMuted: false,
            user: {
              id: m.userId,
              name: m.userId === currentUser?.id ? (currentUser?.name || 'You') : 'Unknown',
            },
          })),
          unreadCount: 0,
          updatedAt: new Date().toISOString(),
        };
        addConversation(mappedConv);
      }

      // Navigate to the new group chat
      navigation.replace("GroupChat", {
        conversationId: conversation.id,
        groupName: groupName.trim(),
        subType: subType,
      });
    } catch (err: any) {
      console.error("Failed to create group:", err);
      Alert.alert(
        "Error",
        err?.response?.data?.message || "Failed to create group. Please try again."
      );
    } finally {
      setIsCreating(false);
    }
  }, [groupName, description, selectedMembers, navigation, subType]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const MEMBER_COLORS = [
    "#E74C3C", "#2ECC71", "#3498DB", "#F39C12", "#9B59B6",
    "#1ABC9C", "#E91E63", "#00BCD4", "#FF5722", "#607D8B",
  ];

  const getMemberColor = (index: number) =>
    MEMBER_COLORS[index % MEMBER_COLORS.length];

  const renderSearchResult = ({ item }: { item: UserResult }) => (
    <TouchableOpacity
      style={styles.searchResultItem}
      onPress={() => addMember(item)}
      activeOpacity={0.7}
    >
      <View style={styles.resultAvatar}>
        <Text style={styles.resultAvatarText}>{getInitials(item.name)}</Text>
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>{item.name}</Text>
        <Text style={styles.resultEmail}>{item.email}</Text>
      </View>
      <View style={styles.addBtnSmall}>
        <Text style={styles.addBtnSmallText}>+</Text>
      </View>
    </TouchableOpacity>
  );

  const canCreate = groupName.trim().length > 0;
  const headerTitle = isCareCircle ? "New Care Circle" : "New Group";
  const headerSubtitle = isCareCircle 
    ? "Create a support group for your community" 
    : "Create a general chat group";

  return (
    <ScreenWrapper statusBarStyle="light">
      {/* ── Header ────────────────────────────────────────── */}
      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color="#fff" strokeWidth={2.2} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <Text style={styles.headerSubtitle}>
            {headerSubtitle}
          </Text>
        </View>
      </Animated.View>

      <KeyboardAwareScrollView
        style={styles.content}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
        enableOnAndroid={true}
        extraScrollHeight={20}
      >
          {/* ── Group Name ─────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{isCareCircle ? 'Circle Name' : 'Group Name'}</Text>
            <View style={styles.nameInputContainer}>
              <View style={styles.nameIconBox}>
                isCareCircle ? <Heart size={22} color="#8A38F5" strokeWidth={2} /> : <Users size={22} color="#8A38F5" strokeWidth={2} />
              </View>
              <TextInput
                style={styles.nameInput}
                placeholder={isCareCircle ? "e.g. Mobility Support Group" : "e.g. Weekend Plan"}
                placeholderTextColor="#999"
                value={groupName}
                onChangeText={setGroupName}
                maxLength={100}
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* ── Description ─────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Description (Optional)</Text>
            <View style={[styles.nameInputContainer, { paddingVertical: 10 }]}>
              <TextInput
                style={[styles.nameInput, { height: 60, textAlignVertical: 'top' }]}
                placeholder="What is this group for?"
                placeholderTextColor="#999"
                value={description}
                onChangeText={setDescription}
                maxLength={500}
                multiline
              />
            </View>
          </View>

          {/* ── Selected Members ───────────────────────────── */}
          {selectedMembers.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                Members ({selectedMembers.length})
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipsContainer}
                contentContainerStyle={styles.chipsContent}
              >
                {selectedMembers.map((m, index) => (
                  <View key={m.user.id} style={{ flexDirection: 'column', alignItems: 'center', marginRight: 12 }}>
                    <View
                      style={[
                        styles.chip,
                        { backgroundColor: getMemberColor(index) + "20" },
                      ]}
                    >
                      <View
                        style={[
                          styles.chipAvatar,
                          { backgroundColor: getMemberColor(index) },
                        ]}
                      >
                        <Text style={styles.chipAvatarText}>
                          {getInitials(m.user.name)}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.chipName,
                          { color: getMemberColor(index) },
                        ]}
                        numberOfLines={1}
                      >
                        {m.user.name.split(" ")[0]}
                      </Text>
                      <TouchableOpacity
                        style={styles.chipRemove}
                        onPress={() => removeMember(m.user.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <X size={12} color="#666" strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>
                    
                    {/* Role Selector for Care Circles */}
                    {isCareCircle && (
                      <TouchableOpacity
                        style={styles.roleSelector}
                        onPress={() => {
                          const roles = ['MEMBER', 'CAREGIVER', 'MENTOR', 'PROFESSIONAL'];
                          if (Platform.OS === 'ios') {
                            ActionSheetIOS.showActionSheetWithOptions(
                              { options: ['Cancel', 'Member', 'Caregiver', 'Mentor', 'Professional'], cancelButtonIndex: 0 },
                              (idx) => { if (idx > 0) updateMemberRole(m.user.id, roles[idx - 1]); }
                            );
                          } else {
                            Alert.alert('Select Role', `Role for ${m.user.name.split(' ')[0]}`, [
                              ...roles.map((r) => ({ text: r.charAt(0) + r.slice(1).toLowerCase(), onPress: () => updateMemberRole(m.user.id, r) })),
                              { text: 'Cancel', style: 'cancel' as const },
                            ]);
                          }
                        }}
                      >
                        <Text style={styles.roleText}>{m.role}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Search Members ─────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Add Members</Text>
            <View style={styles.searchContainer}>
              <Search size={16} color="#9A93A8" strokeWidth={2} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={handleSearchChange}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {isSearching && (
                <ActivityIndicator
                  size="small"
                  color="#8A38F5"
                  style={styles.searchSpinner}
                />
              )}
            </View>

            {/* Search Results — shows all users by default, filtered when typing */}
            {hasSearched && !isSearching && searchQuery.trim().length > 0 && displayedResults.length === 0 && (
              <View style={styles.emptyState}>
                <SearchX size={32} color="#B9A9D6" strokeWidth={1.8} style={styles.emptyIcon} />
                <Text style={styles.emptyText}>
                  No members found for "{searchQuery}"
                </Text>
                <Text style={styles.emptyHint}>
                  Try a different name or check the spelling
                </Text>
              </View>
            )}

            {displayedResults.length > 0 && (
              <View style={styles.resultsCard}>
                {displayedResults.map((item) => (
                  <React.Fragment key={item.id}>
                    {renderSearchResult({ item })}
                  </React.Fragment>
                ))}
              </View>
            )}
          </View>

          {/* ── Info Banner ────────────────────────────────── */}
          {isCareCircle && (
            <View style={styles.infoBanner}>
              <Lightbulb size={16} color="#8A38F5" strokeWidth={2} style={styles.infoIcon} />
              <Text style={styles.infoText}>
                Care Circles help you stay connected with your support network.
                Add caregivers, therapists, family members, or friends to create
                a shared space for coordination and support. Members will receive an invite to join.
              </Text>
            </View>
          )}


        {/* ── Create Button (Fixed Bottom) ──────────────── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}
            onPress={handleCreate}
            disabled={!canCreate || isCreating}
            activeOpacity={0.8}
          >
            {isCreating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <HeartHandshake size={18} color="#fff" strokeWidth={2} style={styles.createBtnIcon} />
                <Text style={styles.createBtnText}>
                  {isCareCircle ? "Create Care Circle" : "Create Group"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </ScreenWrapper>
  );
};

export default CreateGroupScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3EAFF",
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    backgroundColor: "#500088",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  backText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginTop: 2,
  },

  // ── Content ─────────────────────────────────────────────
  content: {
    flex: 1,
    paddingTop: 20,
  },

  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B21A8",
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },

  // ── Group Name ──────────────────────────────────────────
  nameInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingRight: 16,
    shadowColor: "#8A38F5",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  nameIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#F3EAFF",
    justifyContent: "center",
    alignItems: "center",
    margin: 4,
  },
  nameIcon: {
    fontSize: 22,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
    color: "#1a1a1a",
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontWeight: "500",
  },

  // ── Chips (Selected Members) ────────────────────────────
  chipsContainer: {
    marginHorizontal: -4,
  },
  chipsContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingRight: 10,
    paddingLeft: 3,
    paddingVertical: 3,
    marginRight: 8,
  },
  chipAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  chipAvatarText: {
    fontSize: 11,
    color: "#fff",
    fontWeight: "700",
  },
  chipName: {
    fontSize: 13,
    fontWeight: "600",
    maxWidth: 80,
    marginRight: 4,
  },
  chipRemove: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  chipRemoveText: {
    fontSize: 10,
    color: "#666",
    fontWeight: "700",
  },
  roleSelector: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
  },
  roleText: {
    fontSize: 10,
    color: '#6B21A8',
    fontWeight: '700',
  },

  // ── Search ──────────────────────────────────────────────
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 14,
    shadowColor: "#8A38F5",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1a1a1a",
    paddingVertical: 14,
  },
  searchSpinner: {
    marginLeft: 8,
  },

  // ── Search Results ──────────────────────────────────────
  resultsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginTop: 10,
    overflow: "hidden",
    shadowColor: "#8A38F5",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f0fa",
  },
  resultAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#EDE9FE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  resultAvatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6B21A8",
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  resultEmail: {
    fontSize: 12,
    color: "#999",
    marginTop: 1,
  },
  addBtnSmall: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "#8A38F5",
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnSmallText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginTop: -1,
  },

  // ── Empty State ─────────────────────────────────────────
  emptyState: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
    textAlign: "center",
  },
  emptyHint: {
    fontSize: 12,
    color: "#aaa",
    marginTop: 4,
    textAlign: "center",
  },

  // ── Info Banner ─────────────────────────────────────────
  infoBanner: {
    flexDirection: "row",
    backgroundColor: "#EDE9FE",
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 10,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#6B21A8",
    lineHeight: 19,
  },

  // ── Bottom Bar ──────────────────────────────────────────
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F3EAFF",
    borderTopWidth: 1,
    borderTopColor: "#EDE9FE",
  },
  createBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#500088",
    paddingVertical: 16,
    borderRadius: 18,
    shadowColor: "#500088",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 5,
  },
  createBtnDisabled: {
    backgroundColor: "#C4A8D8",
    shadowOpacity: 0,
    elevation: 0,
  },
  createBtnIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  createBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
