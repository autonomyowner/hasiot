import { appAlert } from "@/stores/dialogStore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import Animated from "react-native-reanimated";
import { Calendar } from "react-native-calendars";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/backend";
import type { Id } from "../../../convex/_generated/dataModel";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  BookingNotesField,
  type BookingNotesFieldHandle,
} from "@/components/booking/BookingNotesField";
import { GuestStepper } from "@/components/booking/GuestStepper";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useCurrency } from "@/hooks/useCurrency";
import { useLanguage } from "@/hooks/useLanguage";
import { useNudge } from "@/hooks/useNudge";
import type { ServiceItem } from "@/hooks/useConvexData";
import { applyCalendarLocale } from "@/lib/calendarLocale";
import { addDays } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { maybeAskForPush } from "@/lib/pushPrompt";
import { getServiceBookingErrorKey } from "@/lib/serviceBookingError";
import {
  DEFAULT_MAX_GROUP,
  firstBookableDate,
  formatServiceAmount,
  peopleLabel,
  pickLanguage,
  quantityLabel,
  quantityRange,
  quoteBreakdown,
  riyadhClock,
  serviceFooterState,
  serviceTotalSar,
  startTimes,
  type QuoteAmounts,
} from "@/lib/serviceDisplay";

// A year out, as for stays.
const MAX_HORIZON_DAYS = 365;
// The sheet body's own side padding (components/ui/BottomSheet.tsx); the time
// chips are sized to what it leaves.
const BODY_PADDING = 24;
const TIME_GAP = 8;
// How often the clock moves on while the sheet is open, so a start time that
// has come within the hour drops off today's chips.
const CLOCK_TICK_MS = 30_000;

// Read through a function rather than inline, so the render-time reset below
// and the state initialiser can take the time without a bare `Date.now()` in
// the component body.
const readClock = () => Date.now();

// Module scope, and through useThemedStyles, for the reasons the stay
// calendar gives (components/booking/BookingSheet.tsx): a stable reference, so
// the calendar does not redraw every day cell on each render, in Cairo when
// the app is in Arabic.
const makeCalendarTheme = (fonts: AppFonts) =>
  ({
    calendarBackground: "transparent",
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

/** The month arrows, unflipped in Arabic — see BookingSheet for why. */
function renderCalendarArrow(direction: "left" | "right") {
  return (
    <Feather
      name={direction === "left" ? "chevron-left" : "chevron-right"}
      size={20}
      color={colors.primary.deep}
    />
  );
}

interface ServiceBookingSheetProps {
  visible: boolean;
  service: ServiceItem | null;
  /** For "We'll tell you as soon as {provider} replies." Empty when not known. */
  providerName: string;
  onClose: () => void;
  /**
   * "View my bookings", on the alert that confirms the request. Called once
   * this sheet has left the screen and the alert has too, so the caller can
   * close the sheet this one sits in, and navigate, without racing either.
   */
  onViewBookings: () => void;
}

/**
 * Request a service: a day, a start time, hours or days when the price is
 * per hour or per day, and how many people. The provider confirms or declines
 * within 48 hours; nothing is paid in the app (design D4).
 *
 * The total is the server's (`quoteService`), asked for live as the choices
 * change: the number the traveller agrees to is computed by the same function
 * that records it (bookings design D5). The sheet never multiplies a price.
 *
 * Every day and time is Riyadh's wall clock. The calendar starts at the first
 * day with a start time left in Riyadh, and today's chips start an hour from
 * now there — so a traveller whose phone is set to Sydney or Algiers can only
 * pick what the server will accept.
 */
export function ServiceBookingSheet({
  visible,
  service,
  providerName,
  onClose,
  onViewBookings,
}: ServiceBookingSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const calendarTheme = useThemedStyles(makeCalendarTheme);
  const { t, isRTL, language } = useLanguage();
  const { currency } = useCurrency();
  const { width } = useWindowDimensions();
  const { style: nudgeStyle, nudge } = useNudge();

  // Hours or days, when the price is per hour or per day; nothing to choose
  // for a price per booking, which the server charges once.
  const range = quantityRange(service?.priceUnit);
  const maxPeople = Math.max(1, service?.maxGroupSize ?? DEFAULT_MAX_GROUP);

  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [people, setPeople] = useState(1);
  // Whether the note holds anything; the draft itself stays in the field.
  const [notesWritten, setNotesWritten] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // The last total the server gave, kept on screen while a new one is asked.
  const [lastGood, setLastGood] = useState<QuoteAmounts | null>(null);
  // Counts openings; the form is keyed on it, so each opening starts on this
  // month, an empty note and the top of the page.
  const [opening, setOpening] = useState(0);
  const [now, setNow] = useState(readClock);

  // Everything starts over when the sheet opens — not when it closes, which
  // would empty the form while it is still sliding away.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setDate(null);
      setTime(null);
      setQuantity(1);
      setPeople(1);
      setNotesWritten(false);
      setSubmitting(false);
      setLastGood(null);
      setOpening((n) => n + 1);
      setNow(readClock());
    }
  }

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => setNow(readClock()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [visible]);

  // A side effect, so once per language rather than on every render.
  useEffect(() => {
    applyCalendarLocale(language);
  }, [language]);

  const today = riyadhClock(now).date;
  const minDate = firstBookableDate(now);
  const times = useMemo(() => (date ? startTimes(date, now) : []), [date, now]);
  // A start that has come within the hour while the sheet sat open is let go
  // rather than quoted into a refusal.
  const chosenTime = time !== null && times.includes(time) ? time : null;
  // Clamped, in case the provider lowered either limit while this was open.
  const partySize = Math.min(people, maxPeople);
  const units = range ? Math.min(quantity, range.max) : 1;

  const quoteArgs =
    service && date && chosenTime
      ? {
          serviceId: service.id as Id<"services">,
          date,
          time: chosenTime,
          partySize,
          // Only a unit priced by the hour or day takes a quantity; any other
          // is charged once, whatever is sent.
          ...(range ? { quantity: units } : {}),
        }
      : null;
  const quote = useQuery(api.bookings.queries.quoteService, quoteArgs ?? "skip");

  // Kept during render rather than in an effect: the new total, once it
  // lands, replaces the stale one on the same frame, and a choice left
  // incomplete lets it go.
  const fresh = quote?.ok ? quote.quote : null;
  if (fresh && fresh !== lastGood) setLastGood(fresh);
  if (!quoteArgs && lastGood) setLastGood(null);

  const footer = serviceFooterState({ date, time: chosenTime, quote, lastGood });

  // What closing now would throw away. The steppers are left out on purpose:
  // one tap puts them back, and asking about them would turn every idle look
  // at the sheet into a dialog.
  const dirty = date !== null || notesWritten;

  const createServiceBooking = useMutation(api.bookings.mutations.createServiceBooking);

  const scrollRef = useRef<ScrollView>(null);
  const notesRef = useRef<BookingNotesFieldHandle>(null);
  const notesFocused = useRef(false);
  // Where the start times begin in the scroll, for "Pick a start time".
  const timesY = useRef(0);
  // Two taps can land in one frame; `submitting` only draws the spinner.
  const sending = useRef(false);
  // Set when the request went through; the confirmation waits for the sheet
  // to be gone (see handleDismissed).
  const succeeded = useRef(false);

  const handleDayPress = useCallback((day: { dateString: string }) => {
    haptic("light");
    setDate(day.dateString);
  }, []);

  const pickTime = useCallback((slot: string) => {
    haptic("light");
    setTime(slot);
  }, []);

  const markedDates = useMemo(
    () =>
      date
        ? {
            // The lime fill with ink on it: white on lime is 1.4:1.
            [date]: {
              selected: true,
              selectedColor: colors.primary.DEFAULT,
              selectedTextColor: colors.ink,
            },
          }
        : {},
    [date]
  );

  // Every way out comes through here: the X, the backdrop, Android's back
  // button and the handle dragged down. Nothing closes while the request is
  // being sent. With a day or a note chosen, the traveller is asked first;
  // "Discard" runs once the dialog has fully gone.
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

  const handleSubmit = async () => {
    if (sending.current || !service || !date || !chosenTime) return;
    sending.current = true;
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      await createServiceBooking({
        serviceId: service.id as Id<"services">,
        date,
        time: chosenTime,
        partySize,
        notes: notesRef.current?.read(),
        ...(range ? { quantity: units } : {}),
      });
      haptic("success");
      succeeded.current = true;
      setSubmitting(false);
      // Closed straight away, not through requestClose: the choices are no
      // longer anything to lose.
      onClose();
    } catch (error) {
      setSubmitting(false);
      appAlert(t("error"), t(getServiceBookingErrorKey(error)));
    } finally {
      sending.current = false;
    }
  };

  // The sheet has left the screen. Only now is the confirmation raised: this
  // sheet sits inside the service sheet's Modal, and on iOS an alert raised
  // while this one was still being dismissed would never have been shown.
  // It draws in the service sheet's own dialog host, which is on top by then.
  const handleDismissed = () => {
    if (!succeeded.current) return;
    succeeded.current = false;
    const provider = providerName || t("serviceProviderFallback");
    appAlert(t("bookingRequested"), t("serviceRequestSentBody").replace("{provider}", provider), [
      // Asking about notifications happens on the way out of the alert (it
      // runs once the dialog has fully left), and for "View my bookings" once
      // the service sheet has gone too — see the caller.
      { text: t("viewMyBookings"), onPress: onViewBookings },
      { text: t("authOk"), style: "cancel", onPress: () => maybeAskForPush("guest") },
    ]);
  };

  const errorText =
    footer.kind === "error" ? t(getServiceBookingErrorKey(new Error(footer.message))) : null;
  // What stands between the traveller and sending, in the words the footer
  // shows — and what the button points at when pressed too early.
  const blocker =
    footer.kind === "idle"
      ? t(footer.missing === "day" ? "pickDayFirst" : "pickStartTime")
      : errorText;
  const canSend = footer.kind === "total" && !footer.stale && !submitting;
  // A total on its way: a moment off, and nothing to point at meanwhile.
  const waiting = footer.kind === "loading" || (footer.kind === "total" && footer.stale);

  // The button is never faded out to wait for a choice (a faded lime read as
  // text on an Android screen — see hooks/useNudge.ts). Pressed too early, it
  // shakes what is missing, says it, and brings that part of the form back.
  const handleSendPress = () => {
    if (canSend) {
      void handleSubmit();
      return;
    }
    if (submitting || waiting) return;
    Keyboard.dismiss();
    nudge(blocker ?? undefined);
    const y = footer.kind === "idle" && footer.missing === "day" ? 0 : timesY.current;
    scrollRef.current?.scrollTo({ y, animated: true });
  };

  const handleTimesLayout = (event: LayoutChangeEvent) => {
    timesY.current = event.nativeEvent.layout.y;
  };

  const handleNotesFocus = () => {
    notesFocused.current = true;
  };

  const handleNotesBlur = () => {
    notesFocused.current = false;
  };

  // The note is the last thing on the page. When the keyboard shrinks the
  // sheet (padding on iOS, the measured overlap on Android), follow the note
  // up rather than leave it under the pinned footer.
  const handleScrollLayout = () => {
    if (notesFocused.current) scrollRef.current?.scrollToEnd({ animated: true });
  };

  // Five to a row, four on the narrowest phones, sized to the body's width.
  const columns = width < 360 ? 4 : 5;
  const chipWidth = Math.floor((width - BODY_PADDING * 2 - TIME_GAP * (columns - 1)) / columns);
  const alignText = isRTL && styles.textRTL;

  return (
    <BottomSheet
      visible={visible}
      onClose={requestClose}
      onDismissed={handleDismissed}
      maxHeightRatio={0.94}
      header={
        <View style={[styles.head, isRTL && styles.rowRTL]}>
          <View style={styles.headText}>
            <Text style={[styles.title, alignText]} numberOfLines={1}>
              {t("bookService")}
            </Text>
            {service ? (
              <Text style={[styles.subtitle, alignText]} numberOfLines={1}>
                {pickLanguage(service.title, service.titleAr, language)}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={requestClose}
            disabled={submitting}
            style={({ pressed }) => [
              styles.close,
              submitting && styles.closeBusy,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("close")}
            accessibilityState={{ disabled: submitting }}
          >
            <Feather name="x" size={22} color={colors.ink} />
          </Pressable>
        </View>
      }
    >
      <View key={opening} style={styles.form}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
          onLayout={handleScrollLayout}
        >
          <Text style={[styles.sectionLabel, alignText]}>{t("chooseDay")}</Text>
          {/* Remounted on a language change: the library reads its locale
              once, at mount. */}
          <Calendar
            key={language}
            markedDates={markedDates}
            onDayPress={handleDayPress}
            minDate={minDate}
            maxDate={addDays(today, MAX_HORIZON_DAYS)}
            firstDay={0}
            theme={calendarTheme}
            style={styles.calendar}
            renderArrow={renderCalendarArrow}
          />

          <View style={styles.divider} />

          <View onLayout={handleTimesLayout}>
            <Text style={[styles.sectionLabel, alignText]}>{t("startTime")}</Text>
            <Text style={[styles.sectionHint, alignText]}>{t("startTimeHint")}</Text>
            {/* Not "Pick a day first" — the footer already says that, and the
                same words twice on one screen read as a mistake. */}
            {!date ? (
              <Text style={[styles.muted, alignText]}>{t("startTimesAfterDay")}</Text>
            ) : times.length === 0 ? (
              <Text style={[styles.muted, alignText]}>{t("noTimesLeftToday")}</Text>
            ) : (
              // Earliest first from where reading starts: the grid runs from
              // the right in Arabic, row after row.
              <View style={[styles.timeGrid, isRTL && styles.timeGridRTL]}>
                {times.map((slot) => (
                  <TimeChip
                    key={slot}
                    time={slot}
                    selected={slot === chosenTime}
                    width={chipWidth}
                    onPick={pickTime}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {range ? (
            <>
              <GuestStepper
                value={units}
                onChange={setQuantity}
                min={range.min}
                max={range.max}
                label={t(range.unit === "hours" ? "serviceHours" : "serviceDays")}
                caption={quantityLabel(units, range.unit, language)}
                decreaseLabel={t(range.unit === "hours" ? "fewerHours" : "fewerDays")}
                increaseLabel={t(range.unit === "hours" ? "moreHours" : "moreDays")}
                isRTL={isRTL}
              />
              <View style={styles.divider} />
            </>
          ) : null}

          {/* Recorded for the provider; it does not change the total. */}
          <GuestStepper
            value={partySize}
            onChange={setPeople}
            max={maxPeople}
            label={t("servicePeople")}
            caption={peopleLabel(partySize, language)}
            decreaseLabel={t("fewerPeople")}
            increaseLabel={t("morePeople")}
            isRTL={isRTL}
          />

          <View style={styles.divider} />

          <BookingNotesField
            ref={notesRef}
            label={t("serviceNotesLabel")}
            placeholder={t("serviceNotesPlaceholder")}
            isRTL={isRTL}
            onFocus={handleNotesFocus}
            onBlur={handleNotesBlur}
            onWrittenChange={setNotesWritten}
          />
        </ScrollView>

        {/* The total and the action stay pinned: the total is what the
            traveller agrees to, and it should never scroll away. One slot of
            fixed height for whatever the quote is doing, so the button under
            it never moves. */}
        <View style={styles.footer}>
          <Animated.View style={[styles.slot, nudgeStyle]} accessibilityLiveRegion="polite">
            {footer.kind === "idle" && <Text style={[styles.hint, alignText]}>{blocker}</Text>}

            {footer.kind === "loading" && (
              <View style={[styles.totalRow, isRTL && styles.rowRTL]}>
                <Text style={styles.hint}>{t("calculatingTotal")}</Text>
                <Skeleton radius={6} style={styles.totalSkeleton} />
              </View>
            )}

            {footer.kind === "error" && (
              <Text style={[styles.errorText, alignText]} numberOfLines={2}>
                {errorText}
              </Text>
            )}

            {footer.kind === "total" && (
              <View style={[styles.totalRow, isRTL && styles.rowRTL, footer.stale && styles.stale]}>
                <View style={[styles.totalLabels, isRTL && styles.alignEnd]}>
                  <Text style={styles.totalLabel}>{t("total")}</Text>
                  <Text style={styles.breakdown} numberOfLines={1}>
                    {footer.stale
                      ? t("updatingTotal")
                      : quoteBreakdown(footer, language, currency)}
                  </Text>
                </View>
                {/* In dollars, the total agrees with the rate shown beside it
                    — see serviceTotalSar. */}
                <Text style={styles.totalAmount}>
                  {formatServiceAmount(serviceTotalSar(footer, currency), language, currency)}
                </Text>
              </View>
            )}
          </Animated.View>

          <Text style={[styles.payNote, alignText]}>{t("servicePayDirectNote")}</Text>

          <Pressable
            onPress={handleSendPress}
            disabled={submitting}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t("requestBooking")}
            accessibilityHint={canSend ? undefined : (blocker ?? undefined)}
            accessibilityState={{ disabled: submitting, busy: submitting || waiting }}
          >
            {submitting ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Text style={styles.primaryButtonText}>{t("requestBooking")}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

/**
 * One start time. Memoised, with a stable `onPick`: picking one redraws the
 * two chips whose selection changed, not the other thirty-odd.
 */
const TimeChip = React.memo(function TimeChip({
  time,
  selected,
  width,
  onPick,
}: {
  time: string;
  selected: boolean;
  width: number;
  onPick: (time: string) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={() => onPick(time)}
      style={({ pressed }) => [
        styles.timeChip,
        { width },
        selected && styles.timeChipSelected,
        pressed && !selected && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={time}
    >
      <Text style={[styles.timeChipText, selected && styles.timeChipTextSelected]}>{time}</Text>
    </Pressable>
  );
});

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    head: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingBottom: 4,
    },
    headText: {
      flex: 1,
    },
    rowRTL: {
      flexDirection: "row-reverse",
    },
    textRTL: {
      textAlign: "right",
    },
    alignEnd: {
      alignItems: "flex-end",
    },
    title: {
      fontFamily: fonts.serif,
      fontSize: 24,
      color: colors.ink,
    },
    subtitle: {
      fontFamily: fonts.regular,
      fontSize: 14,
      color: colors.onSurface.variant,
      marginTop: 2,
    },
    // 36pt drawn; the negative margin gives the header its height back while
    // the 44pt square takes the touches.
    close: {
      width: 44,
      height: 44,
      marginVertical: -4,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    closeBusy: {
      opacity: 0.45,
    },
    pressed: {
      opacity: 0.7,
    },
    form: {
      flexShrink: 1,
    },
    scroll: {
      flexShrink: 1,
    },
    scrollContent: {
      paddingTop: 8,
      paddingBottom: 20,
    },
    sectionLabel: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      color: colors.ink,
    },
    sectionHint: {
      fontFamily: fonts.regular,
      fontSize: 13,
      color: colors.onSurface.variant,
      marginTop: 4,
      marginBottom: 12,
    },
    muted: {
      fontFamily: fonts.regular,
      fontSize: 14,
      color: colors.onSurface.muted,
    },
    calendar: {
      backgroundColor: "transparent",
      paddingBottom: 4,
      marginTop: 4,
    },
    divider: {
      height: 1,
      backgroundColor: colors.divider,
      marginVertical: 20,
    },
    timeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: TIME_GAP,
    },
    timeGridRTL: {
      flexDirection: "row-reverse",
    },
    // A full 44pt target each; the track colour on the sheet's white, like
    // the filter chips, never the page's cream (1.04:1 on white).
    timeChip: {
      minHeight: 44,
      borderRadius: 12,
      backgroundColor: colors.chip,
      alignItems: "center",
      justifyContent: "center",
    },
    // Lime is a fill; the time on it is ink.
    timeChipSelected: {
      backgroundColor: colors.primary.DEFAULT,
    },
    timeChipText: {
      fontFamily: fonts.medium,
      fontSize: 14,
      color: colors.onSurface.variant,
      fontVariant: ["tabular-nums"],
    },
    timeChipTextSelected: {
      fontFamily: fonts.semibold,
      color: colors.ink,
    },
    // The same pinned bar as the stay sheet's: one surface, a hairline above
    // it. Pulled out to the panel's edges so the hairline runs edge to edge.
    footer: {
      marginHorizontal: -BODY_PADDING,
      paddingHorizontal: BODY_PADDING,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      backgroundColor: colors.surface.DEFAULT,
      gap: 10,
    },
    // Tall enough for the label over the breakdown; every other state is laid
    // out inside the same box.
    slot: {
      minHeight: 44,
      justifyContent: "center",
    },
    hint: {
      fontFamily: fonts.regular,
      fontSize: 14,
      color: colors.onSurface.variant,
    },
    errorText: {
      fontFamily: fonts.medium,
      fontSize: 14,
      color: colors.signOut,
    },
    totalRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    totalLabels: {
      flexShrink: 1,
    },
    totalLabel: {
      fontFamily: fonts.semibold,
      fontSize: 14,
      color: colors.ink,
    },
    breakdown: {
      fontFamily: fonts.regular,
      fontSize: 13,
      color: colors.onSurface.variant,
      marginTop: 1,
    },
    stale: {
      opacity: 0.55,
    },
    // The number the sheet is about, in the display face.
    totalAmount: {
      fontFamily: fonts.serif,
      fontSize: 24,
      color: colors.ink,
      fontVariant: ["tabular-nums"],
    },
    totalSkeleton: {
      width: 88,
      height: 22,
    },
    payNote: {
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 18,
      color: colors.onSurface.muted,
    },
    // Lime is a fill; its label is ink. White on it is 1.4:1.
    primaryButton: {
      minHeight: 50,
      height: 52,
      borderRadius: 14,
      backgroundColor: colors.primary.DEFAULT,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonText: {
      fontFamily: fonts.semibold,
      fontSize: 16,
      color: colors.ink,
    },
  });
