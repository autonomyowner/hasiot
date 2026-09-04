import React, { memo } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { BookingStatusChip } from "./BookingStatusChip";
import { getLocalizedText } from "@/hooks/useLanguage";
import { formatDateRange, formatISODate } from "@/lib/dates";
import { formatPhoneForDisplay } from "@/lib/phone";
import { hostActionsFor, nightsLabel } from "@/lib/bookingDisplay";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { SurfaceGradient } from "@/components/ui/Gradients";
import type { Language } from "@/types";

export interface HostBookingData {
  _id: string;
  status: string;
  kind?: string;
  date: string;
  time: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  guests?: number;
  totalAmount?: number | null;
  notes?: string;
  listing?: { name_en: string; name_ar: string; images?: string[] } | null;
  tourist?: { firstName?: string; lastName?: string; phone?: string } | null;
}

export type HostAction = "confirm" | "decline" | "noShow" | "complete";

interface HostBookingCardProps {
  booking: HostBookingData;
  today: string;
  language: Language;
  isRTL: boolean;
  /** Which action, if any, is running on this card right now. */
  busy: HostAction | null;
  labels: {
    night: string;
    nights: string;
    guests: string;
    guest: string;
    sar: string;
    callGuest: string;
    confirm: string;
    decline: string;
    noShow: string;
    complete: string;
  };
  onAction: (id: string, action: HostAction) => void;
}

function HostBookingCardInner({
  booking,
  today,
  language,
  isRTL,
  busy,
  labels,
  onAction,
}: HostBookingCardProps) {
  const styles = useThemedStyles(makeStyles);
  const listing = booking.listing;
  const guest = booking.tourist;
  const guestName =
    [guest?.firstName, guest?.lastName].filter(Boolean).join(" ").trim() || labels.guest;
  const isStay = booking.kind === "stay" && !!booking.checkIn && !!booking.checkOut;
  const actions = hostActionsFor(booking, today);
  const t = (key: "night" | "nights" | "guests") => labels[key];
  const anyBusy = busy !== null;

  return (
    <View style={styles.card}>
      {/* A genuinely raised surface, so it gets the lit-from-above wash rather
          than a flat white fill. The card clips it with its own radius. */}
      <SurfaceGradient />
      <View style={[styles.cardTop, isRTL && styles.rowRTL]}>
        {listing?.images?.[0] ? (
          <Image
            source={{ uri: listing.images[0] }}
            style={styles.thumb}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.thumb} />
        )}
        <View style={styles.cardBody}>
          <Text style={[styles.listingName, isRTL && styles.textRTL]} numberOfLines={1}>
            {listing ? getLocalizedText(listing.name_en, listing.name_ar, language) : "—"}
          </Text>
          <Text style={[styles.meta, isRTL && styles.textRTL]}>
            {isStay
              ? formatDateRange(booking.checkIn!, booking.checkOut!, language)
              : `${formatISODate(booking.date, language)} · ${booking.time}`}
          </Text>
          {isStay && booking.nights ? (
            <Text style={[styles.meta, isRTL && styles.textRTL]}>
              {nightsLabel(booking.nights, t, booking.guests)}
            </Text>
          ) : null}
          <View style={[styles.chipRow, isRTL && styles.rowRTL]}>
            <BookingStatusChip status={booking.status} />
            {booking.totalAmount != null ? (
              <Text style={styles.amount}>
                {`${labels.sar} ${booking.totalAmount.toLocaleString("en-US")}`}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* The guest's number, one tap from a call. A host reaching a late
          arrival is the main reason a verified phone is required to book. */}
      <View style={[styles.guestRow, isRTL && styles.rowRTL]}>
        <View>
          <Text style={[styles.guestName, isRTL && styles.textRTL]}>{guestName}</Text>
          {guest?.phone ? (
            <Text style={[styles.meta, isRTL && styles.textRTL]}>
              {formatPhoneForDisplay(guest.phone)}
            </Text>
          ) : null}
        </View>
        {guest?.phone ? (
          <Pressable
            onPress={() => Linking.openURL(`tel:${guest.phone}`)}
            style={styles.callButton}
            accessibilityRole="button"
            accessibilityLabel={labels.callGuest}
          >
            <Feather name="phone" size={16} color={colors.primary.deep} />
          </Pressable>
        ) : null}
      </View>

      {booking.notes ? (
        <Text style={[styles.notes, isRTL && styles.textRTL]}>{booking.notes}</Text>
      ) : null}

      {actions === "decide" ? (
        <View style={[styles.actions, isRTL && styles.rowRTL]}>
          <ActionButton
            label={labels.decline}
            tone="secondary"
            busy={busy === "decline"}
            disabled={anyBusy}
            onPress={() => onAction(booking._id, "decline")}
          />
          <ActionButton
            label={labels.confirm}
            tone="primary"
            busy={busy === "confirm"}
            disabled={anyBusy}
            onPress={() => onAction(booking._id, "confirm")}
          />
        </View>
      ) : null}

      {actions === "close" ? (
        <View style={[styles.actions, isRTL && styles.rowRTL]}>
          <ActionButton
            label={labels.noShow}
            tone="secondary"
            busy={busy === "noShow"}
            disabled={anyBusy}
            onPress={() => onAction(booking._id, "noShow")}
          />
          <ActionButton
            label={labels.complete}
            tone="primary"
            busy={busy === "complete"}
            disabled={anyBusy}
            onPress={() => onAction(booking._id, "complete")}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * The pressed button shows its own spinner and its sibling only dims. Two
 * buttons dimming together read as "the app froze"; one spinning reads as
 * "that one is working".
 */
function ActionButton({
  label,
  tone,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  tone: "primary" | "secondary";
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  // Same factory as the card above, so this shares its cached stylesheet.
  const styles = useThemedStyles(makeStyles);
  const primary = tone === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        disabled && !busy && styles.buttonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
    >
      {busy ? (
        <ActivityIndicator color={primary ? colors.ink : colors.signOut} />
      ) : (
        <Text style={primary ? styles.buttonPrimaryText : styles.buttonSecondaryText}>{label}</Text>
      )}
    </Pressable>
  );
}

export const HostBookingCard = memo(HostBookingCardInner);

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.surface.DEFAULT,
    padding: 16,
    gap: 12,
  },
  cardTop: {
    flexDirection: "row",
    gap: 12,
  },
  rowRTL: {
    flexDirection: "row-reverse",
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: colors.sand,
  },
  cardBody: {
    flex: 1,
  },
  listingName: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  meta: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
    marginTop: 2,
  },
  textRTL: {
    textAlign: "right",
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  amount: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  guestRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 12,
  },
  guestName: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  notes: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
    backgroundColor: colors.surface.variant,
    borderRadius: 14,
    padding: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    minHeight: 50,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  // Flat and solid. Lime is a fill, so the label on it is ink.
  buttonPrimary: {
    backgroundColor: colors.primary.DEFAULT,
  },
  // The refusing half stays quiet: a hairline and the destructive label, so
  // the affirmative action is the only filled thing in the row.
  buttonSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonPrimaryText: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  buttonSecondaryText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.signOut,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
