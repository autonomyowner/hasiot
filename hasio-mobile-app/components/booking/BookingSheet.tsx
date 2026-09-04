import { appAlert } from "@/stores/dialogStore";
import { AppDialogHost } from "@/components/ui/AppDialog";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/backend";
import type { Id } from "../../../convex/_generated/dataModel";
import { BookingNotesField, type BookingNotesFieldHandle } from "./BookingNotesField";
import { QuoteFooter } from "./QuoteFooter";
import { quoteFooterState, type LastGoodQuote } from "@/lib/bookingDisplay";
import { GuestStepper } from "./GuestStepper";
import { useLanguage } from "@/hooks/useLanguage";
import { addDays, datesBetween, formatISODate, nightsBetween, todayRiyadhISO } from "@/lib/dates";
import { nightsLabel } from "@/lib/bookingDisplay";
import { haptic } from "@/lib/haptics";
import Animated from "react-native-reanimated";
import { enterFade, popIn } from "@/constants/motion";
import { applyCalendarLocale } from "@/lib/calendarLocale";
import { getBookingErrorKey } from "@/lib/bookingError";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { ScreenGradient, SurfaceGradient } from "@/components/ui/Gradients";
import type { DetailItem } from "@/components/listing/ListingDetailSheet";

// A year out. Past that a host's pricing is guesswork anyway.
const MAX_HORIZON_DAYS = 365;

// Module scope on purpose: an inline object here is a new reference every
// render, and react-native-calendars re-renders every day cell when it sees
// one. Read through useThemedStyles like the stylesheet below — it caches on
// (factory, language), so the reference is still stable per language, but the
// calendar picks up Cairo in Arabic instead of a Latin face with no glyphs.
const makeCalendarTheme = (fonts: AppFonts) =>
  ({
    // Transparent, not white: the calendar is content on the page like every
    // other block on it, not a panel floating on the cream.
    calendarBackground: "transparent",
    // Lime is a fill and cannot be read as text, so everything drawn AS the
    // brand colour here - today, the arrows - takes the dark tone instead.
    todayTextColor: colors.primary.deep,
    arrowColor: colors.primary.deep,
    monthTextColor: colors.ink,
    dayTextColor: colors.ink,
    textSectionTitleColor: colors.onSurface.muted,
    textDisabledColor: colors.onSurface.muted,
    textDayFontFamily: fonts.regular,
    textMonthFontFamily: fonts.serif,
    textDayHeaderFontFamily: fonts.medium,
    textMonthFontSize: 20,
  }) as const;

interface BookingSheetProps {
  visible: boolean;
  onClose: () => void;
  item: DetailItem | null;
}

/**
 * Request a stay: pick dates, pick guests, see the total, send.
 *
 * The total comes from the server (`quoteStay`) rather than being multiplied
 * here, so the number the guest agrees to is computed by the same function
 * that will charge it. The sheet never invents a price.
 */
export function BookingSheet({ visible, onClose, item }: BookingSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const calendarTheme = useThemedStyles(makeCalendarTheme);
  const { t, isRTL, language } = useLanguage();
  const router = useRouter();

  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [guests, setGuests] = useState(2);
  const notesRef = useRef<BookingNotesFieldHandle>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const createStayBooking = useMutation(api.bookings.mutations.createStayBooking);

  const today = todayRiyadhISO();

  // A side effect, so it runs once per language rather than on every render.
  useEffect(() => {
    applyCalendarLocale(language);
  }, [language]);

  // Only ask for a quote once both ends are chosen — a half-selected range is
  // a normal intermediate state, not something to bother the server about.
  const quote = useQuery(
    api.bookings.queries.quoteStay,
    item && checkIn && checkOut
      ? {
          listingId: item.id as Id<"listings">,
          checkIn,
          checkOut,
          guests,
        }
      : "skip"
  );

  // The last total the server gave us, kept so a refetch does not blank the
  // footer. Cleared when the range is cleared — a different range is a
  // different number, and showing the old one for it would be a lie.
  const [lastGood, setLastGood] = useState<LastGoodQuote | null>(null);
  useEffect(() => {
    if (quote?.ok && quote.available) setLastGood(quote.quote);
  }, [quote]);
  useEffect(() => {
    if (!checkIn || !checkOut) setLastGood(null);
  }, [checkIn, checkOut]);

  const footerState = quoteFooterState({ checkIn, checkOut, quote, lastGood });

  const markedDates = useMemo(() => {
    if (!checkIn) return {};

    if (!checkOut) {
      return {
        [checkIn]: {
          startingDay: true,
          endingDay: true,
          color: colors.primary.DEFAULT,
          textColor: colors.ink,
        },
      };
    }

    const marks: Record<string, object> = {};
    // datesBetween is the nights slept; the check-out day is drawn separately
    // as the closing cap because nobody sleeps there.
    for (const date of datesBetween(checkIn, checkOut)) {
      // Endpoints are the lime fill with ink on it; the nights between are the
      // soft lime surface with the dark lime tone. White on lime is 1.4:1 and
      // would erase the dates the guest just picked.
      marks[date] = {
        color: date === checkIn ? colors.primary.DEFAULT : colors.mint,
        textColor: date === checkIn ? colors.ink : colors.primary.deep,
        ...(date === checkIn ? { startingDay: true } : {}),
      };
    }
    marks[checkOut] = {
      endingDay: true,
      color: colors.primary.DEFAULT,
      textColor: colors.ink,
    };
    return marks;
  }, [checkIn, checkOut]);

  const handleDayPress = (day: { dateString: string }) => {
    haptic("light");
    const picked = day.dateString;

    // First tap sets arrival. Second tap sets departure if it is later;
    // anything else starts a new range, which is what someone tapping an
    // earlier date almost always means.
    if (!checkIn || checkOut || picked <= checkIn) {
      setCheckIn(picked);
      setCheckOut(null);
      return;
    }
    setCheckOut(picked);
  };

  const reset = () => {
    setCheckIn(null);
    setCheckOut(null);
    setLastGood(null);
    setGuests(2);
    notesRef.current?.reset();
    setSubmitting(false);
    setConfirmation(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!item || !checkIn || !checkOut || submitting) return;

    setSubmitting(true);
    try {
      const result = await createStayBooking({
        listingId: item.id as Id<"listings">,
        checkIn,
        checkOut,
        guests,
        notes: notesRef.current?.read(),
      });
      setConfirmation(result.confirmationCode);
      haptic("success");
    } catch (error) {
      appAlert(t("error"), t(getBookingErrorKey(error)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <ScreenGradient />
        <View style={[styles.header, isRTL && styles.headerRTL]}>
          <View style={styles.headerText}>
            <Text style={[styles.title, isRTL && styles.textRTL]} numberOfLines={1}>
              {confirmation ? t("bookingRequested") : t("bookStay")}
            </Text>
            {!confirmation && (
              <Text style={[styles.subtitle, isRTL && styles.textRTL]} numberOfLines={1}>
                {item?.title}
              </Text>
            )}
          </View>
          <Pressable
            onPress={handleClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel={t("close")}
            hitSlop={8}
          >
            <Feather name="x" size={22} color={colors.ink} />
          </Pressable>
        </View>

        {confirmation ? (
          <View style={styles.successBody}>
            <Animated.View entering={popIn} style={styles.successIcon}>
              <Feather name="check" size={28} color={colors.ink} />
            </Animated.View>
            <Animated.View entering={enterFade(1)} style={styles.successText}>
              <Text style={styles.successLabel}>{t("confirmationCode")}</Text>
              <Text style={styles.successCode} selectable>
                {confirmation}
              </Text>
              <Text style={[styles.pendingNote, styles.successNote]}>{t("bookingPendingNote")}</Text>
            </Animated.View>

            <Animated.View entering={enterFade(2)} style={styles.successActions}>
              <Pressable
                onPress={() => {
                  handleClose();
                  router.push("/bookings");
                }}
                style={styles.primaryButton}
                accessibilityRole="button"
                accessibilityLabel={t("viewMyBookings")}
              >
                <Text style={styles.primaryButtonText}>{t("viewMyBookings")}</Text>
              </Pressable>

              <Pressable onPress={handleClose} style={styles.secondaryButton} accessibilityRole="button">
                <Text style={styles.secondaryButtonText}>{t("done")}</Text>
              </Pressable>
            </Animated.View>
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.sectionLabel, isRTL && styles.textRTL]}>{t("selectDates")}</Text>
              <Text style={[styles.sectionHint, isRTL && styles.textRTL]}>
                {t("selectDatesHint")}
              </Text>

              {/* Remounted on a language change: the library reads its locale
                  once at mount, so a live switch would keep English months. */}
              <Calendar
                key={language}
                markingType="period"
                markedDates={markedDates}
                onDayPress={handleDayPress}
                minDate={today}
                maxDate={addDays(today, MAX_HORIZON_DAYS)}
                firstDay={0}
                theme={calendarTheme}
                style={styles.calendar}
                // The library names its arrows by position, not by meaning, and
                // does not flip them for RTL: in Arabic the previous-month
                // arrow sits on the right and has to point that way too.
                renderArrow={(direction: "left" | "right") => (
                  <Feather
                    name={(direction === "left") !== isRTL ? "chevron-left" : "chevron-right"}
                    size={20}
                    color={colors.primary.deep}
                  />
                )}
              />

              {checkIn && checkOut && (
                <View style={styles.rangeCard}>
                  <SurfaceGradient />
                  <View style={[styles.rangeRow, isRTL && styles.rangeRowRTL]}>
                    <View style={styles.rangeCell}>
                      <Text style={[styles.rangeLabel, isRTL && styles.textRTL]}>{t("checkIn")}</Text>
                      <Text style={[styles.rangeValue, isRTL && styles.textRTL]}>
                        {formatISODate(checkIn, language)}
                      </Text>
                    </View>
                    <View style={styles.nightsPill}>
                      <Text style={styles.nightsPillText}>
                        {nightsLabel(nightsBetween(checkIn, checkOut), t)}
                      </Text>
                    </View>
                    <View style={[styles.rangeCell, styles.rangeCellEnd, isRTL && styles.rangeCellEndRTL]}>
                      <Text style={[styles.rangeLabel, styles.textEnd, isRTL && styles.textRTL]}>
                        {t("checkOut")}
                      </Text>
                      <Text style={[styles.rangeValue, styles.textEnd, isRTL && styles.textRTL]}>
                        {formatISODate(checkOut, language)}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.rangeHint, isRTL && styles.textRTL]}>{t("tapDateAgainHint")}</Text>
                </View>
              )}

              <View style={styles.divider} />

              <GuestStepper
                value={guests}
                onChange={setGuests}
                max={item?.maxGuests ?? 4}
                label={t("guests")}
                unit={guests === 1 ? t("guest") : t("guests")}
                isRTL={isRTL}
              />

              <View style={styles.divider} />

              <BookingNotesField
                ref={notesRef}
                label={t("notesOptional")}
                placeholder={t("notesPlaceholder")}
                isRTL={isRTL}
              />
            </ScrollView>

            {/* Summary and the action stay pinned: the total is the thing the
                guest is agreeing to, and it should never be scrolled away. */}
            <QuoteFooter state={footerState} submitting={submitting} onSubmit={handleSubmit} />
          </>
        )}
      </View>

      {/* A native Modal needs its own dialog host, or an alert fired from in
          here renders behind the sheet. */}
      <AppDialogHost />
    </Modal>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  headerRTL: {
    flexDirection: "row-reverse",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.serif,
    color: colors.ink,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
    marginTop: 2,
  },
  textRTL: {
    textAlign: "right",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sectionLabel: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.ink,
    marginTop: 8,
  },
  sectionHint: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
    marginTop: 4,
    marginBottom: 8,
  },
  // No fill: the theme above draws the calendar straight onto the page.
  calendar: {
    backgroundColor: "transparent",
    paddingBottom: 8,
  },
  // The one raised surface on this screen, so it takes the card treatment -
  // radius, clip, and the lit-from-above wash instead of a white fill.
  rangeCard: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.surface.DEFAULT,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  rangeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rangeRowRTL: {
    flexDirection: "row-reverse",
  },
  rangeCell: {
    flex: 1,
  },
  rangeCellEnd: {
    alignItems: "flex-end",
  },
  rangeCellEndRTL: {
    alignItems: "flex-start",
  },
  textEnd: {
    textAlign: "right",
  },
  rangeLabel: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
  },
  rangeValue: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.ink,
    marginTop: 2,
  },
  rangeHint: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
  },
  nightsPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.mint,
  },
  nightsPillText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.primary.deep,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 20,
  },
  pendingNote: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
  },
  primaryButton: {
    minHeight: 50,
    height: 52,
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  secondaryButton: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.onSurface.variant,
  },
  successBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: "center",
  },
  // Lime circle, ink check. A white check on lime is 1.4:1 - an empty disc.
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successText: {
    alignItems: "center",
  },
  successActions: {
    alignSelf: "stretch",
  },
  successLabel: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
  },
  successCode: {
    fontSize: 36,
    fontFamily: fonts.serif,
    color: colors.ink,
    letterSpacing: 2,
    marginTop: 6,
  },
  successNote: {
    textAlign: "center",
    marginTop: 16,
    marginBottom: 28,
  },
});
