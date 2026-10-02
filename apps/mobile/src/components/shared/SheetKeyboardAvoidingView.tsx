// ─────────────────────────────────────────────────────────────
// The app's one keyboard-avoiding wrapper for bottom sheets and modals.
//
// Built on react-native-keyboard-controller (KeyboardProvider in App.tsx)
// rather than RN's KeyboardAvoidingView. RN's version needed a different
// `behavior` per platform — leaving it undefined on Android disabled
// avoidance entirely, and commits fb11b56 and cd5c19b re-fixed that same bug
// twice — and inside an RN Modal it didn't reliably move the sheet on
// Android, which is how the Alt Text field ended up under the keyboard.
// keyboard-controller tracks the keyboard natively on both platforms,
// Modals included, so "padding" is right everywhere.
// `keyboardVerticalOffset` stays caller-supplied since that varies
// legitimately per screen (modal sheet vs. full screen with a header).
// ─────────────────────────────────────────────────────────────

import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

export function SheetKeyboardAvoidingView({
  children,
  style,
  keyboardVerticalOffset = 0,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
}) {
  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={style}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
