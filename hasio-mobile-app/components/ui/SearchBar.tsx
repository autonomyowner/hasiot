import React, { useRef } from "react";
import { View, TextInput, Pressable, StyleSheet, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";

interface SearchBarProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  isRTL?: boolean;
  /**
   * Caption above the input ("Where to?"). With it the pill grows a lime
   * search disc and a two-line field; without it this is the old one-line pill,
   * which is what the screens that only want a filter box still get.
   */
  label?: string;
  /** Omit to hide the filter button entirely — it was a dead View before. */
  onFilterPress?: () => void;
  /** How many filters are set; shown as a count on the button. */
  filterCount?: number;
}

export function SearchBar({
  placeholder,
  value,
  onChangeText,
  isRTL = false,
  label,
  onFilterPress,
  filterCount = 0,
}: SearchBarProps) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useLanguage();
  const inputRef = useRef<TextInput>(null);

  return (
    // The whole pill is the hit target: at 60pt tall the caption and the
    // padding are most of it, and a tap that lands there and does nothing reads
    // as a broken control. `accessible={false}` keeps the wrapper out of the
    // a11y tree so the input and the buttons keep their own semantics.
    <Pressable
      style={[styles.container, isRTL && styles.containerRTL]}
      onPress={() => inputRef.current?.focus()}
      accessible={false}
    >
      {label ? (
        <View style={styles.lead}>
          <Feather name="search" size={18} color={colors.ink} />
        </View>
      ) : (
        <Feather name="search" size={18} color={colors.onSurface.muted} />
      )}

      <View style={styles.field}>
        {label ? (
          <Text style={[styles.label, isRTL && styles.textRTL]} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
        {/* A search box, not a sentence: the keyboard offers Search rather
            than Return, and autocorrect no longer gets to rewrite a place
            name it does not know into a word it does before the search
            ever sees it. */}
        <TextInput
          ref={inputRef}
          style={[label ? styles.inputCaptioned : styles.input, isRTL && styles.inputRTL]}
          placeholder={placeholder}
          placeholderTextColor={colors.onSurface.muted}
          value={value}
          onChangeText={onChangeText}
          textAlign={isRTL ? "right" : "left"}
          returnKeyType="search"
          enablesReturnKeyAutomatically
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {value.length > 0 ? (
        // A full 44pt square with a name: it was an 18pt icon with 8pt of
        // slop and nothing for a screen reader to call it.
        <Pressable
          onPress={() => onChangeText("")}
          style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t("clearSearch")}
        >
          <Feather name="x-circle" size={18} color={colors.onSurface.muted} />
        </Pressable>
      ) : onFilterPress ? (
        <Pressable
          onPress={onFilterPress}
          style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
          hitSlop={8}
          accessibilityRole="button"
          // The count in words. It was a hard-coded English "Filters" with
          // the count reported as `expanded`, which tells a screen reader a
          // menu is open rather than that filters are on.
          accessibilityLabel={
            filterCount > 0
              ? t("filtersActiveCount").replace("{n}", String(filterCount))
              : t("filters")
          }
        >
          {filterCount > 0 ? (
            <Text style={styles.filterCount}>{filterCount}</Text>
          ) : (
            <Feather name="sliders" size={16} color={colors.ink} />
          )}
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  filterCount: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 30,
    minHeight: 60,
    paddingLeft: 10,
    paddingRight: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  // The two paddings swap with the row, so the lime disc keeps the tighter
  // inset and the trailing button the looser one in either direction.
  containerRTL: {
    flexDirection: "row-reverse",
    paddingLeft: 12,
    paddingRight: 10,
  },
  // Lime is a fill only, so the glyph on it is ink — white here is 1.4:1.
  lead: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
  },
  // Symmetric padding rather than a margin on the icon: it is the gap on
  // whichever side the row happens to run.
  field: {
    flex: 1,
    paddingHorizontal: 12,
  },
  label: {
    fontSize: 10.5,
    fontFamily: fonts.semibold,
    color: colors.onSurface.muted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  textRTL: {
    textAlign: "right",
  },
  input: {
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 8,
    fontFamily: fonts.regular,
  },
  // Pinned to its line box: under a caption, the platform's own vertical
  // padding is what pushes the pair off-centre in the pill. A minimum rather
  // than a fixed height, though: at 22pt, large accessibility text sizes (and
  // Cairo's taller line) were cut off inside the field.
  inputCaptioned: {
    fontSize: 15,
    minHeight: 22,
    color: colors.ink,
    paddingVertical: 0,
    includeFontPadding: false,
    fontFamily: fonts.medium,
  },
  inputRTL: {
    writingDirection: "rtl",
  },
  clearButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
