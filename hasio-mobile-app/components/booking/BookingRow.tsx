import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { PressableScale } from "@/components/ui/PressableScale";
import { BookingStatusChip } from "./BookingStatusChip";
import { getLocalizedText } from "@/hooks/useLanguage";
import { formatDateRange, formatISODate } from "@/lib/dates";
import { nightsLabel } from "@/lib/bookingDisplay";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import type { Language } from "@/types";

/**
 * The shape the row reads. Declared here rather than imported from the
 * generated API type so the row stays memoisable on a stable prop and the
 * screen can pass whatever getUserBookings returns.
 */
export interface BookingRowData {
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
  listing?: { name_en: string; name_ar: string; images?: string[] } | null;
}

interface BookingRowProps {
  booking: BookingRowData;
  language: Language;
  isRTL: boolean;
  /** Already-translated words the row needs; passed in so memo can compare them. */
  labels: {
    night: string;
    nights: string;
    guests: string;
    /** Formats a stored SAR amount in the viewer's display currency. */
    formatPrice: (amountSar: number) => string;
  };
  onPress: (id: string) => void;
}

function BookingRowInner({ booking, language, isRTL, labels, onPress }: BookingRowProps) {
  const styles = useThemedStyles(makeStyles);
  const listing = booking.listing;
  const image = listing?.images?.[0];
  const isStay = booking.kind === "stay" && !!booking.checkIn && !!booking.checkOut;
  const t = (key: "night" | "nights" | "guests") => labels[key];

  return (
    <PressableScale onPress={() => onPress(booking._id)} accessibilityRole="button">
      <View style={[styles.card, isRTL && styles.cardRTL]}>
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
          <Text style={[styles.name, isRTL && styles.textRTL]} numberOfLines={1}>
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

          <View style={[styles.cardFooter, isRTL && styles.cardRTL]}>
            <BookingStatusChip status={booking.status} />
            {booking.totalAmount != null && (
              <Text style={styles.amount}>
                {labels.formatPrice(booking.totalAmount)}
              </Text>
            )}
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

/**
 * Memoised on the booking object: Convex hands back a new array on every
 * change but reuses row objects whose content did not change, so a status
 * flip on one booking re-renders one row, not the list.
 */
export const BookingRow = memo(BookingRowInner);

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  // Content on the page, divided by a hairline — not a white card. The list
  // this sits in supplies the horizontal padding.
  card: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  cardRTL: {
    flexDirection: "row-reverse",
  },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: 14,
    backgroundColor: colors.sand,
  },
  cardBody: {
    flex: 1,
    justifyContent: "space-between",
  },
  name: {
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
  cardFooter: {
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
});
