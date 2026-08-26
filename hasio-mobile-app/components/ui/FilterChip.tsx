import React from "react";
import { Text, StyleSheet } from "react-native";
import { colors, fonts } from "@/constants/colors";
import { PressableScale } from "./PressableScale";
import { PRESS_SCALE_CHIP } from "@/constants/motion";

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function FilterChip({ label, selected, onPress }: FilterChipProps) {
  return (
    <PressableScale
      style={[styles.chip, selected && styles.chipSelected]}
      scaleTo={PRESS_SCALE_CHIP}
      onPress={onPress}
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

const styles = StyleSheet.create({
  // Ink-on-white pills: green stays reserved for the tab puck and prices.
  chip: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.surface.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginRight: 10,
  },
  chipSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  label: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.onSurface.variant,
  },
  labelSelected: {
    color: "#FFFFFF",
    fontFamily: fonts.semibold,
  },
});
