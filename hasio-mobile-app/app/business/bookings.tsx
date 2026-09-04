import { appAlert } from "@/stores/dialogStore";
import React, { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/backend";
import type { Id } from "../../../convex/_generated/dataModel";
import { BackButton } from "@/components/ui/BackButton";
import { FilterChip } from "@/components/ui/FilterChip";
import { SkeletonBookingList } from "@/components/ui/SkeletonScreens";
import { DeclineReasonSheet } from "@/components/booking/DeclineReasonSheet";
import {
  HostBookingCard,
  type HostAction,
  type HostBookingData,
} from "@/components/booking/HostBookingCard";
import { useLanguage } from "@/hooks/useLanguage";
import { todayRiyadhISO } from "@/lib/dates";
import { getBookingErrorKey } from "@/lib/bookingError";
import { haptic } from "@/lib/haptics";
import { crossFadeIn, crossFadeOut } from "@/constants/motion";
import { fonts } from "@/constants/colors";
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
 * Decline keeps its sheet, because a reason is worth asking for.
 */
export default function OwnerBookingsScreen() {
  const insets = useSafeAreaInsets();
  const { t, isRTL, language } = useLanguage();
  const [tab, setTab] = useState<Tab>("requests");
  const [decliningId, setDecliningId] = useState<Id<"bookings"> | null>(null);
  const [busy, setBusy] = useState<{ id: string; action: HostAction } | null>(null);
  const [toast, setToast] = useState<TranslationKey | null>(null);

  const bookings = useQuery(api.bookings.queries.getBusinessBookings, {});
  const confirmBooking = useMutation(api.bookings.mutations.confirmBooking);
  const declineBooking = useMutation(api.bookings.mutations.declineBooking);
  const markNoShow = useMutation(api.bookings.mutations.markNoShow);
  const completeBooking = useMutation(api.bookings.mutations.completeBooking);

  const today = todayRiyadhISO();

  const groups = useMemo(() => {
    const requests: HostBookingData[] = [];
    const upcoming: HostBookingData[] = [];
    const past: HostBookingData[] = [];

    for (const booking of bookings ?? []) {
      if (booking.status === "pending") requests.push(booking);
      else if (booking.status === "confirmed" && (booking.checkOut ?? booking.date) >= today) {
        upcoming.push(booking);
      } else past.push(booking);
    }
    return { requests, upcoming, past };
  }, [bookings, today]);

  const shown = groups[tab];

  const run = useCallback(
    async (id: string, action: HostAction, mutate: () => Promise<unknown>, successKey: TranslationKey) => {
      setBusy({ id, action });
      try {
        await mutate();
        haptic("success");
        setToast(successKey);
        setTimeout(() => setToast((current) => (current === successKey ? null : current)), TOAST_MS);
      } catch (error) {
        haptic("warning");
        appAlert(t("error"), t(getBookingErrorKey(error)));
      } finally {
        setBusy(null);
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
          run(id, action, () => markNoShow({ bookingId }), "noShowToast");
          return;
        case "complete":
          run(id, action, () => completeBooking({ bookingId }), "completedToast");
          return;
      }
    },
    [run, confirmBooking, markNoShow, completeBooking]
  );

  const labels = useMemo(
    () => ({
      night: t("night"),
      nights: t("nights"),
      guests: t("guests"),
      guest: t("guest"),
      sar: t("sar"),
      callGuest: t("callGuest"),
      confirm: t("confirmBooking"),
      decline: t("declineBooking"),
      noShow: t("markNoShow"),
      complete: t("markCompleted"),
    }),
    [t]
  );

  const renderItem = useCallback(
    ({ item }: { item: HostBookingData }) => (
      <HostBookingCard
        booking={item}
        today={today}
        language={language}
        isRTL={isRTL}
        busy={busy?.id === item._id ? busy.action : null}
        labels={labels}
        onAction={onAction}
      />
    ),
    [today, language, isRTL, busy, labels, onAction]
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
        <SkeletonBookingList isRTL={isRTL} count={3} />
      ) : (
        <Animated.View key={tab} style={styles.fill} entering={crossFadeIn} exiting={crossFadeOut}>
          {shown.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="inbox" size={40} color="#C4C0BA" />
              <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
              {emptyCopy.hint ? <Text style={styles.emptyHint}>{emptyCopy.hint}</Text> : null}
            </View>
          ) : (
            <FlatList
              data={shown}
              keyExtractor={(booking) => booking._id}
              renderItem={renderItem}
              // The busy card must re-render when busy changes even though
              // its booking object did not.
              extraData={busy}
              contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
              initialNumToRender={6}
              windowSize={5}
              removeClippedSubviews
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
          <Feather name="check" size={14} color="#FFFFFF" />
          <Text style={styles.toastText}>{t(toast)}</Text>
        </Animated.View>
      ) : null}

      <DeclineReasonSheet
        visible={decliningId !== null}
        onClose={() => setDecliningId(null)}
        onSubmit={async (reason) => {
          if (!decliningId) return;
          const bookingId = decliningId;
          setDecliningId(null);
          await run(
            bookingId,
            "decline",
            () => declineBooking({ bookingId, reason: reason || undefined }),
            "declinedToast"
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
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
    fontSize: 24,
    fontFamily: fonts.bold,
    color: "#1A1A1A",
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
    fontSize: 17,
    fontFamily: fonts.semibold,
    color: "#1A1A1A",
    marginTop: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: "#737373",
    textAlign: "center",
  },
  toast: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#1A1A1A",
  },
  toastText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: "#FFFFFF",
  },
});
