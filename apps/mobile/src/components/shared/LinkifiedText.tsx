// ─────────────────────────────────────────────────────────────
// LinkifiedText — detects URLs in text and makes them tappable.
//
// Splits the string on http/https URLs, renders plain segments as
// AccessibleText and detected URLs as underlined, tappable spans
// that open in the system browser via Linking.
// ─────────────────────────────────────────────────────────────

import React from "react";
import { Linking, TextStyle, StyleProp } from "react-native";
import { AccessibleText, AccessibleTextProps } from "./AccessibleText";

const URL_REGEX = /(https?:\/\/[^\s<>"']+)/gi;

interface LinkifiedTextProps extends AccessibleTextProps {
  /** The raw text that may contain URLs. */
  text: string;
  /** Style for the entire text (non-link segments). */
  style?: StyleProp<TextStyle>;
  /** Style override for the link segments. */
  linkStyle?: StyleProp<TextStyle>;
}

export function LinkifiedText({ text, style, linkStyle, ...rest }: LinkifiedTextProps) {
  const parts = text.split(URL_REGEX);

  // No URLs found — render plain text efficiently
  if (parts.length === 1) {
    return (
      <AccessibleText style={style} {...rest}>
        {text}
      </AccessibleText>
    );
  }

  return (
    <AccessibleText style={style} {...rest}>
      {parts.map((part, i) => {
        // Reset global regex state
        URL_REGEX.lastIndex = 0;
        if (URL_REGEX.test(part)) {
          URL_REGEX.lastIndex = 0;
          return (
            <AccessibleText
              key={i}
              style={[{ textDecorationLine: "underline" }, linkStyle]}
              onPress={() => {
                Linking.openURL(part).catch((err) =>
                  console.warn("Failed to open URL:", err)
                );
              }}
              accessibilityRole="link"
              accessibilityLabel={`Open link: ${part}`}
              suppressHighlighting={false}
            >
              {part}
            </AccessibleText>
          );
        }
        return part;
      })}
    </AccessibleText>
  );
}
