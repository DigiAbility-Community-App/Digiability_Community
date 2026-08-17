import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
} from "react-native";
import { Camera, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";

interface CreateAnswerModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (content: string, imageUri: string | null) => Promise<void>;
  loading: boolean;
}

const CreateAnswerModal = ({
  visible,
  onClose,
  onSubmit,
  loading,
}: CreateAnswerModalProps) => {
  const { colors, highContrast } = useTheme();
  const [content, setContent] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Dynamic keyboard tracking for rock-solid Android and iOS support
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleClearImage = () => {
    setImageUri(null);
  };

  const handleSend = async () => {
    if (!content.trim()) {
      Alert.alert("Required", "Please write an answer first.");
      return;
    }

    try {
      await onSubmit(content.trim(), imageUri);
      setContent("");
      setImageUri(null);
      Keyboard.dismiss();
      onClose();
    } catch {
      // Error handled by parent store
    }
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  const screenHeight = Dimensions.get("window").height;
  const isKeyboardActive = keyboardHeight > 0;
  const dynamicMaxHeight = isKeyboardActive
    ? Math.max(screenHeight - keyboardHeight - 50, 280)
    : screenHeight * 0.85;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View
        style={[
          styles.overlay,
          { paddingBottom: isKeyboardActive ? keyboardHeight : 0 },
        ]}
      >
        {/* Semi-transparent backdrop to dismiss */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        {/* Modal content container pinned directly above the keyboard */}
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.card,
              maxHeight: dynamicMaxHeight,
            },
          ]}
        >
          {/* DRAG HANDLE */}
          <View style={styles.dragHandleContainer}>
            <View
              style={[
                styles.dragHandle,
                { backgroundColor: colors.border || "#E2E8F0" },
              ]}
            />
          </View>

          {/* HEADER */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <AccessibleText
              variant="title"
              style={[styles.title, { color: colors.text }]}
            >
              Post an Answer
            </AccessibleText>
            <TouchableOpacity
              onPress={handleClose}
              disabled={loading}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
              accessibilityHint="Closes this dialog without posting an answer"
            >
              <X size={20} color={colors.subtext} />
            </TouchableOpacity>
          </View>

          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.scrollBody}
          >
            {/* INPUT */}
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: colors.surface, color: colors.text },
                highContrast && { borderWidth: 1, borderColor: "#000000" },
              ]}
              placeholder="Write your advice, solution, or experience..."
              placeholderTextColor={colors.subtext}
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!loading}
              accessibilityLabel="Write your answer"
            />

            {/* IMAGE ATTACHMENT */}
            {imageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.imagePreview}
                />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={handleClearImage}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Remove attached image"
                >
                  <X size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.attachImageBtn,
                  { backgroundColor: colors.surface },
                ]}
                onPress={handlePickImage}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Attach photo"
                accessibilityHint="Opens your photo library to attach an image to your answer"
              >
                <Camera
                  size={20}
                  color={colors.subtext}
                  style={{ marginRight: 8 }}
                />
                <AccessibleText
                  variant="caption"
                  style={[styles.attachImageText, { color: colors.subtext }]}
                >
                  Attach photo
                </AccessibleText>
              </TouchableOpacity>
            )}

            {/* ACTIONS */}
            <View style={styles.actions}>
              <AccessibleButton
                variant="outline"
                accessibilityLabel="Cancel"
                accessibilityHint="Closes this dialog without posting an answer"
                style={styles.btn}
                onPress={handleClose}
                disabled={loading}
              >
                Cancel
              </AccessibleButton>

              <AccessibleButton
                variant="primary"
                accessibilityLabel="Submit answer"
                accessibilityHint="Posts your answer to this discussion"
                style={styles.btn}
                onPress={handleSend}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  "Submit Answer"
                )}
              </AccessibleButton>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default CreateAnswerModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: "100%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 28 : 20,
    elevation: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingVertical: 6,
    marginBottom: 4,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
  },
  closeBtn: {
    padding: 4,
  },
  scrollBody: {
    paddingBottom: 10,
  },
  textArea: {
    borderRadius: 14,
    padding: 14,
    minHeight: 100,
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 14,
  },
  attachImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 16,
  },
  attachImageText: {
    fontSize: 13,
    fontWeight: "700",
  },
  imagePreviewContainer: {
    position: "relative",
    width: 120,
    height: 90,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 16,
  },
  imagePreview: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  removeImageBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
  },
});
