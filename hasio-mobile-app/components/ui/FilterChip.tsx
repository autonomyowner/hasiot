import React from "react";
import { Text, StyleSheet } from "react-native";
import { colors, type AppFonts } from "@/constants/colors";
import { CHIP_PADDING_VERTICAL, CHIP_TEXT } from "@/constants/layout";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { PressableScale } from "./PressableScale";
import { PRESS_SCALE_CHIP } from "@/constants/motion";

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

// A chip is 36pt tall; this makes the row it sits in a 44pt target without
// reaching sideways into the next chip.
const CHIP_HIT_SLOP = { top: 4, bottom: 4 } as const;

/**
 * One chip in a row of filters. It carries no margin of its own: the row sets
 * the spacing with `gap` (`CHIP_GAP`). The chip used to bring a `marginRight`,
 * which in a mirrored Arabic row lands on the wrong side — the first chip then
 * sat 10pt in from the edge the title above it starts at.
 */
export function FilterChip({ label, selected, onPress }: FilterChipProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <PressableScale
      style={[styles.chip, selected && styles.chipSelected]}
      scaleTo={PRESS_SCALE_CHIP}
      onPress={onPress}
      hitSlop={CHIP_HIT_SLOP}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>
    </PressableScale>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
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
  // A set line height, so the chip is the same height the skeleton reserves
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
