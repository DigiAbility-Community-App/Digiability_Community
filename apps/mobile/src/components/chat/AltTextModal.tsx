// ─────────────────────────────────────────────────────────────
// AltTextModal — shown after picking an image. Lets the sender add a
// short description that becomes the screen-reader alt text for the
// image. Works on both iOS and Android (RN has no native text prompt).
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { SheetKeyboardAvoidingView } from "../shared/SheetKeyboardAvoidingView";

export function AltTextModal({
  visible,
  imageUri,
  onCancel,
  onSend,
}: {
  visible: boolean;
  imageUri: string | null;
  onCancel: () => void;
  onSend: (altText: string) => void;
}) {
  const [altText, setAltText] = useState("");

  useEffect(() => {
    if (visible) setAltText("");
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onCancel}
      >
        <SheetKeyboardAvoidingView
          keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
          style={{ width: "100%", justifyContent: "flex-end", flex: 1 }}
        >
          <TouchableOpacity activeOpacity={1} style={styles.card} onPress={() => {}}>
            <Text style={styles.title}>Share image</Text>
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" /> : null}
              <Text style={styles.label}>Add a caption (shown to recipients, also read aloud by screen readers)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. My new wheelchair ramp at the entrance"
                placeholderTextColor="#999"
                value={altText}
                onChangeText={setAltText}
                multiline
                maxLength={300}
                accessibilityLabel="Image description"
              />
            </ScrollView>
            {/* Kept outside the scroll area so the buttons stay reachable. */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendBtn} onPress={() => onSend(altText)}>
                <Text style={styles.sendText}>Send</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </SheetKeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    // Cap the sheet so a tall image can't push the input under the keyboard.
    maxHeight: "85%",
  },
  scrollArea: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  preview: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#eee",
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e0d7f0",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: "top",
    color: "#1a1a1a",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#f0ecf5",
  },
  cancelText: {
    color: "#666",
    fontWeight: "600",
  },
  sendBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: "#8A38F5",
  },
  sendText: {
    color: "#fff",
    fontWeight: "700",
  },
});
