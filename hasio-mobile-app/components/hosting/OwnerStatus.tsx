import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, type AppFonts } from "@/constants/colors";
import type { TranslationKey } from "@/constants/translations";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";

/**
 * Where a host's listing or service stands in review, on My Listings and My
 * Services.
 *
 * Both screens used to pick a label with `pending ? … : approved ? … :
 * "Rejected"`, so a seed listing a host was given — which has no status and is
 * live — and a suspended one were both badged "Rejected", and the reason an
 * admin wrote was never shown anywhere. The colours were white on a borrowed
 * amber and green, 3.2:1 and 3.8:1; these are the palette pairs the booking
 * status chip uses, each above 4.5:1.
 */

/** The destructive token at a tenth of its weight, as on the booking chip. */
const SOFT_RED = "rgba(176, 73, 63, 0.10)";

type BadgeStyle = {
  bg: string;
  fg: string;
  label: TranslationKey;
  icon: keyof typeof Feather.glyphMap;
};

const BADGES: Record<string, BadgeStyle> = {
  pending: { bg: colors.chip, fg: colors.onSurface.variant, label: "statusPending", icon: "clock" },
  approved: { bg: colors.mint, fg: colors.primary.deep, label: "statusApproved", icon: "check" },
  rejected: { bg: SOFT_RED, fg: colors.signOut, label: "statusRejected", icon: "x" },
  suspended: { bg: SOFT_RED, fg: colors.signOut, label: "statusSuspended", icon: "pause" },
};

/** `status` is already normalised — see `ownerStatusOf` in lib/listingForm. */
export function OwnerStatusBadge({ status }: { status: string }) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL } = useLanguage();
  const badge = BADGES[status] ?? BADGES.pending;

  return (
    <View
      style={[styles.badge, { backgroundColor: badge.bg }, isRTL && styles.rowRTL]}
      accessibilityLabel={t(badge.label)}
    >
      <Feather name={badge.icon} size={12} color={badge.fg} />
      <Text style={[styles.badgeText, { color: badge.fg }]}>{t(badge.label)}</Text>
    </View>
  );
}

/**
 * Why a rejected or suspended entry is not live, and what to do about it. The
 * server clears the note and sends the entry back to review on any edit, so
 * the hint only appears where there is an editor to go to.
 */
export function ReviewNote({
  status,
  reason,
  canEdit,
}: {
  status: string;
  reason?: string;
  canEdit: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL } = useLanguage();
  if (status !== "rejected" && status !== "suspended") return null;
  const note = reason?.trim();
  if (!note && !canEdit) return null;

  return (
    <View style={styles.note}>
      {note ? (
        <>
          <Text style={[styles.noteLabel, isRTL && styles.textRTL]}>{t("reviewNoteLabel")}</Text>
          <Text style={[styles.noteText, isRTL && styles.textRTL]}>{note}</Text>
        </>
      ) : null}
      {canEdit ? (
        <Text style={[styles.noteHint, isRTL && styles.textRTL]}>{t("editToResubmit")}</Text>
      ) : null}
    </View>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    rowRTL: {
      flexDirection: "row-reverse",
    },
    badgeText: {
      fontSize: 12,
      fontFamily: fonts.semibold,
    },
    note: {
      marginTop: 10,
      padding: 12,
      borderRadius: 12,
      backgroundColor: SOFT_RED,
      gap: 4,
    },
    noteLabel: {
      fontSize: 12,
      fontFamily: fonts.semibold,
      color: colors.signOut,
    },
    noteText: {
      fontSize: 13.5,
      fontFamily: fonts.regular,
      color: colors.ink,
      lineHeight: 19,
    },
    noteHint: {
      fontSize: 12.5,
      fontFamily: fonts.regular,
      color: colors.onSurface.variant,
      lineHeight: 18,
    },
    textRTL: {
      textAlign: "right",
    },
  });
