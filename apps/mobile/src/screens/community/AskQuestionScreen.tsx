import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft, Camera, HelpCircle, X, Check, Mic } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { Dropdown } from "react-native-element-dropdown";
import { useForumStore } from "../../store/forumStore";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";

const ALLOWED_CATEGORIES = [
  { label: "Healthcare 🏥", value: "Healthcare" },
  { label: "Government Schemes 📜", value: "Government Schemes" },
  { label: "Accessibility ♿", value: "Accessibility" },
  { label: "Education 🎓", value: "Education" },
  { label: "Jobs 💼", value: "Jobs" },
  { label: "Mental Health 🧠", value: "Mental Health" },
  { label: "Legal Help ⚖️", value: "Legal Help" },
  { label: "Assistive Technology 💻", value: "Assistive Technology" },
  { label: "Caregiver Support 🤝", value: "Caregiver Support" },
  { label: "Community 👥", value: "Community" }
];

const AskQuestionScreen = () => {
  const navigation = useNavigation<any>();
  const { colors, highContrast } = useTheme();
  const { createQuestion, checkDuplicateQuestions, duplicateSuggestions, clearDuplicateSuggestions, actionLoading } = useForumStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [altText, setAltText] = useState("");
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  // Request camera roll permission on mount
  useEffect(() => {
    (async () => {
      const libraryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (libraryStatus.status !== "granted") {
        Alert.alert("Permission Needed", "We need access to your camera roll to pick images.");
      }
    })();
  }, []);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleClearImage = () => {
    setImageUri(null);
    setAltText("");
  };

  const handleVoiceTyping = () => {
    Alert.alert("Coming Soon", "Voice typing will be available in a future update.");
  };

  const checkAndSubmit = async () => {
    if (!title.trim() || !category || !description.trim()) {
      Alert.alert("Missing Fields", "Please enter a Title, Category, and Description.");
      return;
    }

    if (imageUri && !altText.trim()) {
      Alert.alert("Alt Text Required", "Please provide a description (alt text) for the uploaded image to support screen readers.");
      return;
    }

    setIsCheckingDuplicates(true);
    try {
      await checkDuplicateQuestions(title);
      setIsCheckingDuplicates(false);

      // Use the reactive store value that was updated by checkDuplicateQuestions
      if (duplicateSuggestions && duplicateSuggestions.length > 0) {
        setShowDuplicateModal(true);
      } else {
        submitPost();
      }
    } catch (e) {
      setIsCheckingDuplicates(false);
      submitPost();
    }
  };

  const submitPost = async () => {
    setShowDuplicateModal(false);
    clearDuplicateSuggestions();

    try {
      await createQuestion({
        title: title.trim(),
        description: description.trim(),
        category,
        tags: tags.trim(),
        imageUri,
        altText: imageUri ? altText.trim() : null,
      });

      Alert.alert("Success", "Your question has been posted!", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to post question.");
    }
  };

  const accentBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" as const }
    : { borderWidth: 1, borderColor: "#E9D5FF" as const };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.card }]}>
      {/* HEADER */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <AccessibleText variant="title" style={[styles.headerTitle, { color: colors.text }]}>
          Ask a Question
        </AccessibleText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* HELP TEXT */}
        <View
          style={[
            styles.helpCard,
            { backgroundColor: highContrast ? "#FFFFFF" : "#F5F3FF" },
            accentBorder,
          ]}
        >
          <HelpCircle size={20} color={colors.secondary} style={{ marginRight: 10 }} />
          <AccessibleText variant="body" style={[styles.helpText, { color: colors.secondary }]}>
            Describe your problem clearly. Other members of the community can upvote or answer your post.
          </AccessibleText>
        </View>

        {/* TITLE */}
        <AccessibleText variant="label" style={[styles.inputLabel, { color: colors.text }]}>
          Title
        </AccessibleText>
        <TextInput
          style={[
            styles.textInput,
            { backgroundColor: colors.surface, color: colors.text },
            highContrast && { borderWidth: 1, borderColor: "#000000" },
          ]}
          placeholder="e.g. Tips for managing evening restlessness?"
          placeholderTextColor={colors.subtext}
          value={title}
          onChangeText={setTitle}
          accessibilityLabel="Question Title"
          accessibilityHint="Summarize your question briefly"
        />

        {/* CATEGORY DROPDOWN */}
        <AccessibleText variant="label" style={[styles.inputLabel, { color: colors.text }]}>
          Category
        </AccessibleText>
        <Dropdown
          style={[
            styles.dropdown,
            { backgroundColor: colors.surface },
            highContrast && { borderWidth: 1, borderColor: "#000000" },
          ]}
          placeholderStyle={[styles.placeholderStyle, { color: colors.subtext }]}
          selectedTextStyle={[styles.selectedTextStyle, { color: colors.text }]}
          data={ALLOWED_CATEGORIES}
          maxHeight={300}
          labelField="label"
          valueField="value"
          placeholder="Select category"
          value={category}
          onChange={(item) => setCategory(item.value)}
          accessibilityLabel="Category dropdown"
        />

        {/* DESCRIPTION + VOICE INPUT */}
        <View style={styles.descriptionHeader}>
          <AccessibleText variant="label" style={[styles.inputLabel, { color: colors.text }]}>
            Description
          </AccessibleText>
          <TouchableOpacity
            onPress={handleVoiceTyping}
            style={[styles.voiceBtn, { backgroundColor: colors.background }, accentBorder]}
            accessibilityRole="button"
            accessibilityLabel="Voice typing — coming soon"
            accessibilityHint="Dictate your question description using your voice"
          >
            <Mic size={14} color={colors.secondary} style={{ marginRight: 4 }} />
            <AccessibleText variant="caption" style={[styles.voiceBtnText, { color: colors.secondary }]}>
              Voice Type
            </AccessibleText>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[
            styles.textInput,
            styles.textArea,
            { backgroundColor: colors.surface, color: colors.text },
            highContrast && { borderWidth: 1, borderColor: "#000000" },
          ]}
          placeholder="Provide more context or list things you have tried..."
          placeholderTextColor={colors.subtext}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          accessibilityLabel="Question Description"
          accessibilityHint="Detail your question here"
        />

        {/* TAGS */}
        <AccessibleText variant="label" style={[styles.inputLabel, { color: colors.text }]}>
          Tags (comma-separated)
        </AccessibleText>
        <TextInput
          style={[
            styles.textInput,
            { backgroundColor: colors.surface, color: colors.text },
            highContrast && { borderWidth: 1, borderColor: "#000000" },
          ]}
          placeholder="e.g. Autism, Therapy, Parent Help"
          placeholderTextColor={colors.subtext}
          value={tags}
          onChangeText={setTags}
          accessibilityLabel="Tags input"
          accessibilityHint="Separate tags using commas"
        />

        {/* IMAGE PICKER */}
        <AccessibleText variant="label" style={[styles.inputLabel, { color: colors.text }]}>
          Optional Image
        </AccessibleText>
        {imageUri ? (
          <View style={styles.imageSection}>
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.removeImageBtn}
                onPress={handleClearImage}
                accessibilityRole="button"
                accessibilityLabel="Remove selected image"
              >
                <X size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* ALT TEXT INPUT */}
            <AccessibleText variant="label" style={[styles.altTextLabel, { color: colors.subtext }]}>
              Alt Text Description (for Screen Readers)
            </AccessibleText>
            <TextInput
              style={[
                styles.altTextInput,
                { backgroundColor: colors.surface, color: colors.text },
                highContrast && { borderWidth: 1, borderColor: "#000000" },
              ]}
              placeholder="e.g., A child playing with sensory toys in a quiet room"
              placeholderTextColor={colors.subtext}
              value={altText}
              onChangeText={setAltText}
              accessibilityLabel="Image Description Alt Text"
            />
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.imagePickerBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              highContrast && { borderStyle: "solid", borderWidth: 2 },
            ]}
            onPress={handlePickImage}
            accessibilityRole="button"
            accessibilityLabel="Upload image"
            accessibilityHint="Opens your photo library to attach an image to this question"
          >
            <Camera size={24} color={colors.subtext} style={{ marginBottom: 6 }} />
            <AccessibleText variant="caption" style={[styles.imagePickerText, { color: colors.subtext }]}>
              Upload Image
            </AccessibleText>
          </TouchableOpacity>
        )}

        {/* SUBMIT BUTTON */}
        <AccessibleButton
          variant="primary"
          accessibilityLabel="Post question"
          accessibilityHint="Submits your question to the community"
          style={[styles.submitBtn, { shadowColor: colors.primary }]}
          onPress={checkAndSubmit}
          disabled={actionLoading || isCheckingDuplicates}
        >
          {actionLoading || isCheckingDuplicates ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            "Post Question"
          )}
        </AccessibleButton>
      </ScrollView>

      {/* DUPLICATE WARNING MODAL */}
      <Modal
        visible={showDuplicateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDuplicateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <AccessibleText variant="title" style={[styles.modalTitle, { color: colors.text }]}>
                Similar Questions Found
              </AccessibleText>
              <TouchableOpacity
                onPress={() => setShowDuplicateModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Close similar questions dialog"
              >
                <X size={20} color={colors.subtext} />
              </TouchableOpacity>
            </View>

            <AccessibleText variant="body" style={[styles.modalSubtitle, { color: colors.subtext }]}>
              We found some existing posts that might already solve your issue:
            </AccessibleText>

            <ScrollView style={styles.suggestionsScroll}>
              {duplicateSuggestions.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.suggestionCard, { backgroundColor: colors.background }, accentBorder]}
                  onPress={() => {
                    setShowDuplicateModal(false);
                    navigation.navigate("QuestionDetails", { questionId: item.id });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`View similar discussion: ${item.title}`}
                  accessibilityHint="Opens this existing discussion instead of posting a new one"
                >
                  <AccessibleText variant="body" style={[styles.suggestionTitle, { color: colors.text }]}>
                    {item.title}
                  </AccessibleText>
                  <View style={styles.suggestionMeta}>
                    <AccessibleText variant="caption" style={[styles.suggestionCategory, { color: colors.subtext }]}>
                      Category: {item.category}
                    </AccessibleText>
                    {/* Note: the solved-status green is a semantic status color with no
                        ThemeColors equivalent, so it is intentionally left as a literal,
                        consistent with how QuestionDetailsScreen.tsx treats this same color. */}
                    {item.status === "SOLVED" && (
                      <View style={styles.solvedBadge}>
                        <Check size={10} color="#16A34A" />
                        <AccessibleText variant="overline" style={styles.solvedText}>
                          SOLVED
                        </AccessibleText>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <AccessibleButton
                variant="outline"
                accessibilityLabel="Edit my post"
                accessibilityHint="Close this dialog and keep editing your question"
                style={styles.modalCancelBtn}
                onPress={() => setShowDuplicateModal(false)}
              >
                Edit My Post
              </AccessibleButton>

              <AccessibleButton
                variant="primary"
                accessibilityLabel="Post anyway"
                accessibilityHint="Posts your question even though similar ones already exist"
                style={styles.modalSubmitBtn}
                onPress={submitPost}
              >
                Post Anyway
              </AccessibleButton>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default AskQuestionScreen;

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
  scrollContent: {
    padding: 20
  },
  helpCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 14,
    marginBottom: 20
  },
  helpText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500"
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8
  },
  descriptionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  voiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  voiceBtnText: {
    fontSize: 12,
    fontWeight: "700"
  },
  textInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 15,
    marginBottom: 20,
    fontWeight: "500"
  },
  dropdown: {
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 20
  },
  placeholderStyle: {
    fontSize: 15
  },
  selectedTextStyle: {
    fontSize: 15,
    fontWeight: "500"
  },
  textArea: {
    height: 120,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 16
  },
  imageSection: {
    marginBottom: 24
  },
  altTextLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 6
  },
  altTextInput: {
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 13
  },
  imagePickerBtn: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24
  },
  imagePickerText: {
    fontSize: 13,
    fontWeight: "600"
  },
  imagePreviewContainer: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden"
  },
  imagePreview: {
    width: "100%",
    height: 200,
    resizeMode: "cover"
  },
  removeImageBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center"
  },
  submitBtn: {
    borderRadius: 14,
    height: 52,
    marginTop: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  modalContent: {
    borderRadius: 24,
    width: "100%",
    padding: 20,
    maxHeight: "80%"
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingBottom: 12,
    marginBottom: 14
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800"
  },
  modalSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16
  },
  suggestionsScroll: {
    marginBottom: 20
  },
  suggestionCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: 8
  },
  suggestionMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  suggestionCategory: {
    fontSize: 11,
    fontWeight: "600"
  },
  solvedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  solvedText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#16A34A",
    marginLeft: 4
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    marginRight: 10
  },
  modalSubmitBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12
  }
});
