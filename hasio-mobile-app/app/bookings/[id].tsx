import { appAlert } from "@/stores/dialogStore";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/backend";
import type { Id } from "../../../convex/_generated/dataModel";
import { BackButton } from "@/components/ui/BackButton";
import { BookingStatusChip } from "@/components/booking/BookingStatusChip";
import { DeclineReasonSheet } from "@/components/booking/DeclineReasonSheet";
import { HostActionButton, type HostAction } from "@/components/booking/HostBookingCard";
import { ReviewSheet } from "@/components/review";
import { useLanguage, getLocalizedText } from "@/hooks/useLanguage";
import { useCurrency } from "@/hooks/useCurrency";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { cityLabel } from "@/constants/cities";
import { formatISODate, todayRiyadhISO } from "@/lib/dates";
import { SkeletonBookingDetail } from "@/components/ui/SkeletonScreens";
import {
  bookingActionErrorKey,
  countLabel,
  displayTotalSar,
  minuteNow,
  nightsLabel,
  providerActionsFor,
  riyadhMoment,
  serviceWhen,
  telUrl,
  totalShownFor,
} from "@/lib/bookingDisplay";
import { serviceTypeLabelKey } from "@/lib/listingForm";
import { formatPhoneForDisplay, ltr } from "@/lib/phone";
import { haptic } from "@/lib/haptics";
import { colors, type AppFonts } from "@/constants/colors";
import { ScreenGradient, SurfaceGradient } from "@/components/ui/Gradients";

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { t, isRTL, language } = useLanguage();
  const { format, currency } = useCurrency();
  // Above the loading and not-found returns below, so the hook order holds.
  const styles = useThemedStyles(makeStyles);
  const promptStyles = useThemedStyles(makePromptStyles);
  const [cancelling, setCancelling] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  // A provider acting on their own service booking from here: which action
  // is running, and a ref for the tap that lands in the same frame as another.
  const [busy, setBusy] = useState<HostAction | null>(null);
  const busyRef = useRef(false);
  const [declineOpen, setDeclineOpen] = useState(false);

  // `includeServices`: without it a service booking is "not found", which is
  // what the 1.0.2 app, tapping a service notification, can render.
  const booking = useQuery(
    api.bookings.queries.getBooking,
    id ? { bookingId: id as Id<"bookings">, includeServices: true } : "skip"
  );
  const cancelBooking = useMutation(api.bookings.mutations.cancelBooking);
  const confirmBooking = useMutation(api.bookings.mutations.confirmBooking);
  const declineBooking = useMutation(api.bookings.mutations.declineBooking);
  const completeBooking = useMutation(api.bookings.mutations.completeBooking);
  const markNoShow = useMutation(api.bookings.mutations.markNoShow);

  const isService = booking?.kind === "service";
  // Null for a stay, and for a service deleted since it was booked.
  const service = booking?.service ?? null;

  // Declared here, above the loading and not-found returns, so the hook order
  // is the same on every render. Skipped until the booking names what was
  // booked: a place for a stay, a service for a service booking — and a
  // deleted service cannot be reviewed, so it is not asked about.
  const myReview = useQuery(
    api.reviews.queries.getMine,
    !isService && booking?.listingId ? { listingId: booking.listingId } : "skip"
  );
  const myServiceReview = useQuery(
    api.reviews.queries.getMineForService,
    isService && service ? { serviceId: service._id } : "skip"
  );

  const listing = booking?.listing;
  const isStay = booking?.kind === "stay" && booking.checkIn && booking.checkOut;
  // To the minute, like the list: a service's cancel and closing buttons turn
  // on its start time.
  const now = minuteNow();

  // Cancelling is only offered while it can still be honoured cleanly: before
  // arrival, and while the booking is still open. After check-in the room was
  // held and the night may be owed, so that is a conversation with the host.
  // A service is the same from its start time (the server refuses after it,
  // SERVICE_STARTED), which is a moment in Riyadh, not a day. And only to the
  // guest: cancelBooking refuses anyone else, and a host or an admin viewing
  // the booking here was offered a button that could only fail.
  const canCancel =
    !!booking &&
    booking.viewerRole === "guest" &&
    (booking.status === "pending" || booking.status === "confirmed") &&
    (isService
      ? riyadhMoment(booking.date, booking.time) > now
      : (booking.checkIn ?? booking.date) > todayRiyadhISO(now));

  // The provider's own buttons on their service booking — the pair their
  // inbox card shows. A provider reached this screen from a notification
  // before the provider inbox existed, with nothing to act with.
  const providerActions =
    booking && booking.viewerRole === "provider" && isService
      ? providerActionsFor(booking, now)
      : "none";

  const handleCancel = () => {
    if (!booking || cancelling) return;
    const kind = booking.kind;

    // A service request withdrawn is a request; a confirmed one is a booking.
    // Either way it is the provider, not a host, who is told.
    const title = isService
      ? booking.status === "pending"
        ? t("cancelRequestConfirm")
        : t("cancelBookingConfirm")
      : t("cancelBookingConfirm");
    appAlert(title, isService ? t("cancelRequestMessage") : t("cancelBookingMessage"), [
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
            appAlert(t("error"), t(bookingActionErrorKey(error, kind)));
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  // Straight to openURL, as in the listing sheet — no canOpenURL first, which
  // says no on Android 11+ for `tel:` because the manifest does not declare
  // it. The stored number keeps its spaces, which some Android dialers
  // reject; telUrl keeps only the digits. The call used to have no catch at
  // all, so a failure was an unhandled rejection and a button that did nothing.
  const call = (phone?: string | null) => {
    if (!phone) return;
    Linking.openURL(telUrl(phone)).catch(() => appAlert(t("error"), t("detailCallFailed")));
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

  // Resolves whether it went through, so the decline sheet can stay open on a
  // failure with the reason as typed.
  const act = async (action: HostAction, mutate: () => Promise<unknown>): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(action);
    try {
      await mutate();
      haptic("success");
      return true;
    } catch (error) {
      haptic("warning");
      appAlert(t("error"), t(bookingActionErrorKey(error, booking?.kind)));
      return false;
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  // As in the inbox: confirm and complete are one tap, decline asks for a
  // reason, and a no-show asks first — nothing in the app takes it back.
  const onProviderAction = (action: HostAction) => {
    if (!booking || busyRef.current) return;
    const bookingId = booking._id;
    switch (action) {
      case "confirm":
        void act(action, () => confirmBooking({ bookingId }));
        return;
      case "decline":
        haptic("warning");
        setDeclineOpen(true);
        return;
      case "noShow":
        haptic("warning");
        appAlert(t("noShowConfirmTitle"), t("noShowConfirmMessage"), [
          { text: t("cancel"), style: "cancel" },
          {
            text: t("markNoShow"),
            style: "destructive",
            onPress: () => {
              void act(action, () => markNoShow({ bookingId }));
            },
          },
        ]);
        return;
      case "complete":
        void act(action, () => completeBooking({ bookingId }));
        return;
    }
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

  const isGuest = booking.viewerRole === "guest";
  const provider = booking.provider;
  const providerName = [provider?.firstName, provider?.lastName].filter(Boolean).join(" ").trim();
  const guest = booking.guest;
  const guestName =
    [guest?.firstName, guest?.lastName].filter(Boolean).join(" ").trim() || t("guest");
  // Hours or days only when the service is priced by them; the group always.
  const duration =
    booking.quantity && booking.priceUnit === "per_hour"
      ? countLabel(booking.quantity, "hours", t)
      : booking.quantity && booking.priceUnit === "per_day"
        ? countLabel(booking.quantity, "days", t)
        : null;
  const people = booking.partySize ?? booking.guests;
  // "Tour Guide · Al Ahsa" under the service's title.
  const serviceMeta = service
    ? [t(serviceTypeLabelKey(service.serviceType)), service.city ? cityLabel(service.city, language) : ""]
        .filter(Boolean)
        .join(" · ")
    : "";

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
              {/* To the right in Arabic, under the chip, which already is. */}
              <Text style={[styles.codeLabel, isRTL && styles.textRTL]}>
                {t("confirmationCode")}
              </Text>
              <Text style={[styles.code, isRTL && styles.textRTL]} selectable>
                {booking.confirmationCode}
              </Text>
            </>
          ) : null}
        </View>

        {isService ? (
          // The service, and who to reach about it. No directions: a service
          // has no address of its own — the meeting point is agreed with the
          // provider, which is what the call is for.
          <View style={styles.section}>
            {service?.images?.[0] ? (
              <Image
                source={{ uri: service.images[0] }}
                style={styles.hero}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : null}
            <Text style={[styles.listingName, isRTL && styles.textRTL]}>
              {service
                ? getLocalizedText(service.title_en, service.title_ar, language)
                : t("serviceNoLongerListed")}
            </Text>
            {service ? (
              <Text style={[styles.muted, isRTL && styles.textRTL]}>
                {serviceMeta}
              </Text>
            ) : null}

            {isGuest && provider ? (
              <View style={styles.contactBlock}>
                <Text style={[styles.sectionLabel, isRTL && styles.textRTL]}>
                  {t("bookingProvider")}
                </Text>
                {providerName ? (
                  <Text style={[styles.contactName, isRTL && styles.textRTL]}>{providerName}</Text>
                ) : null}
                {provider.phone ? (
                  <>
                    {/* In one piece: in an Arabic line the digit groups
                        otherwise come out in reverse order. */}
                    <Text style={[styles.muted, isRTL && styles.textRTL]}>
                      {ltr(formatPhoneForDisplay(provider.phone))}
                    </Text>
                    <View style={[styles.actions, isRTL && styles.rowRTL]}>
                      <Pressable
                        onPress={() => call(provider.phone)}
                        style={({ pressed }) => [
                          styles.actionButton,
                          isRTL && styles.rowRTL,
                          pressed && styles.pressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={t("callProvider")}
                      >
                        <Feather name="phone" size={16} color={colors.primary.deep} />
                        <Text style={styles.actionText}>{t("callProvider")}</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}

            {booking.viewerRole === "provider" && guest ? (
              <View style={styles.contactBlock}>
                <Text style={[styles.sectionLabel, isRTL && styles.textRTL]}>{t("guest")}</Text>
                <Text style={[styles.contactName, isRTL && styles.textRTL]}>{guestName}</Text>
                {guest.phone ? (
                  <>
                    <Text style={[styles.muted, isRTL && styles.textRTL]}>
                      {ltr(formatPhoneForDisplay(guest.phone))}
                    </Text>
                    <View style={[styles.actions, isRTL && styles.rowRTL]}>
                      <Pressable
                        onPress={() => call(guest.phone)}
                        style={({ pressed }) => [
                          styles.actionButton,
                          isRTL && styles.rowRTL,
                          pressed && styles.pressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={t("callGuest")}
                      >
                        <Feather name="phone" size={16} color={colors.primary.deep} />
                        <Text style={styles.actionText}>{t("callGuest")}</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : listing ? (
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
                  onPress={() => call(listing.phone)}
                  style={({ pressed }) => [
                    styles.actionButton,
                    isRTL && styles.rowRTL,
                    pressed && styles.pressed,
                  ]}
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
                  style={({ pressed }) => [
                    styles.actionButton,
                    isRTL && styles.rowRTL,
                    pressed && styles.pressed,
                  ]}
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

        {isService ? (
          <View style={styles.section}>
            {/* The start time as stored — Riyadh time — never re-read in the
                phone's zone, which moved it for a traveller abroad. */}
            <Row
              label={t("date")}
              value={serviceWhen(booking.date, booking.time, language, t)}
              isRTL={isRTL}
            />
            {duration ? <Row label={t("bookingDuration")} value={duration} isRTL={isRTL} /> : null}
            {people ? (
              <Row label={t("guests")} value={countLabel(people, "people", t)} isRTL={isRTL} />
            ) : null}
            {booking.totalAmount != null ? (
              <Row
                label={t("total")}
                value={format(
                  displayTotalSar(
                    totalShownFor({
                      kind: booking.kind,
                      totalAmount: booking.totalAmount,
                      quantity: booking.quantity,
                      unitPrice: booking.unitPrice,
                    }),
                    currency
                  )
                )}
                isRTL={isRTL}
                emphasis
              />
            ) : null}
          </View>
        ) : (
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
              // Labelled "Stay": the value carries the guests as well, and the
              // old label was the bare plural "nights" — "ليالٍ" in Arabic.
              <Row
                label={t("bookingStayLabel")}
                value={nightsLabel(booking.nights, t, booking.guests)}
                isRTL={isRTL}
              />
            ) : null}
            {booking.totalAmount != null ? (
              // The same total the quote showed, in dollars too — see
              // displayTotalSar for why it is not simply converted.
              <Row
                label={t("total")}
                value={format(
                  displayTotalSar(
                    {
                      totalAmount: booking.totalAmount,
                      nights: booking.nights,
                      pricePerNight: booking.pricePerNight,
                    },
                    currency
                  )
                )}
                isRTL={isRTL}
                emphasis
              />
            ) : null}
          </View>
        )}

        {booking.notes ? (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, isRTL && styles.textRTL]}>
              {/* The stay's label says "for the host"; a service's notes are
                  read by the provider, and by the guest who wrote them. */}
              {isService ? t("bookingNotesLabel") : t("notesOptional")}
            </Text>
            <Text style={[styles.body, isRTL && styles.textRTL]}>{booking.notes}</Text>
          </View>
        ) : null}

        {booking.declineReason ? (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, isRTL && styles.textRTL]}>
              {isService ? t("declineReasonProvider") : t("declineReason")}
            </Text>
            <Text style={[styles.body, isRTL && styles.textRTL]}>{booking.declineReason}</Text>
          </View>
        ) : null}

        {booking.status === "pending" && (!isService || isGuest) ? (
          <Text style={[styles.pendingNote, isRTL && styles.textRTL]}>
            {isService ? t("servicePendingNote") : t("bookingPendingNote")}
          </Text>
        ) : null}

        {/* The stay is over and this guest has not rated it yet. `viewerRole`
            keeps it off a host's or an admin's view of the same booking —
            neither of them stayed here. `=== null`, not falsy: `undefined`
            is the review still loading, and the card used to flash up for
            guests who had already rated the stay. */}
        {!isService && booking.status === "completed" && isGuest && myReview === null ? (
          <View style={promptStyles.ratePrompt}>
            <Text style={[promptStyles.ratePromptTitle, isRTL && styles.textRTL]}>
              {t("rateYourStay")}
            </Text>
            <Text style={[promptStyles.ratePromptBody, isRTL && styles.textRTL]}>
              {t("rateYourStayBody")}
            </Text>
            <Pressable
              style={({ pressed }) => [
                promptStyles.ratePromptButton,
                isRTL && promptStyles.alignEnd,
                pressed && styles.pressed,
              ]}
              onPress={() => setReviewOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t("rateThisPlace")}
            >
              <Text style={promptStyles.ratePromptButtonText}>{t("rateThisPlace")}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* The same for a service, once the provider marked it completed or
            the morning job did. Only while the service still exists — a
            review of a deleted one is refused — and only until this guest
            has rated it, from this booking or an earlier one of the same
            service (a second review is refused too). */}
        {isService &&
        service &&
        booking.status === "completed" &&
        isGuest &&
        myServiceReview === null ? (
          <View style={promptStyles.ratePrompt}>
            <Text style={[promptStyles.ratePromptTitle, isRTL && styles.textRTL]}>
              {t("howWasIt")}
            </Text>
            <Text style={[promptStyles.ratePromptBody, isRTL && styles.textRTL]}>
              {t("rateYourStayBody")}
            </Text>
            <Pressable
              style={({ pressed }) => [
                promptStyles.ratePromptButton,
                isRTL && promptStyles.alignEnd,
                pressed && styles.pressed,
              ]}
              onPress={() => setReviewOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t("rateServiceButton")}
            >
              <Text style={promptStyles.ratePromptButtonText}>{t("rateServiceButton")}</Text>
            </Pressable>
          </View>
        ) : null}

        {providerActions === "decide" ? (
          <View style={[styles.providerActions, isRTL && styles.rowRTL]}>
            <HostActionButton
              label={t("declineBooking")}
              tone="secondary"
              busy={busy === "decline"}
              disabled={busy !== null}
              onPress={() => onProviderAction("decline")}
            />
            <HostActionButton
              label={t("confirmBooking")}
              tone="primary"
              busy={busy === "confirm"}
              disabled={busy !== null}
              onPress={() => onProviderAction("confirm")}
            />
          </View>
        ) : null}

        {providerActions === "close" ? (
          <View style={[styles.providerActions, isRTL && styles.rowRTL]}>
            <HostActionButton
              label={t("markNoShow")}
              tone="secondary"
              busy={busy === "noShow"}
              disabled={busy !== null}
              onPress={() => onProviderAction("noShow")}
            />
            <HostActionButton
              label={t("markServiceCompleted")}
              tone="primary"
              busy={busy === "complete"}
              disabled={busy !== null}
              onPress={() => onProviderAction("complete")}
            />
          </View>
        ) : null}

        {canCancel ? (
          <Pressable
            onPress={handleCancel}
            disabled={cancelling}
            style={({ pressed }) => [
              styles.cancelButton,
              cancelling && styles.cancelButtonDisabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("cancelBooking")}
            accessibilityState={{ disabled: cancelling, busy: cancelling }}
          >
            {/* A spinner while the cancellation is on its way: the button
                used to just dim, which read as disabled, not as working. */}
            {cancelling ? (
              <ActivityIndicator color={colors.signOut} />
            ) : (
              <Text style={styles.cancelButtonText}>{t("cancelBooking")}</Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>

      {/* Carries the booking id, which is the whole point: the server checks
          the stay (or the service) really was this guest's, and completed,
          and only then marks the review verified. Nothing here claims it.
          One target each: the place of a stay, the service of a service
          booking. `existing` lets the sheet edit rather than add, should the
          guest's review of this service land while the sheet is open. */}
      <ReviewSheet
        visible={reviewOpen}
        listingId={isService ? undefined : booking.listingId}
        serviceId={isService ? service?._id : undefined}
        bookingId={booking._id}
        existing={isService ? (myServiceReview ?? null) : undefined}
        onClose={() => setReviewOpen(false)}
      />

      {/* A provider turning a request down says why, as from the inbox. */}
      <DeclineReasonSheet
        visible={declineOpen}
        onClose={() => setDeclineOpen(false)}
        onSubmit={async (reason) => {
          const bookingId = booking._id;
          const declined = await act("decline", () =>
            declineBooking({ bookingId, reason: reason || undefined })
          );
          // Closed only once the decline has gone through, so a failure
          // keeps the reason the provider wrote.
          if (declined) setDeclineOpen(false);
          return declined;
        }}
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
    // 44pt tall; the padding alone made them 38.
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.mint,
  },
  pressed: {
    opacity: 0.7,
  },
  actionText: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.primary.deep,
  },
  // Who to reach about a service booking: the provider for the guest, the
  // guest for the provider. Under the service, divided by space, not a card.
  contactBlock: {
    marginTop: 10,
    gap: 4,
  },
  contactName: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.ink,
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
  // The provider's pair of buttons, as on their inbox card.
  providerActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
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
