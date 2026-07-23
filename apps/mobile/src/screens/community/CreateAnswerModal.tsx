import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert
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
  loading
}: CreateAnswerModalProps) => {
  const { colors, highContrast } = useTheme();
  const [content, setContent] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8
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
      onClose();
    } catch (e) {
      // Error handled by parent store
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          {/* HEADER */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <AccessibleText variant="title" style={[styles.title, { color: colors.text }]}>
              Post an Answer
            </AccessibleText>
            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
              accessibilityHint="Closes this dialog without posting an answer"
            >
              <X size={20} color={colors.subtext} />
            </TouchableOpacity>
          </View>

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
            numberOfLines={5}
            textAlignVertical="top"
            editable={!loading}
            accessibilityLabel="Write your answer"
          />

          {/* IMAGE ATTACHMENT */}
          {imageUri ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
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
              style={[styles.attachImageBtn, { backgroundColor: colors.surface }]}
              onPress={handlePickImage}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Attach photo"
              accessibilityHint="Opens your photo library to attach an image to your answer"
            >
              <Camera size={20} color={colors.subtext} style={{ marginRight: 8 }} />
              <AccessibleText variant="caption" style={[styles.attachImageText, { color: colors.subtext }]}>
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
              onPress={onClose}
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
              {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : "Submit Answer"}
            </AccessibleButton>
          </View>
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
    justifyContent: "flex-end"
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    maxHeight: "80%"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1
  },
  title: {
    fontSize: 18,
    fontWeight: "800"
  },
  closeBtn: {
    padding: 4
  },
  textArea: {
    borderRadius: 14,
    padding: 16,
    height: 120,
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 16
  },
  attachImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 20
  },
  attachImageText: {
    fontSize: 13,
    fontWeight: "700"
  },
  imagePreviewContainer: {
    position: "relative",
    width: 120,
    height: 90,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 20
  },
  imagePreview: {
    width: "100%",
    height: "100%",
    resizeMode: "cover"
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
    alignItems: "center"
  },
  actions: {
    flexDirection: "row",
    gap: 12
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 12
  }
});
