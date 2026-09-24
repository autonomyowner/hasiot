import { appAlert } from "@/stores/dialogStore";
import { AppDialogHost } from "@/components/ui/AppDialog";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Linking,
  Platform,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/backend";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import { useConvexUser } from "@/hooks/useConvexUser";
import { Button } from "@/components/ui/Button";
import { ReportSheet } from "@/components/ReportSheet";
import { BookingSheet } from "@/components/booking/BookingSheet";
import { VerifyPhoneSheet } from "@/components/auth/VerifyPhoneSheet";
import { RatingSummary, ReviewCard, ReviewSheet } from "@/components/review";
import { resolveAmenity } from "@/constants/amenities";
import { telUrl } from "@/lib/bookingDisplay";
import { weekdayLabelKey } from "@/lib/dates";
import type { ListingDetails } from "@/types";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * What a card hands over when it is tapped.
 *
 * Deliberately flat and already localised: the three card types describe very
 * different things (a nightly rate, a cuisine, an event date) and normalising
 * them at the call site keeps this component from growing a branch per type.
 */
export interface DetailItem {
  id: string;
  title: string;
  /** City, cuisine, or venue — whatever sits under the name on the card. */
  subtitle?: string;
  /** Localised category label, shown as a chip. */
  badge?: string;
  badgeColor?: string;
  rating?: number;
  /** Fully formed, e.g. "SAR 400 per night" or "12 Mar, 19:00". */
  priceLine?: string;
  images: string[];
  description?: string;
  amenities?: string[];
  details?: ListingDetails;
  ownerId?: string | null;
  /**
   * Shows the price + Book bar pinned to the bottom of the sheet. Set by the
   * lodging mappers only — a restaurant or an event has a priceLine too, but
   * neither is something you book a night in.
   */
  bookable?: boolean;
  /** Ceiling for the guest stepper in the booking sheet. */
  maxGuests?: number;
}

interface ListingDetailSheetProps {
  item: DetailItem | null;
  onClose: () => void;
}

type ReportTarget = {
  type: "listing" | "review";
  id: string;
  /** Whoever posted it, so the sheet can offer to block them. Listings only. */
  ownerId: Id<"users"> | null;
};

const IMAGE_HEIGHT = 380;
// Roughly the bar's own height: 14 top padding + the two-line price block +
// 16 minimum bottom padding. Used to pad the scroll so the last row of content
// can still be read from under it.
const BOOK_BAR_HEIGHT = 84;
// The body sheet pulls up over the hero by this much.
const SHEET_OVERLAP = 28;
// The body's side padding; the thumbnail rail is sized to what it leaves.
const BODY_PADDING = 24;
const MAX_THUMBS = 6;
const THUMB_SIZE = 52;
const THUMB_GAP = 8;

export function ListingDetailSheet({ item, onClose }: ListingDetailSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [imageIndex, setImageIndex] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  // What the one report sheet is about: this listing, or one of its reviews.
  // Each review card used to carry a report sheet of its own.
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  // A number verified on the way to booking. The booking sheet opens once the
  // verify sheet has gone, not when it is told to go — see handleVerified.
  const [bookAfterVerify, setBookAfterVerify] = useState(false);
  // Book or Rate pressed while the account was still loading — carried out
  // once it has (see handleBook).
  const [whenReady, setWhenReady] = useState<"book" | "rate" | null>(null);
  const galleryRef = React.useRef<ScrollView>(null);
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const { user, isUserLoading } = useConvexUser();

  // The listing the page draws. `item` goes null the moment the sheet is told
  // to close, but iOS goes on drawing the page for the whole of its slide off
  // the screen — and a page drawn from `item` went blank first and slid away
  // empty. So the page draws the last listing it was given, until iOS reports
  // the dismissal (`handleDismiss`). Android takes a Modal's content down the
  // moment it is hidden, so there is nothing to keep there.
  const [shown, setShown] = useState<DetailItem | null>(item);
  if (item && item !== shown) setShown(item);
  if (!item && shown && Platform.OS !== "ios") setShown(null);

  // The flags above belong to one opening of the sheet. Closed, or moved on to
  // another listing, none of them may carry over: a flag still set from last
  // time would present its sheet the moment this one opened again.
  const itemId = item?.id ?? null;
  const [openedId, setOpenedId] = useState(itemId);
  if (itemId !== openedId) {
    setOpenedId(itemId);
    setReportOpen(false);
    setReportTarget(null);
    setBookingOpen(false);
    setVerifyOpen(false);
    setReviewOpen(false);
    setBookAfterVerify(false);
    setWhenReady(null);
    // The photo counter lives out here, so it used to carry over: a listing
    // opened on its first photo with the third dot lit. Reset on the way in
    // only — reset on the way out, the dots jumped while the page, still on
    // its third photo, slid away.
    if (itemId !== null) setImageIndex(0);
  }

  // Three reads, all skipped until there is a listing to read them for — and
  // read for the listing on the page, so a closing page keeps its reviews
  // rather than emptying as it leaves. The summary and the first few reviews
  // are public; `getMine` returns null for a visitor, which is what makes the
  // button say "rate" rather than "edit".
  const listingId = shown ? (shown.id as Id<"listings">) : null;
  const summary = useQuery(
    api.reviews.queries.getSummary,
    listingId ? { listingId } : "skip"
  );
  const reviews = useQuery(
    api.reviews.queries.listForListing,
    listingId ? { listingId, limit: 3 } : "skip"
  );
  const myReview = useQuery(
    api.reviews.queries.getMine,
    listingId ? { listingId } : "skip"
  );

  // A press that waited for the account, carried out now that it is known.
  // Adjusted during render, like the resets above, so the sheet it opens
  // comes up on the frame the spinner stops. Signed out after all, the press
  // is simply dropped and the next tap goes to sign-in the ordinary way:
  // navigating is a side effect, which has no place in render.
  if (whenReady && !isUserLoading) {
    setWhenReady(null);
    if (isAuthenticated) {
      if (whenReady === "rate") setReviewOpen(true);
      else if (user?.phoneVerified) setBookingOpen(true);
      else setVerifyOpen(true);
    }
  }

  // Three gates, in order of what the guest can do about them. A visitor is
  // sent to sign in; a signed-in guest with no verified number is asked for
  // one, because the host has to be able to phone them; everyone else books.
  //
  // None of them can be answered while the account is still loading, and
  // guessing got it wrong both ways: `user` is null until it arrives, so a
  // verified guest was asked to verify again, and a signed-in guest whose
  // session was still being restored was sent to the sign-in screen. A press
  // made then waits, with the button showing it, and goes through once the
  // account is known.
  const handleBook = () => {
    if (isUserLoading) {
      setWhenReady("book");
      return;
    }
    if (!isAuthenticated) {
      onClose();
      router.push("/auth");
      return;
    }
    if (!user?.phoneVerified) {
      // Open the sheet rather than routing: this guest is already signed in,
      // so sending them to /auth would show a login form they are past, with
      // no way to reach the thing actually being asked for.
      setVerifyOpen(true);
      return;
    }
    setBookingOpen(true);
  };

  const handleRate = () => {
    if (isUserLoading) {
      setWhenReady("rate");
      return;
    }
    if (!isAuthenticated) {
      onClose();
      router.push("/auth");
      return;
    }
    setReviewOpen(true);
  };

  // Straight on to booking once the number is verified — the guest asked to
  // book, and the verification was only ever in the way. But not on this
  // tick: the verify sheet is only now starting to leave, and iOS will not
  // present another sheet until it has gone. So remember, and open the booking
  // sheet from the verify sheet's `onDismissed`.
  const handleVerified = () => {
    setBookAfterVerify(true);
    setVerifyOpen(false);
  };

  const handleVerifyDismissed = () => {
    if (!bookAfterVerify) return;
    setBookAfterVerify(false);
    setBookingOpen(true);
  };

  // "View my bookings" on the booking sheet's success screen. The booking
  // sheet calls this only once it has left the screen: closing it and this
  // sheet on the same tick asks this sheet's view controller to dismiss while
  // it still has the booking sheet up, and iOS then takes the booking sheet
  // down instead of this one — which stayed standing over /bookings.
  const viewBookings = () => {
    onClose();
    router.push("/bookings");
  };

  const reportListing = () => {
    if (!shown) return;
    setReportTarget({
      type: "listing",
      id: shown.id,
      ownerId: shown.ownerId ? (shown.ownerId as Id<"users">) : null,
    });
    setReportOpen(true);
  };

  // Stable, so the memoised review cards are not re-rendered for it.
  const reportReview = useCallback((reviewId: string) => {
    setReportTarget({ type: "review", id: reviewId, ownerId: null });
    setReportOpen(true);
  }, []);

  const scrollGalleryTo = (index: number) => {
    galleryRef.current?.scrollTo({ x: index * width, animated: true });
    setImageIndex(index);
  };

  // iOS only: the page has finished sliding away. Let go of the listing it was
  // showing — its three subscriptions with it — unless another listing has
  // been opened since. (After a swipe-dismiss iOS may never report back; the
  // page is then simply kept until the next listing replaces it.)
  const handleDismiss = () => {
    if (!item) setShown(null);
  };

  const images = shown?.images?.length ? shown.images : [];
  const detail = shown?.details;

  // Straight to `openURL`, with no `canOpenURL` asked first. That check is
  // answered from what the app declares, not from what the phone can do: on
  // Android 11+ it is false for any scheme missing from the manifest's
  // <queries> — tel:, geo: and mailto: all are — and on iOS for any scheme
  // missing from LSApplicationQueriesSchemes. So Call, Directions and Email
  // told phones with a dialer, maps and mail that they could not. `openURL`
  // rejects when nothing can take the link, which is the answer that matters.
  const openUrl = async (url: string, failureKey: "detailCallFailed" | "detailLinkFailed") => {
    try {
      await Linking.openURL(url);
    } catch {
      appAlert(t("error"), t(failureKey));
    }
  };

  const handleCall = () => {
    if (!detail?.phone) return;
    openUrl(telUrl(detail.phone), "detailCallFailed");
  };

  const handleWebsite = () => {
    if (!detail?.website) return;
    const url = /^https?:\/\//i.test(detail.website)
      ? detail.website
      : `https://${detail.website}`;
    openUrl(url, "detailLinkFailed");
  };

  const handleEmail = () => {
    if (!detail?.email) return;
    openUrl(`mailto:${detail.email}`, "detailLinkFailed");
  };

  const handleDirections = () => {
    const { coordinates, address } = detail ?? {};
    // Coordinates when we have them, the address as a search term otherwise.
    const destination = coordinates
      ? `${coordinates.lat},${coordinates.lng}`
      : address
        ? encodeURIComponent(address)
        : null;
    if (!destination) return;

    // Apple Maps is guaranteed present on iOS; `geo:` is the Android intent
    // that lets the user pick whichever maps app they actually use.
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${destination}`
        : `geo:0,0?q=${destination}`;
    openUrl(url, "detailLinkFailed");
  };

  // Follows the finger. It used to run on momentum end, so the dots moved only
  // once a swipe had settled, a beat behind the photo above them.
  const handleImageScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const raw = Math.round(e.nativeEvent.contentOffset.x / width);
    // Clamped: the bounce at either end reports offsets past the photos.
    const next = Math.min(Math.max(raw, 0), Math.max(images.length - 1, 0));
    setImageIndex((current) => (current === next ? current : next));
  };

  // Sized to fit the body's width, never grown: six 52pt thumbnails and their
  // gaps are 352pt, and the body is 327pt wide on a 375pt phone — the sixth
  // ran off the edge of the page.
  const thumbCount = Math.min(images.length, MAX_THUMBS);
  const thumbSize =
    thumbCount > 0
      ? Math.min(
          THUMB_SIZE,
          Math.floor((width - BODY_PADDING * 2 - THUMB_GAP * (thumbCount - 1)) / thumbCount)
        )
      : THUMB_SIZE;

  // The bar needs something to say on both halves; a price with no CTA, or a
  // CTA with no price, is not worth pinning to the bottom of the screen.
  const showBookBar = !!(shown?.bookable && shown.priceLine);

  const hasContact = !!(
    detail?.phone ||
    detail?.website ||
    detail?.email ||
    detail?.coordinates ||
    detail?.address
  );

  return (
    <Modal
      visible={!!item}
      animationType="slide"
      // pageSheet gives iOS its native card presentation; Android ignores it
      // and presents full screen.
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      // The swipe down users expect of a page sheet. Without this prop RN 0.86
      // presents every Modal with `modalInPresentation` on, so the sheet
      // resisted the swipe and sprang back — iOS reported it as an attempt,
      // `onRequestClose` closed the sheet anyway, and it went a beat later by
      // itself. Now iOS dismisses it under the finger and reports that through
      // `onRequestClose`, which brings `item` — and so `visible` — back in
      // line. RN marks the Modal unpresented as `visible` drops, so the next
      // listing presents normally; the page kept for the exit (`shown`) is let
      // go by `handleDismiss`, or replaced by the next listing if iOS never
      // reports a dismissal it did not start.
      allowSwipeDismissal
      onRequestClose={onClose}
      onDismiss={handleDismiss}
    >
      <View style={styles.container}>
        {shown && (
          // Keyed on the listing, so another listing opens at the top of the
          // page and on its own first photo rather than wherever the last one
          // was left.
          <React.Fragment key={shown.id}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom:
                  insets.bottom + 32 + (showBookBar ? BOOK_BAR_HEIGHT : 0),
              }}
            >
              {/* Gallery */}
              <View style={styles.gallery}>
                {images.length > 0 ? (
                  // One direction for the photos, the dots and the thumbnails.
                  // Only the thumbnails used to mirror in Arabic, so the one on
                  // the right opened the photo on the left. Now all three run
                  // from the right, like the app's other rails: the gallery is
                  // flipped and each photo flipped back, which mirrors the
                  // order, the starting edge and the swipe while the offsets
                  // stay logical — the page index and scrollTo still count
                  // from the first photo. (FlatList's `inverted` does the same.)
                  <ScrollView
                    ref={galleryRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={handleImageScroll}
                    scrollEventThrottle={16}
                    style={isRTL ? styles.mirrored : undefined}
                  >
                    {images.map((uri, i) => (
                      <Image
                        key={`${uri}-${i}`}
                        source={{ uri }}
                        // Sand while it loads, as on the cards, rather than
                        // the page's cream showing through an empty frame.
                        style={[styles.galleryImage, { width }, isRTL && styles.mirrored]}
                        contentFit="cover"
                        transition={200}
                        accessibilityLabel={t("detailImageCount")
                          .replace("{current}", String(i + 1))
                          .replace("{total}", String(images.length))}
                      />
                    ))}
                  </ScrollView>
                ) : (
                  // Same warm sand the cards fall back to, so an imageless
                  // listing reads as intentional rather than as a failed load.
                  <View style={[styles.galleryEmpty, { width, height: IMAGE_HEIGHT }]}>
                    <Feather name="image" size={32} color={colors.onSurface.muted} />
                  </View>
                )}

                {/* Legibility scrim under the sheet's rounded top edge. */}
                <LinearGradient
                  colors={["transparent", "rgba(31,29,23,0.35)"]}
                  style={styles.galleryScrim}
                  pointerEvents="none"
                />

                {images.length > 1 && (
                  <View style={[styles.dots, isRTL && styles.rowRTL]}>
                    {images.map((_, i) => (
                      <View
                        key={i}
                        style={[styles.dot, i === imageIndex && styles.dotActive]}
                      />
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.body}>
                {/* Thumbnail rail — jumps the gallery to the tapped image. */}
                {images.length > 1 && (
                  <View style={[styles.thumbRail, isRTL && styles.rowRTL]}>
                    {images.slice(0, MAX_THUMBS).map((uri, i) => (
                      <Pressable
                        key={`thumb-${uri}-${i}`}
                        onPress={() => scrollGalleryTo(i)}
                        style={({ pressed }) => pressed && styles.pressed}
                        accessibilityRole="button"
                        accessibilityState={{ selected: i === imageIndex }}
                        accessibilityLabel={t("detailImageCount")
                          .replace("{current}", String(i + 1))
                          .replace("{total}", String(images.length))}
                      >
                        <Image
                          source={{ uri }}
                          style={[
                            styles.thumb,
                            { width: thumbSize, height: thumbSize },
                            i === imageIndex && styles.thumbActive,
                          ]}
                          contentFit="cover"
                          transition={200}
                        />
                      </Pressable>
                    ))}
                  </View>
                )}

                {/* Title block */}
                <View style={[styles.titleRow, isRTL && styles.rowRTL]}>
                  {shown.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{shown.badge}</Text>
                    </View>
                  )}
                  {typeof shown.rating === "number" && shown.rating > 0 && (
                    <View style={[styles.ratingRow, isRTL && styles.rowRTL]}>
                      <Feather name="star" size={13} color={colors.warm} />
                      <Text style={styles.ratingText}>{shown.rating.toFixed(1)}</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.title, isRTL && styles.textRTL]}>
                  {shown.title}
                </Text>

                {shown.subtitle ? (
                  <Text style={[styles.subtitle, isRTL && styles.textRTL]}>
                    {shown.subtitle}
                  </Text>
                ) : null}

                {shown.priceLine ? (
                  <Text style={[styles.price, isRTL && styles.textRTL]}>
                    {shown.priceLine}
                  </Text>
                ) : null}

                {/* Actions */}
                {hasContact && (
                  <View style={[styles.actions, isRTL && styles.rowRTL]}>
                    {detail?.phone && (
                      <ActionButton
                        icon="phone"
                        label={t("detailCall")}
                        onPress={handleCall}
                        primary
                      />
                    )}
                    {(detail?.coordinates || detail?.address) && (
                      <ActionButton
                        icon="navigation"
                        label={t("detailDirections")}
                        onPress={handleDirections}
                      />
                    )}
                    {detail?.website && (
                      <ActionButton
                        icon="globe"
                        label={t("detailWebsite")}
                        onPress={handleWebsite}
                      />
                    )}
                  </View>
                )}

                {/* About */}
                <Section title={t("detailAbout")} isRTL={isRTL}>
                  <Text style={[styles.paragraph, isRTL && styles.textRTL]}>
                    {shown.description?.trim() || t("detailNoDescription")}
                  </Text>
                </Section>

                {/* Amenities */}
                {shown.amenities && shown.amenities.length > 0 && (
                  <Section title={t("detailAmenities")} isRTL={isRTL}>
                    <View style={[styles.chips, isRTL && styles.rowRTL]}>
                      {shown.amenities.map((amenity) => {
                        // The stored value is a key on anything posted through
                        // the toggles, and free text on older listings.
                        const { icon, label } = resolveAmenity(amenity, language);
                        return (
                          <View
                            key={amenity}
                            style={[styles.chip, isRTL && styles.rowRTL]}
                          >
                            <Feather
                              name={icon}
                              size={13}
                              color={colors.onSurface.variant}
                            />
                            <Text style={styles.chipText}>{label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </Section>
                )}

                {/* Hours */}
                {detail?.workingHours && detail.workingHours.length > 0 && (
                  <Section title={t("detailHours")} isRTL={isRTL}>
                    {detail.workingHours.map((h) => {
                      // The stored day is a key ("sunday"); show its name,
                      // or the value itself if it is not one.
                      const dayKey = weekdayLabelKey(h.day);
                      return (
                        <View
                          key={h.day}
                          style={[styles.hoursRow, isRTL && styles.rowRTL]}
                        >
                          <Text style={styles.hoursDay}>{dayKey ? t(dayKey) : h.day}</Text>
                          <Text style={styles.hoursTime}>
                            {h.isClosed ? t("detailClosed") : `${h.open} – ${h.close}`}
                          </Text>
                        </View>
                      );
                    })}
                  </Section>
                )}

                {/* Contact detail */}
                {(detail?.address || detail?.email) && (
                  <Section title={t("detailContact")} isRTL={isRTL}>
                    {detail.address ? (
                      <InfoRow
                        icon="map-pin"
                        value={detail.address}
                        isRTL={isRTL}
                      />
                    ) : null}
                    {detail.email ? (
                      <InfoRow
                        icon="mail"
                        value={detail.email}
                        isRTL={isRTL}
                        onPress={handleEmail}
                      />
                    ) : null}
                  </Section>
                )}

                {/* Reviews. The summary renders its own "no reviews yet" when
                    nobody has rated — there is deliberately no zero to fall
                    back on, so an unrated place shows no star at all. */}
                <Section title={t("reviewsTitle")} isRTL={isRTL}>
                  {summary && <RatingSummary value={summary} />}

                  {/* Signed out, this used to open the sheet and fail on the
                      server — the guest wrote a review, pressed save and was
                      told "Server Error". Same gate as Book. */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.rateButton,
                      isRTL && styles.rowRTL,
                      pressed && styles.pressed,
                    ]}
                    onPress={handleRate}
                    disabled={whenReady === "rate"}
                    accessibilityRole="button"
                    accessibilityLabel={myReview ? t("editYourReview") : t("rateThisPlace")}
                    accessibilityState={{ busy: whenReady === "rate" }}
                  >
                    {whenReady === "rate" ? (
                      <ActivityIndicator color={colors.ink} />
                    ) : (
                      <>
                        <Feather name="star" size={15} color={colors.ink} />
                        <Text style={styles.rateButtonText}>
                          {myReview ? t("editYourReview") : t("rateThisPlace")}
                        </Text>
                      </>
                    )}
                  </Pressable>

                  {reviews?.map((review) => (
                    <ReviewCard key={review._id} review={review} onReport={reportReview} />
                  ))}

                  {!!summary && summary.count > 3 && (
                    <Pressable
                      onPress={() => {
                        // Close first: this sheet is a native modal, and a
                        // pushed route underneath it would be hidden by it.
                        onClose();
                        router.push(`/reviews/${shown.id}`);
                      }}
                      style={({ pressed }) => pressed && styles.pressed}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.seeAll, isRTL && styles.textRTL]}>
                        {t("reviewsSeeAll")}
                      </Text>
                    </Pressable>
                  )}
                </Section>

                {/* Report */}
                <Pressable
                  onPress={reportListing}
                  style={({ pressed }) => [
                    styles.reportRow,
                    isRTL && styles.rowRTL,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("reportTitle")}
                >
                  <Feather name="flag" size={14} color={colors.onSurface.muted} />
                  <Text style={styles.reportText}>{t("reportTitle")}</Text>
                </Pressable>
              </View>
            </ScrollView>

            {/* Price + Book, pinned. Sits above the scroll so the rate stays
                on screen while the guest reads down the page — the one number
                they are deciding on should never be scrolled away. */}
            {showBookBar && (
              <View
                style={[
                  styles.bookBar,
                  { paddingBottom: insets.bottom || 16 },
                  isRTL && styles.rowRTL,
                ]}
              >
                {/* Takes the room the button leaves, so a long price is cut
                    short instead of running on under Book. */}
                <View style={[styles.bookBarPriceWrap, isRTL && styles.alignEnd]}>
                  <Text style={styles.bookBarPrice} numberOfLines={1}>
                    {shown.priceLine}
                  </Text>
                </View>
                {/* The shared Button: its spinner keeps the button's size
                    while a press waits on the account. */}
                <Button
                  title={t("detailBook")}
                  onPress={handleBook}
                  loading={whenReady === "book"}
                  style={styles.bookButton}
                  textStyle={styles.bookButtonText}
                />
              </View>
            )}

            {/* Close. Floated over the gallery rather than sitting in a header
                band, so the images run to the top edge of the sheet. */}
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                // pageSheet already insets from the top; full screen does not.
                { top: Platform.OS === "ios" ? 16 : insets.top + 12 },
                isRTL ? styles.closeButtonRTL : null,
                pressed && styles.pressed,
              ]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t("close")}
            >
              <Feather name="x" size={20} color={colors.ink} />
            </Pressable>
          </React.Fragment>
        )}
      </View>

      {/* The sheets this one opens live inside its Modal, not beside it.

          On iOS a Modal presents from the nearest view controller above it
          in the view tree. Beside this Modal, all four resolved to the
          screen's controller — which is already presenting this listing — and
          UIKit refuses a second presentation from a controller busy with one
          ("Attempt to present … which is already presenting …"). React Native
          has marked the sheet presented by then and never tries again: its
          flag stayed "open", its button stayed dead, and a stranded
          VerifyPhoneSheet's dialog host went on to swallow every later alert.
          In here they present from this sheet's own controller. A transparent
          sheet still covers the whole screen from there — the old comment
          said it would be clipped to the page sheet, which was never tested
          and is not so: ReviewCard's report sheet has always been nested like
          this and covers the screen. Android is unaffected either way; every
          Modal there is its own window.

          Two more iOS rules shape the handlers above. Nothing can be
          presented while another Modal is still dismissing, so each hand-off
          waits for the closing sheet's dismissal. And a controller asked to
          dismiss while it still has a sheet up dismisses that sheet instead of
          itself, so this sheet is never closed while one of these is open.

          Mounted only while a listing is open, so none of them — nor their
          dialog hosts — can outlive this sheet. */}
      {item && (
        <>
          <ReportSheet
            visible={reportOpen}
            onClose={() => setReportOpen(false)}
            targetType={reportTarget?.type ?? "listing"}
            targetId={reportTarget?.id ?? item.id}
            ownerId={reportTarget?.ownerId ?? null}
          />

          <BookingSheet
            visible={bookingOpen}
            item={item}
            onClose={() => setBookingOpen(false)}
            onViewBookings={viewBookings}
          />

          <ReviewSheet
            visible={reviewOpen}
            listingId={item.id}
            existing={myReview}
            onClose={() => setReviewOpen(false)}
          />

          <VerifyPhoneSheet
            visible={verifyOpen}
            onClose={() => setVerifyOpen(false)}
            onVerified={handleVerified}
            onDismissed={handleVerifyDismissed}
          />

          {/* Alerts fired while this sheet is up render above it. It mounts
              with the sheet, before any of the sheets above can be opened, so
              the host each of those brings stacks on top of this one. */}
          <AppDialogHost />
        </>
      )}
    </Modal>
  );
}

function Section({
  title,
  isRTL,
  children,
}: {
  title: string;
  isRTL: boolean;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>{title}</Text>
      {children}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  primary = false,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        primary && styles.actionButtonPrimary,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather
        name={icon}
        size={18}
        color={primary ? colors.ink : colors.primary.deep}
      />
      {/* Two lines if it needs them, never cut: a long label wraps under
          its icon rather than losing its end. */}
      <Text
        style={[styles.actionLabel, primary && styles.actionLabelPrimary]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function InfoRow({
  icon,
  value,
  isRTL,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  value: string;
  isRTL: boolean;
  onPress?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const content = (
    <View style={[styles.infoRow, isRTL && styles.rowRTL]}>
      <Feather name={icon} size={15} color={colors.onSurface.muted} />
      <Text
        style={[styles.infoText, isRTL && styles.textRTL, !!onPress && styles.infoLink]}
      >
        {value}
      </Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
      accessibilityRole="link"
      accessibilityLabel={value}
    >
      {content}
    </Pressable>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gallery: {
    position: "relative",
  },
  galleryImage: {
    height: IMAGE_HEIGHT,
    backgroundColor: colors.sand,
  },
  mirrored: {
    transform: [{ scaleX: -1 }],
  },
  pressed: {
    opacity: 0.7,
  },
  galleryEmpty: {
    backgroundColor: colors.sand,
    alignItems: "center",
    justifyContent: "center",
  },
  galleryScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },
  dots: {
    position: "absolute",
    bottom: SHEET_OVERLAP + 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  dotActive: {
    backgroundColor: "#FFFFFF",
    width: 18,
  },
  closeButton: {
    position: "absolute",
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonRTL: {
    right: undefined,
    left: 16,
  },
  // Rounded sheet pulled up over the hero — the inspiration's overlap move.
  body: {
    marginTop: -SHEET_OVERLAP,
    borderTopLeftRadius: SHEET_OVERLAP,
    borderTopRightRadius: SHEET_OVERLAP,
    backgroundColor: colors.background,
    padding: BODY_PADDING,
    gap: 4,
  },
  thumbRail: {
    flexDirection: "row",
    gap: THUMB_GAP,
    marginBottom: 16,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 14,
    backgroundColor: colors.sand,
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbActive: {
    borderColor: colors.primary.deep,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  rowRTL: {
    flexDirection: "row-reverse",
  },
  // Neutral chip — the coloured per-category badges were retired with the
  // card redesign; green stays reserved for prices and primary actions.
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.mint,
  },
  badgeText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.primary.deep,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.ink,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 28,
    lineHeight: 34,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.onSurface.muted,
    marginTop: 2,
  },
  price: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.primary.deep,
    marginTop: 8,
  },
  textRTL: {
    textAlign: "right",
    writingDirection: "rtl",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  // Icon over label, so the label has the button's whole width. Side by side
  // in a third of the row, "الموقع الإلكتروني" was cut down to its first word.
  actionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    // Comfortably past 44pt: these are the primary things to tap here.
    minHeight: 58,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface.DEFAULT,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary.DEFAULT,
    borderColor: colors.primary.DEFAULT,
  },
  actionLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.primary.deep,
    textAlign: "center",
  },
  actionLabelPrimary: {
    color: colors.ink,
  },
  section: {
    marginTop: 28,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.onSurface.muted,
  },
  paragraph: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.sand,
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink,
  },
  alignEnd: {
    alignItems: "flex-end",
  },
  bookBarPriceWrap: {
    flex: 1,
  },
  bookBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: colors.surface.DEFAULT,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  bookBarPrice: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.ink,
  },
  bookButton: {
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: colors.primary.DEFAULT,
  },
  bookButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.ink,
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  hoursDay: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
  },
  hoursTime: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.onSurface.muted,
    fontVariant: ["tabular-nums"],
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 4,
  },
  infoText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink,
  },
  infoLink: {
    color: colors.primary.deep,
  },
  rateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    // Holds its height when the label gives way to a spinner.
    minHeight: 46,
    paddingVertical: 12,
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: colors.primary.DEFAULT,
  },
  // Lime is a fill, so its label is ink: white on it is 1.4:1.
  rateButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  seeAll: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.primary.deep,
    paddingVertical: 14,
  },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    minHeight: 44,
  },
  reportText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.onSurface.muted,
  },
});
