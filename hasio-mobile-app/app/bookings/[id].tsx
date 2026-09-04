import { appAlert } from "@/stores/dialogStore";
import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Linking, Platform } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/backend";
import type { Id } from "../../../convex/_generated/dataModel";
import { BackButton } from "@/components/ui/BackButton";
import { BookingStatusChip } from "@/components/booking/BookingStatusChip";
import { ReviewSheet } from "@/components/review";
import { useLanguage, getLocalizedText } from "@/hooks/useLanguage";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { formatDateRange, formatISODate, todayRiyadhISO } from "@/lib/dates";
import { getBookingErrorKey } from "@/lib/bookingError";
import { SkeletonBookingDetail } from "@/components/ui/SkeletonScreens";
import { nightsLabel } from "@/lib/bookingDisplay";
import { haptic } from "@/lib/haptics";
import { colors, type AppFonts } from "@/constants/colors";
import { ScreenGradient, SurfaceGradient } from "@/components/ui/Gradients";

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { t, isRTL, language } = useLanguage();
  // Above the loading and not-found returns below, so the hook order holds.
  const styles = useThemedStyles(makeStyles);
  const promptStyles = useThemedStyles(makePromptStyles);
  const [cancelling, setCancelling] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const booking = useQuery(
    api.bookings.queries.getBooking,
    id ? { bookingId: id as Id<"bookings"> } : "skip"
  );
  const cancelBooking = useMutation(api.bookings.mutations.cancelBooking);

  // Declared here, above the loading and not-found returns, so the hook order
  // is the same on every render. Skipped until the booking names a listing.
  const myReview = useQuery(
    api.reviews.queries.getMine,
    booking?.listingId ? { listingId: booking.listingId } : "skip"
  );

  const listing = booking?.listing;
  const isStay = booking?.kind === "stay" && booking.checkIn && booking.checkOut;

  // Cancelling is only offered while it can still be honoured cleanly: before
  // arrival, and while the booking is still open. After check-in the room was
  // held and the night may be owed, so that is a conversation with the host.
  const canCancel =
    !!booking &&
    (booking.status === "pending" || booking.status === "confirmed") &&
    (booking.checkIn ?? booking.date) > todayRiyadhISO();

  const handleCancel = () => {
    if (!booking || cancelling) return;

    appAlert(t("cancelBookingConfirm"), t("cancelBookingMessage"), [
      { text: t("keepBooking"), style: "cancel" },
      {
        text: t("cancelBooking"),
        style: "destructive",
        onPress: async () => {
          haptic("warning");
          setCancelling(true);
          try {
            await cancelBooking({ bookingId: booking._id });
            appAlert(t("success"), t("bookingCancelled"));
          } catch (error) {
            appAlert(t("error"), t(getBookingErrorKey(error)));
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const openDirections = () => {
    if (!listing?.coordinates) return;
    const { lat, lng } = listing.coordinates;
    const url = Platform.select({
      ios: `maps://?daddr=${lat},${lng}`,
      default: `geo:${lat},${lng}?q=${lat},${lng}`,
    });
    Linking.openURL(url).catch(() => appAlert(t("error"), t("couldNotOpenLink")));
  };

  if (booking === undefined) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <ScreenGradient />
        <View style={[styles.header, isRTL && styles.rowRTL]}>
          <BackButton />
          <Text style={styles.title}>{t("bookingDetails")}</Text>
        </View>
        <SkeletonBookingDetail isRTL={isRTL} />
      </View>
    );
  }

  if (booking === null) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <ScreenGradient />
        <View style={[styles.header, isRTL && styles.rowRTL]}>
          <BackButton />
          <Text style={styles.title}>{t("bookingDetails")}</Text>
        </View>
        <View style={styles.empty}>
          <Feather name="calendar" size={40} color={colors.onSurface.muted} />
          <Text style={styles.emptyTitle}>{t("bookingNotFound")}</Text>
          <Text style={styles.emptyHint}>{t("bookingNotFoundHint")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <ScreenGradient />
      <View style={[styles.header, isRTL && styles.rowRTL]}>
        <BackButton />
        <Text style={styles.title}>{t("bookingDetails")}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.summaryCard}>
          {/* The one raised surface on the page: status and code are what the
              guest opens this screen to see. Everything below is content. */}
          <SurfaceGradient />
          <BookingStatusChip status={booking.status} />
          {booking.confirmationCode ? (
            <>
              <Text style={styles.codeLabel}>{t("confirmationCode")}</Text>
              <Text style={styles.code} selectable>
                {booking.confirmationCode}
              </Text>
            </>
          ) : null}
        </View>

        {listing ? (
          <View style={styles.section}>
            {listing.images?.[0] ? (
              <Image
                source={{ uri: listing.images[0] }}
                style={styles.hero}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : null}
            <Text style={[styles.listingName, isRTL && styles.textRTL]}>
              {getLocalizedText(listing.name_en, listing.name_ar, language)}
            </Text>
            <Text style={[styles.muted, isRTL && styles.textRTL]}>{listing.address}</Text>

            <View style={[styles.actions, isRTL && styles.rowRTL]}>
              {listing.phone ? (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${listing.phone}`)}
                  style={styles.actionButton}
                  accessibilityRole="button"
                  accessibilityLabel={t("detailCall")}
                >
                  <Feather name="phone" size={16} color={colors.primary.deep} />
                  <Text style={styles.actionText}>{t("detailCall")}</Text>
                </Pressable>
              ) : null}
              {listing.coordinates ? (
                <Pressable
                  onPress={openDirections}
                  style={styles.actionButton}
                  accessibilityRole="button"
                  accessibilityLabel={t("detailDirections")}
                >
                  <Feather name="navigation" size={16} color={colors.primary.deep} />
                  <Text style={styles.actionText}>{t("detailDirections")}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Row
            label={isStay ? t("checkIn") : t("date")}
            value={
              isStay
                ? `${formatISODate(booking.checkIn!, language)}${
                    listing?.checkInTime ? ` · ${listing.checkInTime}` : ""
                  }`
                : `${formatISODate(booking.date, language)} · ${booking.time}`
            }
            isRTL={isRTL}
          />
          {isStay ? (
            <Row
              label={t("checkOut")}
              value={`${formatISODate(booking.checkOut!, language)}${
                listing?.checkOutTime ? ` · ${listing.checkOutTime}` : ""
              }`}
              isRTL={isRTL}
            />
          ) : null}
          {booking.nights ? (
            <Row
              label={t("nights")}
              value={nightsLabel(booking.nights, t, booking.guests)}
              isRTL={isRTL}
            />
          ) : null}
          {booking.totalAmount != null ? (
            <Row
              label={t("total")}
              value={`${t("sar")} ${booking.totalAmount.toLocaleString("en-US")}`}
              isRTL={isRTL}
              emphasis
            />
          ) : null}
        </View>

        {booking.notes ? (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, isRTL && styles.textRTL]}>
              {t("notesOptional")}
            </Text>
            <Text style={[styles.body, isRTL && styles.textRTL]}>{booking.notes}</Text>
          </View>
        ) : null}

        {booking.declineReason ? (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, isRTL && styles.textRTL]}>
              {t("declineReason")}
            </Text>
            <Text style={[styles.body, isRTL && styles.textRTL]}>{booking.declineReason}</Text>
          </View>
        ) : null}

        {booking.status === "pending" ? (
          <Text style={styles.pendingNote}>{t("bookingPendingNote")}</Text>
        ) : null}

        {/* The stay is over and this guest has not rated it yet. `viewerRole`
            keeps it off a host's or an admin's view of the same booking —
            neither of them stayed here. */}
        {booking.status === "completed" && booking.viewerRole === "guest" && !myReview ? (
          <View style={promptStyles.ratePrompt}>
            <Text style={[promptStyles.ratePromptTitle, isRTL && styles.textRTL]}>
              {t("rateYourStay")}
            </Text>
            <Text style={[promptStyles.ratePromptBody, isRTL && styles.textRTL]}>
              {t("rateYourStayBody")}
            </Text>
            <Pressable
              style={[promptStyles.ratePromptButton, isRTL && promptStyles.alignEnd]}
              onPress={() => setReviewOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t("rateThisPlace")}
            >
              <Text style={promptStyles.ratePromptButtonText}>{t("rateThisPlace")}</Text>
            </Pressable>
          </View>
        ) : null}

        {canCancel ? (
          <Pressable
            onPress={handleCancel}
            disabled={cancelling}
            style={[styles.cancelButton, cancelling && styles.cancelButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel={t("cancelBooking")}
            accessibilityState={{ disabled: cancelling, busy: cancelling }}
          >
            <Text style={styles.cancelButtonText}>{t("cancelBooking")}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* Carries the booking id, which is the whole point: the server checks
          the stay really was this guest's and only then marks the review
          verified. Nothing here claims it. */}
      <ReviewSheet
        visible={reviewOpen}
        listingId={booking.listingId}
        bookingId={booking._id}
        onClose={() => setReviewOpen(false)}
      />
    </View>
  );
}

function Row({
  label,
  value,
  isRTL,
  emphasis,
}: {
  label: string;
  value: string;
  isRTL: boolean;
  emphasis?: boolean;
}) {
  // Same factory as the screen above, so this shares its cached stylesheet.
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.row, isRTL && styles.rowRTL]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, emphasis && styles.rowValueStrong]}>{value}</Text>
    </View>
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
  scroll: {
    paddingHorizontal: 20,
  },
  // The status and the code, raised off the page with the surface wash.
  summaryCard: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.surface.DEFAULT,
    padding: 18,
    gap: 8,
    marginBottom: 4,
  },
  // Everything else: content on the page, separated by space and a hairline
  // rather than stacked as a column of white boxes.
  section: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 8,
  },
  codeLabel: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
    marginTop: 4,
  },
  code: {
    fontSize: 30,
    fontFamily: fonts.serif,
    letterSpacing: 2,
    color: colors.ink,
  },
  hero: {
    width: "100%",
    height: 160,
    borderRadius: 20,
    backgroundColor: colors.sand,
  },
  listingName: {
    fontSize: 20,
    fontFamily: fonts.serif,
    color: colors.ink,
  },
  muted: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
  },
  textRTL: {
    textAlign: "right",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.mint,
  },
  actionText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.primary.deep,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
  },
  rowValue: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  // The total, so it takes the display face like every other headline number.
  rowValueStrong: {
    fontSize: 22,
    fontFamily: fonts.serif,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.onSurface.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  body: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
    lineHeight: 22,
  },
  pendingNote: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
    paddingTop: 16,
  },
  // Destructive, and the only action on the page, so it stays a quiet outline
  // with the destructive label rather than a filled red block.
  cancelButton: {
    minHeight: 50,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.signOut,
  },
});

/**
 * The rating prompt's own styles, built per language.
 *
 * Kept as its own factory only because the prompt is a self-contained block
 * with its own palette; like `makeStyles` above it goes through
 * `useThemedStyles`, so every `fontFamily` follows the active language rather
 * than being pinned to the Latin map at import time.
 */
const makePromptStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    ratePrompt: {
      backgroundColor: colors.mint,
      borderRadius: 24,
      padding: 18,
      gap: 6,
      marginTop: 20,
      marginBottom: 4,
    },
    ratePromptTitle: { fontFamily: fonts.serif, fontSize: 20, color: colors.ink },
    ratePromptBody: {
      fontFamily: fonts.regular,
      fontSize: 13,
      lineHeight: 19,
      color: colors.onSurface.variant,
    },
    ratePromptButton: {
      alignSelf: "flex-start",
      marginTop: 8,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.ink,
    },
    alignEnd: { alignSelf: "flex-end" },
    // Lime on ink, not ink on lime: this button sits on a mint card, where a
    // lime fill would all but disappear.
    ratePromptButtonText: {
      fontFamily: fonts.semibold,
      fontSize: 14,
      color: colors.primary.DEFAULT,
    },
  });
