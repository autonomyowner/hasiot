import { appAlert } from "@/stores/dialogStore";
import { AppDialogHost } from "@/components/ui/AppDialog";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/backend";
import type { Id } from "../../../convex/_generated/dataModel";
import { BookingNotesField, type BookingNotesFieldHandle } from "./BookingNotesField";
import { QuoteFooter } from "./QuoteFooter";
import { quoteFooterState, type LastGoodQuote } from "@/lib/bookingDisplay";
import { GuestStepper } from "./GuestStepper";
import { useLanguage } from "@/hooks/useLanguage";
import { useKeyboardOverlap } from "@/hooks/useKeyboardOverlap";
import { addDays, datesBetween, formatISODate, nightsBetween, todayRiyadhISO } from "@/lib/dates";
import { countLabel, nightsLabel } from "@/lib/bookingDisplay";
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
// Where the guest count starts — never above what the place takes.
const DEFAULT_GUESTS = 2;
// The stepper's ceiling for a listing whose host set none.
const FALLBACK_MAX_GUESTS = 4;
// The header's own top padding, before any status bar is added to it.
const HEADER_TOP = 16;

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

/**
 * The calendar's month arrows, pointing the way they go in both languages.
 *
 * They used to be flipped in Arabic, on the belief that the library mirrors
 * its header there. It does only when `I18nManager.isRTL` is set, which this
 * app never sets (RTL is laid out by hand), so the previous-month arrow stays
 * on the left: flipped, both arrows pointed in at the month's name. The grid
 * under it is not mirrored either, so left-for-earlier is consistent.
 *
 * Module scope, so the calendar is handed the same function every render.
 */
function renderCalendarArrow(direction: "left" | "right") {
  return (
    <Feather
      name={direction === "left" ? "chevron-left" : "chevron-right"}
      size={20}
      color={colors.primary.deep}
    />
  );
}

/** A stay being picked: arrival first, then departure. */
type DateRange = { checkIn: string | null; checkOut: string | null };
const NO_RANGE: DateRange = { checkIn: null, checkOut: null };

interface BookingSheetProps {
  visible: boolean;
  onClose: () => void;
  item: DetailItem | null;
  /**
   * "View my bookings", pressed on the success screen. Called only once this
   * sheet has finished leaving — on iOS when its Modal reports the dismissal,
   * on Android straight away — so the caller can close whatever this sheet
   * sits in, and navigate, without racing that dismissal.
   */
  onViewBookings: () => void;
}

/**
 * Request a stay: pick dates, pick guests, see the total, send.
 *
 * The total comes from the server (`quoteStay`) rather than being multiplied
 * here, so the number the guest agrees to is computed by the same function
 * that will charge it. The sheet never invents a price.
 */
export function BookingSheet({ visible, onClose, item, onViewBookings }: BookingSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const calendarTheme = useThemedStyles(makeCalendarTheme);
  const { t, isRTL, language } = useLanguage();
  const insets = useSafeAreaInsets();

  const maxGuests = item?.maxGuests ?? FALLBACK_MAX_GUESTS;
  // Two, unless the place takes one: starting at 2 against a ceiling of 1
  // left the stepper above its own maximum, a count the server rejects.
  const startingGuests = Math.min(DEFAULT_GUESTS, maxGuests);

  // One state for both ends, so a tap can decide from the range as it is
  // (a functional update) and the handler never has to change.
  const [range, setRange] = useState<DateRange>(NO_RANGE);
  const { checkIn, checkOut } = range;
  const [guests, setGuests] = useState(startingGuests);
  const notesRef = useRef<BookingNotesFieldHandle>(null);
  // Whether the notes box holds anything. The draft itself stays in the box
  // (see BookingNotesField); this flips only when it empties or fills.
  const [notesWritten, setNotesWritten] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  // The last total the server gave us, kept so a refetch does not blank the
  // footer. Cleared when the range is cleared — a different range is a
  // different number, and showing the old one for it would be a lie.
  const [lastGood, setLastGood] = useState<LastGoodQuote | null>(null);
  // Counts openings. The content is keyed on it, so each opening starts from
  // this month on the calendar, an empty notes box and the top of the page.
  const [opening, setOpening] = useState(0);

  // Everything starts over when the sheet opens. It used to on close, which
  // flipped the success screen back to an empty form while the sheet was
  // still sliding away with it.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setRange(NO_RANGE);
      setGuests(startingGuests);
      setNotesWritten(false);
      setSubmitting(false);
      setConfirmation(null);
      setLastGood(null);
      setOpening((n) => n + 1);
    }
  }

  // What closing now would throw away. The guest count is left out on
  // purpose: it is one tap to put back, and asking about it would turn every
  // idle look at the calendar into a dialog.
  const dirty = !confirmation && (checkIn !== null || notesWritten);

  // Android: lifts the form — notes box and pinned footer both — above the
  // keyboard, which an edge-to-edge window no longer resizes for. On iOS the
  // hook does nothing; the ScrollView's own keyboard insets take over there.
  const {
    ref: formRef,
    overlap: keyboardOverlap,
    onLayout: formOnLayout,
    prepare: prepareKeyboard,
  } = useKeyboardOverlap();
  const scrollRef = useRef<ScrollView>(null);
  const notesFocused = useRef(false);

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

  // Stable for the life of the sheet. The calendar passes it to each of its
  // ~42 memoised day cells, which compare props by reference: a new function
  // every render — a guest added, a quote arriving — redrew every cell.
  const handleDayPress = useCallback((day: { dateString: string }) => {
    haptic("light");
    const picked = day.dateString;

    // First tap sets arrival. Second tap sets departure if it is later;
    // anything else starts a new range, which is what someone tapping an
    // earlier date almost always means.
    setRange((current) =>
      !current.checkIn || current.checkOut || picked <= current.checkIn
        ? { checkIn: picked, checkOut: null }
        : { checkIn: current.checkIn, checkOut: picked }
    );
  }, []);

  // Every way out comes through here: the close button, Android's back
  // button, and on iOS a swipe down. Nothing closes the sheet while the
  // request is being sent — the answer would arrive to a sheet that is gone.
  // With dates or a note entered, the guest is asked first (the swipe is
  // held by the sheet for as long as that is so; see `allowSwipeDismissal`).
  // "Discard" runs once the dialog has fully gone, so the sheet it closes is
  // no longer presenting anything.
  const requestClose = () => {
    if (submitting) return;
    if (!dirty) {
      onClose();
      return;
    }
    Keyboard.dismiss();
    appAlert(t("discardChangesTitle"), t("discardChangesMessage"), [
      { text: t("keepEditing"), style: "cancel" },
      { text: t("discardChanges"), style: "destructive", onPress: onClose },
    ]);
  };

  const handleNotesFocus = () => {
    notesFocused.current = true;
    // Android has no keyboard-will-show; move now, by what the keyboard took
    // last time, rather than jump once it has finished arriving.
    prepareKeyboard();
  };

  const handleNotesBlur = () => {
    notesFocused.current = false;
  };

  // Android: the form has just shrunk above the keyboard, and the notes box
  // is the last thing on the page — follow it up rather than leave it under
  // the pinned footer. iOS scrolls to the focused field by itself.
  const handleScrollLayout = () => {
    if (notesFocused.current) scrollRef.current?.scrollToEnd({ animated: true });
  };

  // "Send booking request" pressed before there is a stay to send. Every
  // reason the footer can give (no dates yet, none free, a quote that failed)
  // is answered on the calendar, which may be scrolled away under the notes
  // box with the keyboard up. So: keyboard down, calendar back in view.
  const showCalendar = () => {
    Keyboard.dismiss();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // What to do once the sheet is off the screen. This sheet is presented from
  // the listing sheet's view controller, and on iOS that controller cannot be
  // dismissed while it still has this sheet up — asked to, it takes this sheet
  // down instead and stays where it is. So "view my bookings" closes this
  // sheet first and hands over only when the Modal says it has gone.
  const afterDismiss = useRef<(() => void) | null>(null);

  const handleViewBookings = () => {
    if (Platform.OS === "ios") {
      afterDismiss.current = onViewBookings;
      onClose();
      return;
    }
    // Every Android Modal is its own window; there is nothing to wait for.
    onClose();
    onViewBookings();
  };

  // iOS only — Modal never calls onDismiss on Android.
  const handleDismiss = () => {
    const next = afterDismiss.current;
    afterDismiss.current = null;
    next?.();
  };

  const handleSubmit = async () => {
    if (!item || !checkIn || !checkOut || submitting) return;

    // The success screen replaces the form; it should not arrive under a
    // keyboard left up from the notes box.
    Keyboard.dismiss();
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
      // The native swipe down, but only while it loses nothing. RN 0.86 keeps
      // `modalInPresentation` on without this prop, so the sheet resisted
      // every swipe and closed a beat later through `onRequestClose` anyway —
      // with the dates and the note the guest had entered. Now a clean sheet
      // (or the success screen) goes under the finger, and one with something
      // in it holds, while iOS reports the attempt to `requestClose`, which
      // asks before discarding. While sending, it holds and nothing is asked.
      allowSwipeDismissal={!dirty && !submitting}
      onRequestClose={requestClose}
      onDismiss={handleDismiss}
    >
      <View key={opening} style={styles.container}>
        <ScreenGradient />
        <View
          style={[
            styles.header,
            // Android draws a Modal edge to edge, so the title sat under the
            // status bar. The iOS page sheet already starts below it.
            Platform.OS === "android" && { paddingTop: HEADER_TOP + insets.top },
            isRTL && styles.headerRTL,
          ]}
        >
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
            onPress={requestClose}
            disabled={submitting}
            style={({ pressed }) => [
              styles.closeButton,
              submitting && styles.closeButtonDisabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("close")}
            accessibilityState={{ disabled: submitting }}
            // 36pt drawn, 52pt to the finger.
            hitSlop={8}
          >
            <Feather name="x" size={22} color={colors.ink} />
          </Pressable>
        </View>

        {confirmation ? (
          <View style={[styles.successBody, { paddingBottom: insets.bottom + 24 }]}>
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
                onPress={handleViewBookings}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t("viewMyBookings")}
              >
                <Text style={styles.primaryButtonText}>{t("viewMyBookings")}</Text>
              </Pressable>

              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={t("done")}
              >
                <Text style={styles.secondaryButtonText}>{t("done")}</Text>
              </Pressable>
            </Animated.View>
          </View>
        ) : (
          <View
            ref={formRef}
            onLayout={formOnLayout}
            style={[styles.form, { paddingBottom: keyboardOverlap }]}
          >
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              // iOS: the native keyboard insets scroll the notes box — the last
              // thing on the page — clear of the keyboard, and dragging down
              // takes the keyboard with the finger. `interactive` does nothing
              // on Android, where a drag simply puts it away.
              automaticallyAdjustKeyboardInsets
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              onLayout={handleScrollLayout}
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
                renderArrow={renderCalendarArrow}
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
                max={maxGuests}
                label={t("guests")}
                caption={countLabel(guests, "guests", t)}
                decreaseLabel={t("decreaseGuests")}
                increaseLabel={t("increaseGuests")}
                isRTL={isRTL}
              />

              <View style={styles.divider} />

              <BookingNotesField
                ref={notesRef}
                label={t("notesOptional")}
                placeholder={t("notesPlaceholder")}
                isRTL={isRTL}
                onFocus={handleNotesFocus}
                onBlur={handleNotesBlur}
                onWrittenChange={setNotesWritten}
              />
            </ScrollView>

            {/* Summary and the action stay pinned: the total is the thing the
                guest is agreeing to, and it should never be scrolled away. */}
            <QuoteFooter
              state={footerState}
              submitting={submitting}
              onSubmit={handleSubmit}
              onNotReady={showCalendar}
              keyboardOpen={keyboardOverlap > 0}
            />
          </View>
        )}
      </View>

      {/* A native Modal needs its own dialog host, or an alert fired from in
          here renders behind the sheet. Only while the sheet is meant to be
          up: iOS keeps a Modal's content mounted until it reports the
          dismissal, and a host left registered on top by a dismissal that is
          slow to report — or never reports, after a swipe — would take every
          later alert into a sheet that is no longer on screen. */}
      {visible && <AppDialogHost />}
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
    paddingTop: HEADER_TOP,
    paddingBottom: 12,
    gap: 12,
  },
  // Everything under the header, so the keyboard padding lifts the scroll
  // and the pinned footer together.
  form: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
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
  closeButtonDisabled: {
    opacity: 0.45,
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
