import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { PressableScale } from "@/components/ui/PressableScale";
import { BookingStatusChip } from "./BookingStatusChip";
import { getLocalizedText } from "@/hooks/useLanguage";
import { formatDateRange, formatISODate } from "@/lib/dates";
import { totalShownFor, type ServiceAmount, type StayTotal } from "@/lib/bookingDisplay";
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
  /** Frozen at booking time; the total is `nights × pricePerNight`. */
  pricePerNight?: number;
  totalAmount?: number | null;
  listing?: { name_en: string; name_ar: string; images?: string[] } | null;
  // A service booking (kind "service"): hours or days when the service is
  // priced by them, else 1; the price per unit frozen at booking time; and the
  // group. `service` is null once the provider has deleted the service.
  quantity?: number;
  unitPrice?: number;
  priceUnit?: string;
  partySize?: number;
  service?: { title_en: string; title_ar: string; images?: string[] } | null;
}

interface BookingRowProps {
  booking: BookingRowData;
  language: Language;
  isRTL: boolean;
  /** Already-bound formatters the row needs; passed in so memo can compare them. */
  labels: {
    /** "3 nights · 2 guests" — lib/bookingDisplay `nightsLabel`, bound to `t`. */
    stay: (nights: number, guests?: number) => string;
    /**
     * A booking's total in the viewer's currency, agreeing with the quote the
     * guest was shown (lib/bookingDisplay `displayTotalSar`).
     */
    formatTotal: (stay: StayTotal) => string;
    /** "10 Sep at 19:00" — lib/bookingDisplay `serviceWhen`, bound to the language. */
    serviceWhen: (date: string, time: string) => string;
    /** "3 hours · 4 people" — lib/bookingDisplay `serviceAmountLabel`, bound to `t`. */
    serviceAmount: (booking: ServiceAmount) => string;
    /** The title of a service that has been deleted since it was booked. */
    serviceGone: string;
  };
  onPress: (id: string) => void;
}

function BookingRowInner({ booking, language, isRTL, labels, onPress }: BookingRowProps) {
  const styles = useThemedStyles(makeStyles);
  const isService = booking.kind === "service";
  const listing = booking.listing;
  const service = booking.service;
  const image = isService ? service?.images?.[0] : listing?.images?.[0];
  const isStay = booking.kind === "stay" && !!booking.checkIn && !!booking.checkOut;

  // A service booking names its service, and says so when the provider has
  // deleted it since: the booking outlives it, and a dash told the guest
  // nothing about which of their bookings this was.
  const title = isService
    ? service
      ? getLocalizedText(service.title_en, service.title_ar, language)
      : labels.serviceGone
    : listing
      ? getLocalizedText(listing.name_en, listing.name_ar, language)
      : "—";

  const when = isService
    ? labels.serviceWhen(booking.date, booking.time)
    : isStay
      ? formatDateRange(booking.checkIn!, booking.checkOut!, language)
      : `${formatISODate(booking.date, language)} · ${booking.time}`;

  const amount = isService
    ? labels.serviceAmount(booking)
    : isStay && booking.nights
      ? labels.stay(booking.nights, booking.guests)
      : "";

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
            {title}
          </Text>

          <Text style={[styles.meta, isRTL && styles.textRTL]}>{when}</Text>

          {amount ? <Text style={[styles.meta, isRTL && styles.textRTL]}>{amount}</Text> : null}

          <View style={[styles.cardFooter, isRTL && styles.cardRTL]}>
            <BookingStatusChip status={booking.status} kind={booking.kind} />
            {booking.totalAmount != null && (
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
