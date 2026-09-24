import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import { countLabel } from "@/lib/bookingDisplay";

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
 *
 * To a screen reader the tappable row is a choice of one ("3 stars",
 * checked), and the read-only one a single "4.2 out of 5 stars". The buttons
 * used to be named "1" … "5", and the display five unnamed glyphs.
 */
export function StarRating({ value, size = 18, onChange, label }: StarRatingProps) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL } = useLanguage();
  const chosen = Math.round(value);

  const icon = (star: number) => {
    const filled = star <= chosen;
    return (
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
  };

  if (!onChange) {
    const score = Number.isInteger(value) ? String(value) : value.toFixed(1);
    return (
      <View
        style={[styles.row, isRTL && styles.rowRTL]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t("starsOutOfFive").replace("{n}", score)}
      >
        {STARS.map((star) => (
          <View key={star}>{icon(star)}</View>
        ))}
      </View>
    );
  }

  return (
    <View
      style={[styles.row, isRTL && styles.rowRTL]}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {STARS.map((star) => (
        <Pressable
          key={star}
          onPress={() => onChange(star)}
          hitSlop={6}
          style={({ pressed }) => pressed && styles.pressed}
          accessibilityRole="radio"
          accessibilityState={{ checked: star === chosen }}
          accessibilityLabel={countLabel(star, "stars", t)}
        >
          {icon(star)}
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (_fonts: AppFonts) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 3 },
    rowRTL: { flexDirection: "row-reverse" },
    filled: { opacity: 1 },
    empty: { opacity: 0.35 },
    pressed: { opacity: 0.6 },
  });
