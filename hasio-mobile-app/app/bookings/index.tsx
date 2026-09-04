import React, { useCallback, useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "@/backend";
import { BackButton } from "@/components/ui/BackButton";
import { FilterChip } from "@/components/ui/FilterChip";
import { SkeletonBookingList } from "@/components/ui/SkeletonScreens";
import { BookingRow, type BookingRowData } from "@/components/booking/BookingRow";
import { useLanguage } from "@/hooks/useLanguage";
import { todayRiyadhISO } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { crossFadeIn, crossFadeOut } from "@/constants/motion";
import { type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

type Tab = "upcoming" | "past";

/**
 * The guest's own bookings.
 *
 * Real-time through useQuery, so a host confirming on their phone flips the
 * status here without the guest doing anything — which is the whole point of
 * a request-and-confirm flow that has no payment step to close it.
 */
export default function MyBookingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, isRTL, language } = useLanguage();
  const [tab, setTab] = useState<Tab>("upcoming");

  const bookings = useQuery(api.bookings.queries.getUserBookings, {});
  const today = todayRiyadhISO();

  const { upcoming, past } = useMemo(() => {
    const up: BookingRowData[] = [];
    const old: BookingRowData[] = [];

    for (const booking of bookings ?? []) {
      const stillOpen = booking.status === "pending" || booking.status === "confirmed";
      // A stay stays "upcoming" until the guest checks out, not until they
      // check in — they are still living it on the middle night.
      const endsAfterToday = (booking.checkOut ?? booking.date) >= today;
      (stillOpen && endsAfterToday ? up : old).push(booking);
    }
    return { upcoming: up, past: old };
  }, [bookings, today]);

  const shown = tab === "upcoming" ? upcoming : past;

  // Stable identities so the memoised row is not handed a new callback or
  // a new labels object on every render of this screen. `t` is a useCallback
  // keyed on language, so these recompute once per language switch.
  const labels = useMemo(
    () => ({ night: t("night"), nights: t("nights"), guests: t("guests"), sar: t("sar") }),
    [t]
  );
  const openBooking = useCallback((id: string) => router.push(`/bookings/${id}`), [router]);
  const renderItem = useCallback(
    ({ item }: { item: BookingRowData }) => (
      <BookingRow booking={item} language={language} isRTL={isRTL} labels={labels} onPress={openBooking} />
    ),
    [language, isRTL, labels, openBooking]
  );

  const switchTab = (next: Tab) => {
    if (next === tab) return;
    haptic("light");
    setTab(next);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={[styles.header, isRTL && styles.headerRTL]}>
        <BackButton />
        <Text style={styles.title}>{t("myBookings")}</Text>
      </View>

      <View style={[styles.tabs, isRTL && styles.headerRTL]}>
        <FilterChip label={t("upcoming")} selected={tab === "upcoming"} onPress={() => switchTab("upcoming")} />
        <FilterChip label={t("past")} selected={tab === "past"} onPress={() => switchTab("past")} />
      </View>

      {bookings === undefined ? (
        <SkeletonBookingList isRTL={isRTL} count={3} />
      ) : (
        // Keyed on the tab so a switch unmounts one list and mounts the
        // other — that is what gives the cross-fade something to fade.
        <Animated.View key={tab} style={styles.fill} entering={crossFadeIn} exiting={crossFadeOut}>
          {shown.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="calendar" size={40} color="#C4C0BA" />
              <Text style={styles.emptyTitle}>{t("noBookings")}</Text>
              <Text style={styles.emptyHint}>{t("noBookingsHint")}</Text>
            </View>
          ) : (
            <FlatList
              data={shown}
              keyExtractor={(booking) => booking._id}
              renderItem={renderItem}
              contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
              // A guest has a handful of bookings; render them all up front
              // rather than paging in a 4th row on scroll.
              initialNumToRender={8}
              windowSize={5}
              removeClippedSubviews
              showsVerticalScrollIndicator={false}
            />
          )}
        </Animated.View>
      )}
    </View>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
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
  headerRTL: {
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
});
