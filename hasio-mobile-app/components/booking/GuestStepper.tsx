import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { fonts } from "@/constants/colors";

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
          <Feather name="minus" size={18} color={canDecrease ? "#0D7A5F" : "#C4C0BA"} />
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
          <Feather name="plus" size={18} color={canIncrease ? "#0D7A5F" : "#C4C0BA"} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: "#1A1A1A",
  },
  unit: {
    fontSize: 13,
    color: "#737373",
    marginTop: 2,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: "#F5F3F0",
    borderColor: "#EDEAE5",
  },
  value: {
    minWidth: 32,
    textAlign: "center",
    fontSize: 17,
    fontFamily: fonts.bold,
    color: "#1A1A1A",
  },
});
