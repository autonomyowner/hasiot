import React, { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { BookingStatusChip } from "./BookingStatusChip";
import { getLocalizedText } from "@/hooks/useLanguage";
import { formatDateRange, formatISODate } from "@/lib/dates";
import { formatPhoneForDisplay, ltr } from "@/lib/phone";
import {
  hostActionsFor,
  providerActionsFor,
  shownStatus,
  totalShownFor,
  type ServiceAmount,
  type StayTotal,
} from "@/lib/bookingDisplay";
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
  /** Frozen at booking time; the total is `nights × pricePerNight`. */
  pricePerNight?: number;
  totalAmount?: number | null;
  notes?: string;
  listing?: { name_en: string; name_ar: string; images?: string[] } | null;
  tourist?: { firstName?: string; lastName?: string; phone?: string } | null;
  // A service booking (kind "service", the provider inbox): hours or days
  // when the service is priced by them, else 1; the price per unit frozen at
  // booking time; the group; and when an unanswered request closes. `service`
  // is null once the service has been deleted.
  quantity?: number;
  unitPrice?: number;
  priceUnit?: string;
  partySize?: number;
  expiresAt?: number;
  service?: { title_en: string; title_ar: string; images?: string[] } | null;
}

export type HostAction = "confirm" | "decline" | "noShow" | "complete";

/** What a card needs to show a service booking. The host inbox has none. */
export interface ServiceCardLabels {
  /** "10 Sep at 19:00" — lib/bookingDisplay `serviceWhen`, bound to the language. */
  when: (date: string, time: string) => string;
  /** "3 hours · 4 people" — lib/bookingDisplay `serviceAmountLabel`, bound to `t`. */
  amount: (booking: ServiceAmount) => string;
  /** The title of a service deleted since it was booked. */
  gone: string;
}

interface HostBookingCardProps {
  booking: HostBookingData;
  /**
   * The clock (hooks/useMinuteClock). It decides the buttons — a service's
   * no-show and completed come with its start time, a stay's with its arrival
   * day, and a request past its expiry offers none — and the chip, which calls
   * that request expired (lib/bookingDisplay `shownStatus`).
   */
  now: number;
  language: Language;
  isRTL: boolean;
  /** Which action, if any, is running on this card right now. */
  busy: HostAction | null;
  labels: {
    /** "3 nights · 2 guests" — lib/bookingDisplay `nightsLabel`, bound to `t`. */
    stay: (nights: number, guests?: number) => string;
    /** Stands in for a guest with no name on their account. */
    guest: string;
    /**
     * A booking's total in the viewer's currency, agreeing with the quote the
     * guest was shown (lib/bookingDisplay `displayTotalSar`).
     */
    formatTotal: (stay: StayTotal) => string;
    callGuest: string;
    confirm: string;
    decline: string;
    noShow: string;
    complete: string;
    service?: ServiceCardLabels;
  };
  onAction: (id: string, action: HostAction) => void;
  /**
   * Call the guest. The screen places the call so it can say so when the
   * phone cannot; from here a failed `openURL` was an unhandled rejection.
   */
  onCall: (phone: string) => void;
}

/**
 * One booking in an owner's inbox: a stay in the host's, a service booking in
 * the provider's. The two differ only in the lines under the title — dates
 * and nights for a stay, the day at its start time and the hours and group
 * for a service — and in when the closing buttons appear.
 */
function HostBookingCardInner({
  booking,
  now,
  language,
  isRTL,
  busy,
  labels,
  onAction,
  onCall,
}: HostBookingCardProps) {
  const styles = useThemedStyles(makeStyles);
  const isService = booking.kind === "service";
  const listing = booking.listing;
  const service = booking.service;
  const guest = booking.tourist;
  const guestName =
    [guest?.firstName, guest?.lastName].filter(Boolean).join(" ").trim() || labels.guest;
  const phone = guest?.phone;
  const isStay = booking.kind === "stay" && !!booking.checkIn && !!booking.checkOut;
  const actions = isService ? providerActionsFor(booking, now) : hostActionsFor(booking, now);
  const anyBusy = busy !== null;

  const image = isService ? service?.images?.[0] : listing?.images?.[0];
  // A deleted service is named as such, not as a dash: the provider still has
  // to tell this booking from their others.
  const title = isService
    ? service
      ? getLocalizedText(service.title_en, service.title_ar, language)
      : (labels.service?.gone ?? "—")
    : listing
      ? getLocalizedText(listing.name_en, listing.name_ar, language)
      : "—";
  const when =
    isService && labels.service
      ? labels.service.when(booking.date, booking.time)
      : isStay
        ? formatDateRange(booking.checkIn!, booking.checkOut!, language)
        : `${formatISODate(booking.date, language)} · ${booking.time}`;
  const amount = isService
    ? (labels.service?.amount(booking) ?? "")
    : isStay && booking.nights
      ? labels.stay(booking.nights, booking.guests)
      : "";

  return (
    <View style={styles.card}>
      {/* A genuinely raised surface, so it gets the lit-from-above wash rather
          than a flat white fill. The card clips it with its own radius. */}
      <SurfaceGradient />
      <View style={[styles.cardTop, isRTL && styles.rowRTL]}>
        {image ? (
          <Image
            source={{ uri: image }}
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
            {title}
          </Text>
          <Text style={[styles.meta, isRTL && styles.textRTL]}>{when}</Text>
          {amount ? <Text style={[styles.meta, isRTL && styles.textRTL]}>{amount}</Text> : null}
          <View style={[styles.chipRow, isRTL && styles.rowRTL]}>
            <BookingStatusChip status={shownStatus(booking, now)} kind={booking.kind} />
            {booking.totalAmount != null ? (
              <Text style={styles.amount}>
                {labels.formatTotal(
                  totalShownFor({
                    kind: booking.kind,
                    totalAmount: booking.totalAmount,
                    nights: booking.nights,
                    pricePerNight: booking.pricePerNight,
                    quantity: booking.quantity,
                    unitPrice: booking.unitPrice,
                  })
                )}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* The guest's number, one tap from a call. A host reaching a late
          arrival is the main reason a verified phone is required to book. */}
      <View style={[styles.guestRow, isRTL && styles.rowRTL]}>
        <View style={styles.guestText}>
          <Text style={[styles.guestName, isRTL && styles.textRTL]} numberOfLines={1}>
            {guestName}
          </Text>
          {phone ? (
            <Text style={[styles.meta, isRTL && styles.textRTL]}>
              {/* Kept in one piece: in an Arabic line the digit groups
                  otherwise come out in reverse order. */}
              {ltr(formatPhoneForDisplay(phone))}
            </Text>
          ) : null}
        </View>
        {phone ? (
          <Pressable
            onPress={() => onCall(phone)}
            style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}
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
          <HostActionButton
            label={labels.decline}
            tone="secondary"
            busy={busy === "decline"}
            disabled={anyBusy}
            onPress={() => onAction(booking._id, "decline")}
          />
          <HostActionButton
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
          <HostActionButton
            label={labels.noShow}
            tone="secondary"
            busy={busy === "noShow"}
            disabled={anyBusy}
            onPress={() => onAction(booking._id, "noShow")}
          />
          <HostActionButton
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
 * "that one is working". Exported for the booking detail, which offers a
 * provider the same pair.
 */
export function HostActionButton({
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
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        disabled && !busy && styles.buttonDisabled,
        pressed && styles.pressed,
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
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 12,
  },
  guestName: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  guestText: {
    flex: 1,
  },
  // 44pt, the smallest target a thumb is sure of; it was 40.
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
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
