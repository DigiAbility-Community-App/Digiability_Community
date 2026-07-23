import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
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
import { useTheme, getFontScale } from "../../theme/ThemeContext";
import { animateIfAllowed } from "../../hooks/motionHelper";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";

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
  const { colors, highContrast, reduceMotion, textSize } = useTheme();
  const fs = getFontScale(textSize);

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
    animateIfAllowed(reduceMotion, headerAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion]);

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

  // ── Theme-derived, high-contrast-aware card outline ─────────
  // Keeps white cards/rows visible against a (also white, under high
  // contrast) screen background — same convention as ChatScreen.tsx.
  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };

  const renderSearchResult = ({ item }: { item: UserResult }) => (
    <TouchableOpacity
      style={[styles.searchResultItem, { borderBottomColor: colors.border }]}
      onPress={() => addMember(item)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Add ${item.name}`}
      accessibilityHint="Adds this person to the group"
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
      <View style={[styles.addBtnSmall, { backgroundColor: colors.primary }]}>
        <AccessibleText variant="body" style={[styles.addBtnSmallText, { color: colors.white }]}>+</AccessibleText>
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
            backgroundColor: colors.primary,
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
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the previous screen"
        >
          <ArrowLeft size={24} color={colors.white} strokeWidth={2.2} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <AccessibleText variant="title" style={[styles.headerTitle, { color: colors.white }]}>
            {headerTitle}
          </AccessibleText>
          <AccessibleText variant="caption" style={[styles.headerSubtitle, { color: "rgba(255,255,255,0.6)" }]}>
            {headerSubtitle}
          </AccessibleText>
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
            <AccessibleText variant="overline" style={[styles.sectionLabel, { color: colors.secondary, fontSize: fs(14) }]}>
              {isCareCircle ? 'Circle Name' : 'Group Name'}
            </AccessibleText>
            <View style={[styles.nameInputContainer, { backgroundColor: colors.card, shadowColor: colors.primary }, cardBorder]}>
              <View style={[styles.nameIconBox, { backgroundColor: colors.background }]}>
                {isCareCircle ? <Heart size={22} color={colors.primary} strokeWidth={2} /> : <Users size={22} color={colors.primary} strokeWidth={2} />}
              </View>
              <TextInput
                style={[styles.nameInput, { color: colors.text }]}
                placeholder={isCareCircle ? "e.g. Mobility Support Group" : "e.g. Weekend Plan"}
                placeholderTextColor={colors.subtext}
                value={groupName}
                onChangeText={setGroupName}
                maxLength={100}
                autoCapitalize="words"
                accessibilityLabel={isCareCircle ? "Circle name" : "Group name"}
              />
            </View>
          </View>

          {/* ── Description ─────────────────────────────────── */}
          <View style={styles.section}>
            <AccessibleText variant="overline" style={[styles.sectionLabel, { color: colors.secondary, fontSize: fs(14) }]}>
              Description (Optional)
            </AccessibleText>
            <View style={[styles.nameInputContainer, { paddingVertical: 10, backgroundColor: colors.card, shadowColor: colors.primary }, cardBorder]}>
              <TextInput
                style={[styles.nameInput, { height: 60, textAlignVertical: 'top', color: colors.text }]}
                placeholder="What is this group for?"
                placeholderTextColor={colors.subtext}
                value={description}
                onChangeText={setDescription}
                maxLength={500}
                multiline
                accessibilityLabel="Group description"
              />
            </View>
          </View>

          {/* ── Selected Members ───────────────────────────── */}
          {selectedMembers.length > 0 && (
            <View style={styles.section}>
              <AccessibleText variant="overline" style={[styles.sectionLabel, { color: colors.secondary, fontSize: fs(14) }]}>
                Members ({selectedMembers.length})
              </AccessibleText>
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
                        <AccessibleText variant="body" style={[styles.chipAvatarText, { color: colors.white }]}>
                          {getInitials(m.user.name)}
                        </AccessibleText>
                      </View>
                      <AccessibleText
                        variant="body"
                        style={[
                          styles.chipName,
                          { color: getMemberColor(index) },
                        ]}
                        numberOfLines={1}
                      >
                        {m.user.name.split(" ")[0]}
                      </AccessibleText>
                      <TouchableOpacity
                        style={styles.chipRemove}
                        onPress={() => removeMember(m.user.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${m.user.name} from group`}
                      >
                        <X size={12} color={colors.subtext} strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>

                    {/* Role Selector for Care Circles */}
                    {isCareCircle && (
                      <TouchableOpacity
                        style={[styles.roleSelector, { backgroundColor: colors.surface }]}
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
                        accessibilityRole="button"
                        accessibilityLabel={`Change role for ${m.user.name}, currently ${m.role}`}
                        accessibilityHint="Opens a menu to choose Member, Caregiver, Mentor, or Professional"
                      >
                        <AccessibleText variant="overline" style={[styles.roleText, { color: colors.secondary }]}>
                          {m.role}
                        </AccessibleText>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Search Members ─────────────────────────────── */}
          <View style={styles.section}>
            <AccessibleText variant="overline" style={[styles.sectionLabel, { color: colors.secondary, fontSize: fs(14) }]}>
              Add Members
            </AccessibleText>
            <View style={[styles.searchContainer, { backgroundColor: colors.card, shadowColor: colors.primary }, cardBorder]}>
              <Search size={16} color={colors.subtext} strokeWidth={2} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search by name..."
                placeholderTextColor={colors.subtext}
                value={searchQuery}
                onChangeText={handleSearchChange}
                autoCapitalize="none"
                returnKeyType="search"
                accessibilityLabel="Search members by name"
              />
              {isSearching && (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={styles.searchSpinner}
                />
              )}
            </View>

            {/* Search Results — shows all users by default, filtered when typing */}
            {hasSearched && !isSearching && searchQuery.trim().length > 0 && displayedResults.length === 0 && (
              <View style={styles.emptyState}>
                <SearchX size={32} color={colors.subtext} strokeWidth={1.8} style={styles.emptyIcon} />
                <AccessibleText variant="body" style={[styles.emptyText, { color: colors.subtext }]}>
                  No members found for "{searchQuery}"
                </AccessibleText>
                <AccessibleText variant="caption" style={[styles.emptyHint, { color: colors.subtext }]}>
                  Try a different name or check the spelling
                </AccessibleText>
              </View>
            )}

            {displayedResults.length > 0 && (
              <View style={[styles.resultsCard, { backgroundColor: colors.card, shadowColor: colors.primary }, cardBorder]}>
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
            <View style={[styles.infoBanner, { backgroundColor: colors.surface }]}>
              <Lightbulb size={16} color={colors.primary} strokeWidth={2} style={styles.infoIcon} />
              <AccessibleText variant="body" style={[styles.infoText, { color: colors.secondary }]}>
                Care Circles help you stay connected with your support network.
                Add caregivers, therapists, family members, or friends to create
                a shared space for coordination and support. Members will receive an invite to join.
              </AccessibleText>
            </View>
          )}


        {/* ── Create Button (Fixed Bottom) ──────────────── */}
        <View style={[styles.bottomBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <AccessibleButton
            variant="primary"
            onPress={handleCreate}
            disabled={!canCreate || isCreating}
            accessibilityLabel={isCareCircle ? "Create Care Circle" : "Create Group"}
            accessibilityHint={!canCreate ? "Enter a name to enable this button" : undefined}
          >
            {isCreating ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <HeartHandshake size={18} color={colors.white} strokeWidth={2} style={styles.createBtnIcon} />
                <AccessibleText variant="button" style={{ color: colors.white }}>
                  {isCareCircle ? "Create Care Circle" : "Create Group"}
                </AccessibleText>
              </>
            )}
          </AccessibleButton>
        </View>
      </KeyboardAwareScrollView>
    </ScreenWrapper>
  );
};

export default CreateGroupScreen;

const styles = StyleSheet.create({
  // ── Header ──────────────────────────────────────────────
  header: {
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
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    letterSpacing: 0.3,
  },
  headerSubtitle: {
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
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },

  // ── Group Name ──────────────────────────────────────────
  nameInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingRight: 16,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  nameIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    margin: 4,
  },
  nameInput: {
    flex: 1,
    fontSize: 16,
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
  roleSelector: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // ── Search ──────────────────────────────────────────────
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 14,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 14,
  },
  searchSpinner: {
    marginLeft: 8,
  },

  // ── Search Results ──────────────────────────────────────
  resultsCard: {
    borderRadius: 16,
    marginTop: 10,
    overflow: "hidden",
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
  },
  resultAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  resultAvatarText: {
    fontWeight: "700",
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontWeight: "600",
  },
  resultEmail: {
    marginTop: 1,
  },
  addBtnSmall: {
    width: 32,
    height: 32,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnSmallText: {
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
    marginBottom: 8,
  },
  emptyText: {
    fontWeight: "500",
    textAlign: "center",
  },
  emptyHint: {
    marginTop: 4,
    textAlign: "center",
  },

  // ── Info Banner ─────────────────────────────────────────
  infoBanner: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  infoIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    lineHeight: 19,
  },

  // ── Bottom Bar ──────────────────────────────────────────
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  createBtnIcon: {
    marginRight: 8,
  },
});
