import { appAlert } from "@/stores/dialogStore";
import React, { useCallback, useMemo, useState } from "react";
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
  displayTotalSar,
  nightsLabel,
  partitionHostBookings,
  telUrl,
  type StayTotal,
} from "@/lib/bookingDisplay";
import { getBookingErrorKey } from "@/lib/bookingError";
import { haptic } from "@/lib/haptics";
import { crossFadeIn, crossFadeOut } from "@/constants/motion";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { ScreenGradient } from "@/components/ui/Gradients";
import type { TranslationKey } from "@/constants/translations";

type Tab = "requests" | "upcoming" | "past";

const TOAST_MS = 1800;

/**
 * The host's booking inbox.
 *
 * One query feeds all three tabs, partitioned in JS rather than refetched per
 * tab, so every tab stays live: a request that arrives while the host is
 * looking at "Upcoming" still lands in the badge and the Requests list.
 *
 * Confirm is one tap. It is the action the host takes twenty times a week,
 * it is reversible on the admin side, and the guest is told either way — a
 * "are you sure?" in front of it only trains the host to tap through it.
 * Decline keeps its sheet, because a reason is worth asking for. No-show asks
 * first, because nothing in the app takes it back.
 */
export default function OwnerBookingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t, isRTL, language } = useLanguage();
  const { format, currency } = useCurrency();
  const [tab, setTab] = useState<Tab>("requests");
  const [decliningId, setDecliningId] = useState<Id<"bookings"> | null>(null);
  // Which action is running on which booking. It used to be one slot for the
  // whole screen: acting on a second card while the first was still saving
  // overwrote it, and the first card's buttons came back mid-request.
  const [busy, setBusy] = useState<Record<string, HostAction>>({});
  const [toast, setToast] = useState<TranslationKey | null>(null);

  const bookings = useQuery(api.bookings.queries.getBusinessBookings, {});
  const confirmBooking = useMutation(api.bookings.mutations.confirmBooking);
  const declineBooking = useMutation(api.bookings.mutations.declineBooking);
  const markNoShow = useMutation(api.bookings.mutations.markNoShow);
  const completeBooking = useMutation(api.bookings.mutations.completeBooking);

  const today = todayRiyadhISO();

  // Soonest arrival first in Requests and Upcoming; see partitionHostBookings.
  const groups = useMemo(
    () => partitionHostBookings<HostBookingData>(bookings ?? [], today),
    [bookings, today]
  );

  const shown = groups[tab];

  // Resolves whether the change went through, so the decline sheet can stay
  // open on a failure.
  const run = useCallback(
    async (
      id: string,
      action: HostAction,
      mutate: () => Promise<unknown>,
      successKey: TranslationKey
    ): Promise<boolean> => {
      setBusy((current) => ({ ...current, [id]: action }));
      try {
        await mutate();
        haptic("success");
        setToast(successKey);
        setTimeout(() => setToast((current) => (current === successKey ? null : current)), TOAST_MS);
        return true;
      } catch (error) {
        haptic("warning");
        appAlert(t("error"), t(getBookingErrorKey(error)));
        return false;
      } finally {
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
          run(id, action, () => confirmBooking({ bookingId }), "confirmedToast");
          return;
        case "decline":
          haptic("warning");
          setDecliningId(bookingId);
          return;
        case "noShow":
          // Asked first. It sits beside "Mark completed", marks the guest's
          // booking as a no-show for good — the app has no way to take it
          // back — and one stray tap was all it took.
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
          run(id, action, () => completeBooking({ bookingId }), "completedToast");
          return;
      }
    },
    [run, t, confirmBooking, markNoShow, completeBooking]
  );

  const labels = useMemo(
    () => ({
      stay: (nights: number, guests?: number) => nightsLabel(nights, t, guests),
      guest: t("guest"),
      formatTotal: (stay: StayTotal) => format(displayTotalSar(stay, currency)),
      callGuest: t("callGuest"),
      confirm: t("confirmBooking"),
      decline: t("declineBooking"),
      noShow: t("markNoShow"),
      complete: t("markCompleted"),
    }),
    [t, format, currency]
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
      // out while the cards below close the gap (itemLayoutAnimation), where
      // it used to vanish and the list jump up under the host's thumb.
      <Animated.View exiting={FadeOut.duration(180)}>
        <HostBookingCard
          booking={item}
          today={today}
          language={language}
          isRTL={isRTL}
          busy={busy[item._id] ?? null}
          labels={labels}
          onAction={onAction}
          onCall={callGuest}
        />
      </Animated.View>
    ),
    [today, language, isRTL, busy, labels, onAction, callGuest]
  );

  const switchTab = (next: Tab) => {
    if (next === tab) return;
    haptic("light");
    setTab(next);
  };

  const emptyCopy =
    tab === "requests"
      ? { title: t("noRequests"), hint: t("noRequestsHint") }
      : tab === "upcoming"
        ? { title: t("noUpcomingStays"), hint: "" }
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
              // The busy card must re-render when busy changes even though
              // its booking object did not.
              extraData={busy}
              // The cards under a card that left slide up into its place.
              itemLayoutAnimation={LinearTransition.duration(220)}
              // Not on a tab switch, though: the whole list cross-fades there,
              // and every card fading out on its own would fight it.
              skipEnteringExitingAnimations
              contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
              initialNumToRender={6}
              windowSize={5}
              // No removeClippedSubviews: detaching off-screen cards breaks the
              // layout animation above, and a host's inbox is short.
              showsVerticalScrollIndicator={false}
            />
          )}
        </Animated.View>
      )}

      {/* A quiet confirmation at the bottom edge, instead of a modal the host
          has to dismiss before acting on the next request. */}
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
          // Closed only once the decline has gone through. It used to close
          // before sending, taking its spinner with it, and a failure then
          // threw away the reason the host had written.
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
