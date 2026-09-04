// ─────────────────────────────────────────────────────────────
// DisabilityDropdown — searchable, checkbox-style multi/single-select
// dropdown for "Disability Type(s)" fields. Extracted from
// ProfileDetailsScreen.tsx (onboarding) so Edit Profile can use the exact
// same picker instead of its own, differently-behaving horizontal chip row
// for the same field. Owns its own open/search state — callers only need
// to track the selected value(s).
// ─────────────────────────────────────────────────────────────

import React, { useState } from "react";
import { View, StyleSheet, TouchableOpacity, TextInput, ScrollView } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "./AccessibleText";

export function DisabilityDropdown({
  options,
  selected,
  onToggle,
  label,
  multi = true,
}: {
  options: string[];
  selected: string[];
  onToggle: (item: string) => void;
  label: string;
  multi?: boolean;
}) {
  const { colors, highContrast } = useTheme();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const triggerText =
    selected.length === 0
      ? (multi ? "Select disability type(s)" : "Select disability type")
      : multi
        ? `${selected.length} selected`
        : selected.join(", ");

  return (
    <>
      <TouchableOpacity
        style={[styles.dropdownTrigger, { backgroundColor: colors.surface }, highContrast && { borderWidth: 2, borderColor: "#000000" }]}
        activeOpacity={0.8}
        onPress={() => {
          setOpen(!open);
          setSearch("");
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={
          selected.length > 0
            ? `Currently ${selected.join(", ")}. Double tap to change your ${multi ? "disability types" : "disability type"}`
            : `Double tap to choose ${multi ? "one or more disability types" : "a disability type"}`
        }
        accessibilityState={{ expanded: open }}
      >
        <AccessibleText style={[styles.dropdownValue, { color: selected.length ? colors.text : colors.subtext }]}>
          {triggerText}
        </AccessibleText>
        <AccessibleText style={[styles.dropdownArrow, { color: colors.subtext }]}>{open ? "▲" : "▼"}</AccessibleText>
      </TouchableOpacity>

      {/* Selected chips: clear visual confirmation of multi-select picks,
          each removable directly without reopening the panel. */}
      {multi && selected.length > 0 && (
        <View style={styles.selectedChipsRow}>
          {selected.map((item) => (
            <View
              key={item}
              style={[
                styles.selectedChip,
                { backgroundColor: highContrast ? "#000000" : "rgba(80,0,136,0.1)" },
              ]}
            >
              <AccessibleText
                style={[styles.selectedChipText, { color: highContrast ? "#FFFFFF" : colors.primary }]}
              >
                {item}
              </AccessibleText>
              <TouchableOpacity
                onPress={() => onToggle(item)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <AccessibleText
                  style={[styles.selectedChipRemove, { color: highContrast ? "#FFFFFF" : colors.primary }]}
                >
                  ✕
                </AccessibleText>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {open && (
        <View style={[styles.dropdownPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.dropdownSearch, { borderBottomColor: colors.border }]}>
            <AccessibleText style={styles.searchIcon}>🔍</AccessibleText>
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search..."
              placeholderTextColor={colors.subtext}
              value={search}
              onChangeText={setSearch}
              autoFocus
              accessibilityLabel="Search disability types"
            />
          </View>
          <ScrollView style={styles.dropdownList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {options
              .filter((o) => o.toLowerCase().includes(search.toLowerCase()))
              .map((item) => {
                const isSelected = selected.includes(item);
                return (
                  <TouchableOpacity
                    key={item}
                    style={[
                      styles.dropdownOption,
                      { borderBottomColor: colors.border },
                      isSelected && { backgroundColor: highContrast ? "#000000" : "rgba(80,0,136,0.06)" },
                    ]}
                    onPress={() => {
                      onToggle(item);
                      if (!multi) {
                        setOpen(false);
                        setSearch("");
                      }
                    }}
                    accessibilityRole={multi ? "checkbox" : "radio"}
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={item}
                  >
                    <AccessibleText
                      style={[
                        styles.dropdownOptionText,
                        { color: isSelected ? colors.primary : colors.text },
                        isSelected && highContrast && { color: "#FFFFFF", fontWeight: "700" },
                      ]}
                    >
                      {item}
                    </AccessibleText>
                    {isSelected && (
                      <AccessibleText style={[styles.checkmark, { color: highContrast ? "#FFFFFF" : colors.primary }]}>✓</AccessibleText>
                    )}
                  </TouchableOpacity>
                );
              })}
            {options.filter((o) => o.toLowerCase().includes(search.toLowerCase())).length === 0 && (
              <AccessibleText style={[styles.noResults, { color: colors.subtext }]}>No results</AccessibleText>
            )}
          </ScrollView>

          {/* Multi-select never auto-closes on tap (so multiple picks are
              easy) — give it an explicit, obvious way to close instead. */}
          {multi && (
            <TouchableOpacity
              style={[styles.dropdownDoneBtn, { backgroundColor: highContrast ? "#000000" : colors.primary }]}
              onPress={() => {
                setOpen(false);
                setSearch("");
              }}
              accessibilityRole="button"
              accessibilityLabel="Done selecting"
            >
              <AccessibleText style={styles.dropdownDoneBtnText}>
                Done{selected.length > 0 ? ` (${selected.length} selected)` : ""}
              </AccessibleText>
            </TouchableOpacity>
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  dropdownTrigger: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dropdownValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },

  dropdownArrow: {
    fontSize: 11,
    marginLeft: 8,
  },

  selectedChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },

  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    borderRadius: 16,
    gap: 6,
  },

  selectedChipText: {
    fontSize: 13,
    fontWeight: "600",
  },

  selectedChipRemove: {
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 2,
  },

  dropdownPanel: {
    marginTop: 6,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 4,
  },

  dropdownSearch: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },

  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
  },

  dropdownList: {
    maxHeight: 200,
  },

  dropdownOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },

  dropdownOptionText: {
    flex: 1,
    fontSize: 14,
  },

  checkmark: {
    fontSize: 14,
    fontWeight: "700",
  },

  noResults: {
    padding: 16,
    textAlign: "center",
    fontSize: 13,
  },

  dropdownDoneBtn: {
    marginTop: 10,
    marginHorizontal: 12,
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },

  dropdownDoneBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
