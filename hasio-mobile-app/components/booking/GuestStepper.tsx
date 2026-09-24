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
  /**
   * The count in words, already in the right form — "2 guests", "ضيفان".
   * It used to be the number plus a unit the caller picked between two
   * words, which cannot say the Arabic dual and came out as "2 الضيوف".
   */
  caption: string;
  decreaseLabel: string;
  increaseLabel: string;
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
  caption,
  decreaseLabel,
  increaseLabel,
  isRTL,
}: GuestStepperProps) {
  const styles = useThemedStyles(makeStyles);
  const canDecrease = value > min;
  const canIncrease = value < max;

  return (
    <View style={[styles.row, isRTL && styles.rowRTL]}>
      <View style={styles.text}>
        <Text style={[styles.label, isRTL && styles.textRTL]}>{label}</Text>
        <Text style={[styles.caption, isRTL && styles.textRTL]}>{caption}</Text>
      </View>

      {/* The controls keep their order in RTL: minus on the left, plus on the
          right, because they map to a number line, not to reading direction. */}
      <View style={styles.controls}>
        <Pressable
          onPress={() => canDecrease && onChange(value - 1)}
          disabled={!canDecrease}
          style={({ pressed }) => [
            styles.button,
            !canDecrease && styles.buttonDisabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={decreaseLabel}
          accessibilityState={{ disabled: !canDecrease }}
          // 36pt drawn, 52pt to the finger.
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
          style={({ pressed }) => [
            styles.button,
            !canIncrease && styles.buttonDisabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={increaseLabel}
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
    gap: 12,
  },
  rowRTL: {
    flexDirection: "row-reverse",
  },
  text: {
    flexShrink: 1,
  },
  textRTL: {
    textAlign: "right",
  },
  label: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  caption: {
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
  pressed: {
    opacity: 0.7,
  },
  value: {
    minWidth: 32,
    textAlign: "center",
    fontSize: 17,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
});
