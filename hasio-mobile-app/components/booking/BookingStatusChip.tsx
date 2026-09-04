import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLanguage } from "@/hooks/useLanguage";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import type { TranslationKey } from "@/constants/translations";

type Style = {
  bg: string;
  fg: string;
  label: TranslationKey;
  icon: keyof typeof Feather.glyphMap;
};

/**
 * The soft wash behind a "it ended without happening" chip: the destructive
 * token at a tenth of its weight, so the chip reads as a tint of the same red
 * its label is set in rather than as a second colour. Alpha over a token is
 * the one literal the palette allows, the same way the image scrims do it.
 */
const SOFT_RED = "rgba(176, 73, 63, 0.10)";

/**
 * Colour carries the same meaning here as in the admin panel: waiting, good,
 * done, refused — now drawn from the palette rather than a borrowed Tailwind
 * ramp. The three "it ended without happening" states share the one red tint
 * but each keeps its own icon, so a host reading a Past list can tell a
 * cancellation from a no-show at a glance: they mean very different things
 * for how that guest is treated next time.
 */
const STATUS_STYLES: Record<string, Style> = {
  pending: {
    bg: colors.chip,
    fg: colors.onSurface.variant,
    label: "bookingStatusPending",
    icon: "clock",
  },
  confirmed: {
    bg: colors.mint,
    fg: colors.primary.deep,
    label: "bookingStatusConfirmed",
    icon: "check",
  },
  completed: {
    bg: colors.sand,
    fg: colors.ink,
    label: "bookingStatusCompleted",
    icon: "check-circle",
  },
  cancelled: { bg: SOFT_RED, fg: colors.signOut, label: "bookingStatusCancelled", icon: "x" },
  declined: { bg: SOFT_RED, fg: colors.signOut, label: "bookingStatusDeclined", icon: "slash" },
  expired: { bg: SOFT_RED, fg: colors.signOut, label: "bookingStatusExpired", icon: "clock" },
  no_show: { bg: SOFT_RED, fg: colors.signOut, label: "bookingStatusNoShow", icon: "user-x" },
};

export function BookingStatusChip({ status }: { status: string }) {
  const styles = useThemedStyles(makeStyles);
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

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
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
