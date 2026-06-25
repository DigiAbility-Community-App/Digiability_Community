import React, { useState, useEffect } from "react";
import {
  View,
  Text,
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
import { AccessibleText } from "../../components/shared/AccessibleText";

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

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color="#1A1B20" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ask a Question</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* HELP TEXT */}
        <View style={styles.helpCard}>
          <HelpCircle size={20} color="#7E22CE" style={{ marginRight: 10 }} />
          <Text style={styles.helpText}>
            Describe your problem clearly. Other members of the community can upvote or answer your post.
          </Text>
        </View>

        {/* TITLE */}
        <Text style={styles.inputLabel}>Title</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g. Tips for managing evening restlessness?"
          value={title}
          onChangeText={setTitle}
          accessibilityLabel="Question Title"
          accessibilityHint="Summarize your question briefly"
        />

        {/* CATEGORY DROPDOWN */}
        <Text style={styles.inputLabel}>Category</Text>
        <Dropdown
          style={styles.dropdown}
          placeholderStyle={styles.placeholderStyle}
          selectedTextStyle={styles.selectedTextStyle}
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
          <Text style={styles.inputLabel}>Description</Text>
          <TouchableOpacity
            onPress={handleVoiceTyping}
            style={styles.voiceBtn}
            accessibilityRole="button"
            accessibilityLabel="Voice typing — coming soon"
          >
            <Mic size={14} color="#7E22CE" style={{ marginRight: 4 }} />
            <Text style={styles.voiceBtnText}>Voice Type</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="Provide more context or list things you have tried..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          accessibilityLabel="Question Description"
          accessibilityHint="Detail your question here"
        />

        {/* TAGS */}
        <Text style={styles.inputLabel}>Tags (comma-separated)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g. Autism, Therapy, Parent Help"
          value={tags}
          onChangeText={setTags}
          accessibilityLabel="Tags input"
          accessibilityHint="Separate tags using commas"
        />

        {/* IMAGE PICKER */}
        <Text style={styles.inputLabel}>Optional Image</Text>
        {imageUri ? (
          <View style={styles.imageSection}>
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
              <TouchableOpacity style={styles.removeImageBtn} onPress={handleClearImage}>
                <X size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* ALT TEXT INPUT */}
            <Text style={styles.altTextLabel}>Alt Text Description (for Screen Readers)</Text>
            <TextInput
              style={styles.altTextInput}
              placeholder="e.g., A child playing with sensory toys in a quiet room"
              value={altText}
              onChangeText={setAltText}
              accessibilityLabel="Image Description Alt Text"
            />
          </View>
        ) : (
          <TouchableOpacity style={styles.imagePickerBtn} onPress={handlePickImage}>
            <Camera size={24} color="#6B7280" style={{ marginBottom: 6 }} />
            <Text style={styles.imagePickerText}>Upload Image</Text>
          </TouchableOpacity>
        )}

        {/* SUBMIT BUTTON */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={checkAndSubmit}
          disabled={actionLoading || isCheckingDuplicates}
        >
          {actionLoading || isCheckingDuplicates ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>Post Question</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* DUPLICATE WARNING MODAL */}
      <Modal
        visible={showDuplicateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDuplicateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Similar Questions Found</Text>
              <TouchableOpacity onPress={() => setShowDuplicateModal(false)}>
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              We found some existing posts that might already solve your issue:
            </Text>

            <ScrollView style={styles.suggestionsScroll}>
              {duplicateSuggestions.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.suggestionCard}
                  onPress={() => {
                    setShowDuplicateModal(false);
                    navigation.navigate("QuestionDetails", { questionId: item.id });
                  }}
                >
                  <Text style={styles.suggestionTitle}>{item.title}</Text>
                  <View style={styles.suggestionMeta}>
                    <Text style={styles.suggestionCategory}>Category: {item.category}</Text>
                    {item.status === "SOLVED" && (
                      <View style={styles.solvedBadge}>
                        <Check size={10} color="#16A34A" />
                        <Text style={styles.solvedText}>SOLVED</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowDuplicateModal(false)}
              >
                <Text style={styles.modalCancelBtnText}>Edit My Post</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalSubmitBtn} onPress={submitPost}>
                <Text style={styles.modalSubmitBtnText}>Post Anyway</Text>
              </TouchableOpacity>
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
    flex: 1,
    backgroundColor: "#FFFFFF"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  scrollContent: {
    padding: 20
  },
  helpCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 20
  },
  helpText: {
    flex: 1,
    fontSize: 13,
    color: "#6B21A8",
    lineHeight: 18,
    fontWeight: "500"
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4C4452",
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
    borderColor: "#E9D5FF",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#FAF8FF"
  },
  voiceBtnRecording: {
    backgroundColor: "#EF4444",
    borderColor: "#EF4444"
  },
  voiceBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7E22CE"
  },
  voiceBtnTextRecording: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  textInput: {
    backgroundColor: "#F4F3FA",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 15,
    color: "#1A1B20",
    marginBottom: 20,
    fontWeight: "500"
  },
  dropdown: {
    backgroundColor: "#F4F3FA",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 20
  },
  placeholderStyle: {
    fontSize: 15,
    color: "#9CA3AF"
  },
  selectedTextStyle: {
    fontSize: 15,
    color: "#1A1B20",
    fontWeight: "500"
  },
  textArea: {
    height: 120,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 16
  },
  audioPreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20
  },
  audioPreviewText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E40AF"
  },
  removeAudioBtn: {
    padding: 4
  },
  imageSection: {
    marginBottom: 24
  },
  altTextLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4B5563",
    marginTop: 10,
    marginBottom: 6
  },
  altTextInput: {
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 13,
    color: "#1F2937"
  },
  imagePickerBtn: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    borderRadius: 12,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    backgroundColor: "#FAF9F6"
  },
  imagePickerText: {
    fontSize: 13,
    color: "#6B7280",
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
    backgroundColor: "#500088",
    borderRadius: 14,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#500088",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
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
    borderBottomColor: "#EEEDF4",
    paddingBottom: 12,
    marginBottom: 14
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1B20"
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    marginBottom: 16
  },
  suggestionsScroll: {
    marginBottom: 20
  },
  suggestionCard: {
    backgroundColor: "#FAF8FF",
    borderWidth: 1,
    borderColor: "#E2D3FD",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1B20",
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
    color: "#6B7280",
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
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    marginRight: 10
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4B5563"
  },
  modalSubmitBtn: {
    flex: 1,
    backgroundColor: "#500088",
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12
  },
  modalSubmitBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF"
  }
});
