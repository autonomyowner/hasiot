import React, { memo } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { BookingStatusChip } from "./BookingStatusChip";
import { getLocalizedText } from "@/hooks/useLanguage";
import { formatDateRange, formatISODate } from "@/lib/dates";
import { formatPhoneForDisplay } from "@/lib/phone";
import { hostActionsFor, nightsLabel } from "@/lib/bookingDisplay";
import { fonts } from "@/constants/colors";
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
            <Feather name="phone" size={16} color="#0D7A5F" />
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
        <ActivityIndicator color={primary ? "#FFFFFF" : "#B91C1C"} />
      ) : (
        <Text style={primary ? styles.buttonPrimaryText : styles.buttonSecondaryText}>{label}</Text>
      )}
    </Pressable>
  );
}

export const HostBookingCard = memo(HostBookingCardInner);

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
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
    borderRadius: 12,
    backgroundColor: "#E8DFD4",
  },
  cardBody: {
    flex: 1,
  },
  listingName: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: "#1A1A1A",
  },
  meta: {
    fontSize: 13,
    color: "#737373",
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
    fontFamily: fonts.bold,
    color: "#1A1A1A",
    fontVariant: ["tabular-nums"],
  },
  guestRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F0EDE8",
    paddingTop: 12,
  },
  guestName: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: "#1A1A1A",
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEF7F4",
    alignItems: "center",
    justifyContent: "center",
  },
  notes: {
    fontSize: 14,
    lineHeight: 20,
    color: "#4B4B4B",
    backgroundColor: "#FAF7F2",
    borderRadius: 10,
    padding: 10,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: "#0D7A5F",
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  buttonPrimaryText: {
    fontSize: 15,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
  },
  buttonSecondaryText: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: "#B91C1C",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
