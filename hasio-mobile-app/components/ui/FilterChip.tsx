import React from "react";
import { Text, StyleSheet, View } from "react-native";
import { colors, type AppFonts } from "@/constants/colors";
import {
  CHIP_PADDING_VERTICAL,
  CHIP_TARGET_INSET,
  CHIP_TEXT,
} from "@/constants/layout";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { PressableScale } from "./PressableScale";
import { PRESS_SCALE_CHIP } from "@/constants/motion";

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * One chip in a row of filters.
 *
 * It carries no margin of its own: the row sets the spacing with `gap`
 * (`CHIP_GAP`). The chip used to bring a `marginRight`, which in a mirrored
 * Arabic row lands on the wrong side — the first chip then sat 10pt in from
 * the edge the title above it starts at.
 *
 * The pressable is taller than the pill it draws, by `CHIP_TARGET_INSET` above
 * and below, so the chip is a 44pt target. That band is part of the chip's own
 * box rather than a `hitSlop` because slop reaching outside the parent's
 * bounds is never hit-tested, and every row these chips sit in — a FlatList
 * cell, a tab row — is exactly one chip tall.
 */
export function FilterChip({ label, selected, onPress }: FilterChipProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <PressableScale
      style={styles.target}
      scaleTo={PRESS_SCALE_CHIP}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <View style={[styles.chip, selected && styles.chipSelected]}>
        <Text style={[styles.label, selected && styles.labelSelected]}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  target: {
    paddingVertical: CHIP_TARGET_INSET,
  },
  // Ink-on-white pills: green stays reserved for the tab puck and prices.
  chip: {
    paddingVertical: CHIP_PADDING_VERTICAL,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.surface.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  // A set line height, so the pill is the same height the skeleton reserves
  // for it in either script — see CHIP_TEXT.
  label: {
    fontSize: CHIP_TEXT.fontSize,
    lineHeight: CHIP_TEXT.lineHeight,
    fontFamily: fonts.medium,
    color: colors.onSurface.variant,
  },
  labelSelected: {
    color: "#FFFFFF",
    fontFamily: fonts.semibold,
  },
});
