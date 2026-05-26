import React, { useState } from "react";
import {
  View,
  Text,
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
        <View style={styles.modalContent}>
          {/* HEADER */}
          <View style={styles.header}>
            <Text style={styles.title}>Post an Answer</Text>
            <TouchableOpacity onPress={onClose} disabled={loading} style={styles.closeBtn}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* INPUT */}
          <TextInput
            style={styles.textArea}
            placeholder="Write your advice, solution, or experience..."
            placeholderTextColor="#9CA3AF"
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
              >
                <X size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.attachImageBtn} onPress={handlePickImage} disabled={loading}>
              <Camera size={20} color="#6B7280" style={{ marginRight: 8 }} />
              <Text style={styles.attachImageText}>Attach photo</Text>
            </TouchableOpacity>
          )}

          {/* ACTIONS */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.submitBtn]}
              onPress={handleSend}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Answer</Text>
              )}
            </TouchableOpacity>
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
    backgroundColor: "#FFFFFF",
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
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6"
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1B20"
  },
  closeBtn: {
    padding: 4
  },
  textArea: {
    backgroundColor: "#F4F3FA",
    borderRadius: 14,
    padding: 16,
    height: 120,
    fontSize: 15,
    color: "#1A1B20",
    fontWeight: "500",
    marginBottom: 16
  },
  attachImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#F4F3FA",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 20
  },
  attachImageText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4B5563"
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
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center"
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: "#E5E7EB"
  },
  submitBtn: {
    backgroundColor: "#500088"
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#4B5563"
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF"
  }
});
