import { appAlert } from "@/stores/dialogStore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Linking, StyleSheet } from "react-native";
import Animated, { FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/backend";
import type { Id } from "../../../convex/_generated/dataModel";
import { BackButton } from "@/components/ui/BackButton";
import { FilterChip } from "@/components/ui/FilterChip";
import { SkeletonHostBookingList } from "@/components/ui/SkeletonScreens";
import { DeclineReasonSheet } from "@/components/booking/DeclineReasonSheet";
import {
  HostBookingCard,
  type HostAction,
  type HostBookingData,
} from "@/components/booking/HostBookingCard";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrency } from "@/hooks/useCurrency";
import { todayRiyadhISO } from "@/lib/dates";
import {
  bookingActionErrorKey,
  displayTotalSar,
  minuteNow,
  nightsLabel,
  partitionProviderBookings,
  serviceAmountLabel,
  serviceWhen,
  telUrl,
  type ServiceAmount,
  type StayTotal,
} from "@/lib/bookingDisplay";
import { maybeAskForPush } from "@/lib/pushPrompt";
import { haptic } from "@/lib/haptics";
import { crossFadeIn, crossFadeOut } from "@/constants/motion";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { ScreenGradient } from "@/components/ui/Gradients";
import type { TranslationKey } from "@/constants/translations";

type Tab = "requests" | "upcoming" | "past";

const TOAST_MS = 1800;
// Often enough that a booking's buttons change within a minute of its start.
const CLOCK_TICK_MS = 30_000;
// Long enough for the screen to have slid in: the question should arrive
// over the inbox it is about, not over a screen still on its way.
const PUSH_PROMPT_DELAY_MS = 600;

/**
 * The clock to the minute, ticking while the inbox is open.
 *
 * A service's no-show and completed buttons come with its start time, and a
 * request goes out of Requests when it expires — both moments that pass while
 * a provider is looking at the list. Read once per render, as a stay's inbox
 * reads today's date, the buttons would wait for something else to re-render
 * the screen. Floored to the minute, so a tick that changes nothing renders
 * nothing (setState with an equal value bails out).
 */
function useMinuteClock(): number {
  const [now, setNow] = useState(() => minuteNow());
  useEffect(() => {
    const timer = setInterval(() => setNow(minuteNow()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * A service provider's booking inbox: the requests and bookings for their
 * services, as the host inbox is for places (app/business/bookings.tsx).
 *
 * One query feeds all three tabs, partitioned in JS rather than refetched per
 * tab, so every tab stays live: a request that arrives while the provider is
 * looking at "Upcoming" still lands in the count and the Requests list.
 *
 * Confirm is one tap, as for hosts: it is the action taken most often, and
 * the traveller is told either way. Decline asks for a reason, because
 * "declined" alone tells a traveller nothing. No-show asks first, because
 * nothing in the app takes it back.
 */
export default function ProviderBookingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t, isRTL, language } = useLanguage();
  const { format, currency } = useCurrency();
  const [tab, setTab] = useState<Tab>("requests");
  const [decliningId, setDecliningId] = useState<Id<"bookings"> | null>(null);
  // Which action is running on which booking, per card, so acting on a second
  // card while the first is saving does not bring the first one's buttons back.
  const [busy, setBusy] = useState<Record<string, HostAction>>({});
  const [toast, setToast] = useState<TranslationKey | null>(null);

  const bookings = useQuery(api.bookings.queries.getProviderBookings, {});
  const confirmBooking = useMutation(api.bookings.mutations.confirmBooking);
  const declineBooking = useMutation(api.bookings.mutations.declineBooking);
  const markNoShow = useMutation(api.bookings.mutations.markNoShow);
  const completeBooking = useMutation(api.bookings.mutations.completeBooking);

  const now = useMinuteClock();
  const today = todayRiyadhISO(now);

  // Opening the inbox is a moment a provider can see why notifications matter:
  // a request unanswered for 48 hours — or until its start time — is lost.
  // Asked after the screen has come in; the function decides whether to ask
  // at all (not twice a week, never once the system has an answer).
  useEffect(() => {
    const timer = setTimeout(() => maybeAskForPush("host"), PUSH_PROMPT_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Live requests and upcoming work soonest first; see partitionProviderBookings.
  const groups = useMemo(
    () => partitionProviderBookings<HostBookingData>(bookings ?? [], now),
    [bookings, now]
  );

  const shown = groups[tab];

  // The cards with a request in flight. A ref as well as the `busy` state:
  // two taps can land in one frame, before the card has re-rendered with its
  // buttons disabled, and the second must not send the mutation again.
  const inFlight = useRef(new Set<string>());

  // Resolves whether the change went through, so the decline sheet can stay
  // open on a failure.
  const run = useCallback(
    async (
      id: string,
      action: HostAction,
      mutate: () => Promise<unknown>,
      successKey: TranslationKey
    ): Promise<boolean> => {
      if (inFlight.current.has(id)) return false;
      inFlight.current.add(id);
      setBusy((current) => ({ ...current, [id]: action }));
      try {
        await mutate();
        haptic("success");
        setToast(successKey);
        setTimeout(() => setToast((current) => (current === successKey ? null : current)), TOAST_MS);
        return true;
      } catch (error) {
        haptic("warning");
        appAlert(t("error"), t(bookingActionErrorKey(error, "service")));
        return false;
      } finally {
        inFlight.current.delete(id);
        setBusy((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
      }
    },
    [t]
  );

  const onAction = useCallback(
    (id: string, action: HostAction) => {
      const bookingId = id as Id<"bookings">;
      switch (action) {
        case "confirm":
          void run(id, action, () => confirmBooking({ bookingId }), "confirmedToast");
          return;
        case "decline":
          haptic("warning");
          setDecliningId(bookingId);
          return;
        case "noShow":
          haptic("warning");
          appAlert(t("noShowConfirmTitle"), t("noShowConfirmMessage"), [
            { text: t("cancel"), style: "cancel" },
            {
              text: t("markNoShow"),
              style: "destructive",
              onPress: () => {
                void run(id, action, () => markNoShow({ bookingId }), "noShowToast");
              },
            },
          ]);
          return;
        case "complete":
          void run(id, action, () => completeBooking({ bookingId }), "serviceCompletedToast");
          return;
      }
    },
    [run, t, confirmBooking, markNoShow, completeBooking]
  );

  const labels = useMemo(
    () => ({
      // Only a stay reads this, and a provider's inbox holds none; the card's
      // props still ask for it.
      stay: (nights: number, guests?: number) => nightsLabel(nights, t, guests),
      guest: t("guest"),
      formatTotal: (stay: StayTotal) => format(displayTotalSar(stay, currency)),
      callGuest: t("callGuest"),
      confirm: t("confirmBooking"),
      decline: t("declineBooking"),
      noShow: t("markNoShow"),
      // Not the host's markCompleted, whose Arabic is «إتمام الإقامة»,
      // "complete the stay".
      complete: t("markServiceCompleted"),
      service: {
        when: (date: string, time: string) => serviceWhen(date, time, language, t),
        amount: (booking: ServiceAmount) => serviceAmountLabel(booking, t),
        gone: t("serviceNoLongerListed"),
      },
    }),
    [t, format, currency, language]
  );

  // No canOpenURL first: on Android 11+ it says no for `tel:`, which the
  // manifest does not declare. openURL rejects when nothing can dial.
  const callGuest = useCallback(
    (phone: string) => {
      Linking.openURL(telUrl(phone)).catch(() => appAlert(t("error"), t("detailCallFailed")));
    },
    [t]
  );

  const renderItem = useCallback(
    ({ item }: { item: HostBookingData }) => (
      // A request confirmed or declined leaves the Requests list: it fades
      // out while the cards below close the gap (itemLayoutAnimation).
      <Animated.View exiting={FadeOut.duration(180)}>
        <HostBookingCard
          booking={item}
          today={today}
          now={now}
          language={language}
          isRTL={isRTL}
          busy={busy[item._id] ?? null}
          labels={labels}
          onAction={onAction}
          onCall={callGuest}
        />
      </Animated.View>
    ),
    [today, now, language, isRTL, busy, labels, onAction, callGuest]
  );
  // What the cards read beyond their own booking: a busy flag, and the clock
  // that turns a booking's buttons on at its start time.
  const listExtra = useMemo(() => ({ busy, now }), [busy, now]);

  const switchTab = (next: Tab) => {
    if (next === tab) return;
    haptic("light");
    setTab(next);
  };

  const hasAny = groups.requests.length + groups.upcoming.length + groups.past.length > 0;
  // A provider with no bookings at all is told where requests will show up;
  // one with bookings elsewhere is told what this tab is waiting for.
  const emptyCopy = !hasAny
    ? { title: t("providerNoRequests"), hint: t("providerNoRequestsHint") }
    : tab === "requests"
      ? { title: t("noRequests"), hint: t("noRequestsHint") }
      : tab === "upcoming"
        ? { title: t("noUpcomingBookings"), hint: "" }
        : { title: t("noPastStays"), hint: "" };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <ScreenGradient />
      <View style={[styles.header, isRTL && styles.rowRTL]}>
        <BackButton />
        <Text style={styles.title}>{t("bookingRequests")}</Text>
      </View>

      <View style={[styles.tabs, isRTL && styles.rowRTL]}>
        <FilterChip
          label={`${t("requests")}${groups.requests.length ? ` (${groups.requests.length})` : ""}`}
          selected={tab === "requests"}
          onPress={() => switchTab("requests")}
        />
        <FilterChip
          label={t("upcoming")}
          selected={tab === "upcoming"}
          onPress={() => switchTab("upcoming")}
        />
        <FilterChip label={t("past")} selected={tab === "past"} onPress={() => switchTab("past")} />
      </View>

      {bookings === undefined ? (
        <SkeletonHostBookingList isRTL={isRTL} count={3} />
      ) : (
        <Animated.View key={tab} style={styles.fill} entering={crossFadeIn} exiting={crossFadeOut}>
          {shown.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="inbox" size={40} color={colors.onSurface.muted} />
              <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
              {emptyCopy.hint ? <Text style={styles.emptyHint}>{emptyCopy.hint}</Text> : null}
            </View>
          ) : (
            <Animated.FlatList
              data={shown}
              keyExtractor={(booking) => booking._id}
              renderItem={renderItem}
              // A busy card, or one whose start time just passed, must
              // re-render even though its booking object did not change.
              extraData={listExtra}
              // The cards under a card that left slide up into its place.
              itemLayoutAnimation={LinearTransition.duration(220)}
              // Not on a tab switch, though: the whole list cross-fades there,
              // and every card fading out on its own would fight it.
              skipEnteringExitingAnimations
              contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
              initialNumToRender={6}
              windowSize={5}
              // No removeClippedSubviews: detaching off-screen cards breaks the
              // layout animation above, and an inbox is short.
              showsVerticalScrollIndicator={false}
            />
          )}
        </Animated.View>
      )}

      {/* A quiet confirmation at the bottom edge, instead of a modal the
          provider has to dismiss before acting on the next request. */}
      {toast ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          exiting={FadeOut.duration(160)}
          style={[styles.toast, { bottom: insets.bottom + 20 }]}
          accessibilityLiveRegion="polite"
          pointerEvents="none"
        >
          <Feather name="check" size={14} color={colors.hostingAccent} />
          <Text style={styles.toastText}>{t(toast)}</Text>
        </Animated.View>
      ) : null}

      <DeclineReasonSheet
        visible={decliningId !== null}
        onClose={() => setDecliningId(null)}
        onSubmit={async (reason) => {
          if (!decliningId) return false;
          const bookingId = decliningId;
          const declined = await run(
            bookingId,
            "decline",
            () => declineBooking({ bookingId, reason: reason || undefined }),
            "declinedToast"
          );
          // Closed only once the decline has gone through, so a failure keeps
          // the reason the provider wrote.
          if (declined) setDecliningId(null);
          return declined;
        }}
      />
    </View>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fill: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  rowRTL: {
    flexDirection: "row-reverse",
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.serif,
    color: colors.ink,
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  list: {
    paddingHorizontal: 20,
    gap: 12,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: fonts.serif,
    color: colors.ink,
    marginTop: 8,
    textAlign: "center",
  },
  emptyHint: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
    textAlign: "center",
  },
  // The one dark surface in the flow, so its check takes the lime accent kept
  // for ink backgrounds and its label the plain light face.
  toast: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.ink,
  },
  toastText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.surface.DEFAULT,
  },
});
