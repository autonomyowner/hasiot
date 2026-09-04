import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

interface GuestStepperProps {
  value: number;
  onChange: (next: number) => void;
  max: number;
  min?: number;
  label: string;
  /** Rendered after the number, already pluralised by the caller. */
  unit: string;
  isRTL: boolean;
}

/**
 * A plus/minus counter rather than a text field.
 *
 * Guest counts are single digits with a hard ceiling, so a keyboard is more
 * work than it saves and invites input the server has to reject.
 */
export function GuestStepper({
  value,
  onChange,
  max,
  min = 1,
  label,
  unit,
  isRTL,
}: GuestStepperProps) {
  const styles = useThemedStyles(makeStyles);
  const canDecrease = value > min;
  const canIncrease = value < max;

  return (
    <View style={[styles.row, isRTL && styles.rowRTL]}>
      <View>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.unit}>
          {value} {unit}
        </Text>
      </View>

      {/* The controls keep their order in RTL: minus on the left, plus on the
          right, because they map to a number line, not to reading direction. */}
      <View style={styles.controls}>
        <Pressable
          onPress={() => canDecrease && onChange(value - 1)}
          disabled={!canDecrease}
          style={[styles.button, !canDecrease && styles.buttonDisabled]}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? "إنقاص عدد الضيوف" : "Decrease guests"}
          accessibilityState={{ disabled: !canDecrease }}
          hitSlop={8}
        >
          <Feather
            name="minus"
            size={18}
            color={canDecrease ? colors.primary.deep : colors.onSurface.muted}
          />
        </Pressable>

        <Text style={styles.value} accessibilityLiveRegion="polite">
          {value}
        </Text>

        <Pressable
          onPress={() => canIncrease && onChange(value + 1)}
          disabled={!canIncrease}
          style={[styles.button, !canIncrease && styles.buttonDisabled]}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? "زيادة عدد الضيوف" : "Increase guests"}
          accessibilityState={{ disabled: !canIncrease }}
          hitSlop={8}
        >
          <Feather
            name="plus"
            size={18}
            color={canIncrease ? colors.primary.deep : colors.onSurface.muted}
          />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowRTL: {
    flexDirection: "row-reverse",
  },
  label: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  unit: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
    marginTop: 2,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  // Flat and solid, like every other control in the app — the soft lime chip
  // surface, never a white box outlined on the cream page.
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: colors.chip,
  },
  value: {
    minWidth: 32,
    textAlign: "center",
    fontSize: 17,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
});
