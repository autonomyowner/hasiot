import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLanguage } from "@/hooks/useLanguage";
import { fonts } from "@/constants/colors";
import type { TranslationKey } from "@/constants/translations";

type Style = {
  bg: string;
  fg: string;
  label: TranslationKey;
  icon: keyof typeof Feather.glyphMap;
};

/**
 * Colour carries the same meaning here as in the admin panel: amber is
 * waiting, green is good, blue is done, red is refused. The three "it ended
 * without happening" states each get their own icon so a host reading a
 * Past list can tell a cancellation from a no-show at a glance — they mean
 * very different things for how that guest is treated next time.
 */
const STATUS_STYLES: Record<string, Style> = {
  pending: { bg: "#FEF3C7", fg: "#92400E", label: "bookingStatusPending", icon: "clock" },
  confirmed: { bg: "#D1FAE5", fg: "#065F46", label: "bookingStatusConfirmed", icon: "check" },
  completed: { bg: "#DBEAFE", fg: "#1E40AF", label: "bookingStatusCompleted", icon: "check-circle" },
  cancelled: { bg: "#F3F4F6", fg: "#4B5563", label: "bookingStatusCancelled", icon: "x" },
  declined: { bg: "#FEE2E2", fg: "#991B1B", label: "bookingStatusDeclined", icon: "slash" },
  expired: { bg: "#F3F4F6", fg: "#6B7280", label: "bookingStatusExpired", icon: "clock" },
  no_show: { bg: "#FDE8D3", fg: "#9A3412", label: "bookingStatusNoShow", icon: "user-x" },
};

export function BookingStatusChip({ status }: { status: string }) {
  const { t, isRTL } = useLanguage();
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;

  return (
    <View
      style={[styles.chip, { backgroundColor: style.bg }, isRTL && styles.chipRTL]}
      accessibilityLabel={t(style.label)}
    >
      <Feather name={style.icon} size={12} color={style.fg} />
      <Text style={[styles.text, { color: style.fg }]}>{t(style.label)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipRTL: {
    flexDirection: "row-reverse",
    alignSelf: "flex-end",
  },
  text: {
    fontSize: 12,
    fontFamily: fonts.semibold,
  },
});
