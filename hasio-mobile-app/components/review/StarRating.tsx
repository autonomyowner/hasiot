import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";

interface StarRatingProps {
  /** 0–5. A half-star renders as filled — the input only ever produces whole stars. */
  value: number;
  size?: number;
  /** Passing this makes the row interactive. Omit it for a read-only display. */
  onChange?: (value: number) => void;
  /** Accessible name for the interactive row, e.g. "Rate this place". */
  label?: string;
}

const STARS = [1, 2, 3, 4, 5];

/**
 * Five stars, read-only or tappable.
 *
 * The row mirrors in Arabic, so the first star sits on the right and tapping
 * the rightmost gives one star — the same gesture an Arabic reader expects
 * from a row that fills from where reading begins.
 */
export function StarRating({ value, size = 18, onChange, label }: StarRatingProps) {
  const styles = useThemedStyles(makeStyles);
  const { isRTL } = useLanguage();
  const interactive = !!onChange;

  return (
    <View
      style={[styles.row, isRTL && styles.rowRTL]}
      accessibilityRole={interactive ? "adjustable" : "image"}
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 5, now: value }}
    >
      {STARS.map((star) => {
        const filled = star <= Math.round(value);
        const icon = (
          <Feather
            name="star"
            size={size}
            // Feather ships an outline star and no solid one, so "filled" is
            // the warm accent at full strength and "empty" is the same outline
            // dropped to a muted grey — cheaper than shipping a second icon set.
            color={filled ? colors.warm : colors.onSurface.muted}
            style={filled ? styles.filled : styles.empty}
          />
        );

        if (!interactive) return <View key={star}>{icon}</View>;

        return (
          <Pressable
            key={star}
            onPress={() => onChange(star)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${star}`}
          >
            {icon}
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (_fonts: AppFonts) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 3 },
    rowRTL: { flexDirection: "row-reverse" },
    filled: { opacity: 1 },
    empty: { opacity: 0.35 },
  });
