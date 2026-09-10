// ─────────────────────────────────────────────────────────────
// Drop-in replacement for RN's KeyboardAvoidingView, hardcoding the one
// thing that has repeatedly gone wrong across this app's history: Android
// needs an explicit `behavior` too. Leaving it `undefined` on Android
// disables keyboard avoidance entirely (see AltTextModal.tsx's git
// history — commits fb11b56 and cd5c19b re-fixed this same class of bug
// twice). Every consumer here always gets "padding" on iOS / "height" on
// Android; `keyboardVerticalOffset` stays caller-supplied since that
// varies legitimately per screen (modal sheet vs. full screen with a
// header).
// ─────────────────────────────────────────────────────────────

import React from "react";
import { KeyboardAvoidingView, Platform, StyleProp, ViewStyle } from "react-native";

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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={style}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
