import { appAlert } from "@/stores/dialogStore";
import React, { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/backend";
import type { Id } from "../../../convex/_generated/dataModel";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { ReportSheet } from "@/components/ReportSheet";
import { VerifyPhoneSheet } from "@/components/auth/VerifyPhoneSheet";
import { RatingSummary, ReviewCard, ReviewSheet } from "@/components/review";
import { colors, type AppFonts } from "@/constants/colors";
import { cityLabel } from "@/constants/cities";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useConvexUser } from "@/hooks/useConvexUser";
import { toServiceItem, type ServiceItem } from "@/hooks/useConvexData";
import { useCurrency } from "@/hooks/useCurrency";
import { useLanguage } from "@/hooks/useLanguage";
import { telUrl } from "@/lib/bookingDisplay";
import { formatPhoneForDisplay, ltr } from "@/lib/phone";
import { userCanBook } from "@/lib/phoneRules";
import { maybeAskForPush } from "@/lib/pushPrompt";
import {
  DEFAULT_MAX_GROUP,
  formatServicePrice,
  groupSizeLabel,
  pickLanguage,
  serviceTypeLabelKey,
} from "@/lib/serviceDisplay";
import { ServiceBookingSheet } from "./ServiceBookingSheet";
import { serviceTypeIcon } from "./ServiceCard";

interface ServiceDetailSheetProps {
  /** The service to show, as a list row hands it over; null closes the sheet. */
  service: ServiceItem | null;
  onClose: () => void;
}

type ReportTarget = {
  type: "service" | "review";
  id: string;
  /** Whoever posted it, so the report sheet can offer to block them. The service only. */
  ownerId: Id<"users"> | null;
};

// The content's side padding; the gallery is inset by the same.
const SIDE = 20;
const GALLERY_HEIGHT = 220;

/**
 * A service, for a traveller deciding whether to book it: its photos, what it
 * is and where, who offers it, the price and its unit, how many it takes, the
 * languages, the reviews, and Book — or Contact, for a service without a price
 * to book at (design D16).
 *
 * On the shared BottomSheet, and built on ListingDetailSheet's rules. The
 * sheets it opens — book, rate, report, verify a phone — are rendered inside
 * its own Modal: on iOS a Modal presents from the nearest view controller, and
 * beside this one they would all try to present from the screen's, which is
 * already presenting this sheet, and UIKit refuses silently. Each hand-off
 * ("verified, now book"; "sent, now alert") waits for the closing sheet's
 * `onDismissed`, since nothing can be presented while a Modal is leaving. And
 * this sheet is never closed while one of those is up: it closes only from its
 * own buttons, which the sheet above it covers.
 *
 * It opens from the list's row at once and then follows the live service
 * (`getService`), which also names the provider. If the service goes while the
 * sheet is open — suspended, deleted, its provider blocked — it says so in
 * place of Book rather than closing under the traveller's finger.
 */
export function ServiceDetailSheet({ service, onClose }: ServiceDetailSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL, language } = useLanguage();
  const { currency } = useCurrency();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const { user, isUserLoading } = useConvexUser();

  // The service the sheet draws. `service` goes null the moment the sheet is
  // told to close, while the panel is still sliding away; drawn from it, the
  // panel would empty mid-slide. So the last one is kept, and let go once the
  // sheet has gone (handleDismissed).
  const [shown, setShown] = useState<ServiceItem | null>(service);
  if (service && service !== shown) setShown(service);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  // What the one report sheet is about: this service, or one of its reviews.
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  // A number verified on the way to booking; the booking sheet opens once the
  // verify sheet has gone, not when it is told to go.
  const [bookAfterVerify, setBookAfterVerify] = useState(false);
  // Book or Rate pressed while the account was still loading, carried out
  // once it has.
  const [whenReady, setWhenReady] = useState<"book" | "rate" | null>(null);
  const [imageIndex, setImageIndex] = useState(0);

  // Those flags belong to one opening of the sheet. Closed, or moved on to
  // another service, none of them may carry over: a flag still set from last
  // time would present its sheet the moment this one opened again.
  const serviceId = service?.id ?? null;
  const [openedId, setOpenedId] = useState(serviceId);
  // Counts openings; the page is keyed on it, so each opens at the top.
  const [opening, setOpening] = useState(0);
  if (serviceId !== openedId) {
    setOpenedId(serviceId);
    setBookingOpen(false);
    setVerifyOpen(false);
    setReviewOpen(false);
    setReportOpen(false);
    setReportTarget(null);
    setBookAfterVerify(false);
    setWhenReady(null);
    if (serviceId !== null) {
      setImageIndex(0);
      setOpening((n) => n + 1);
    }
  }

  // Read for the service on the page, so a closing sheet keeps its content.
  // `getMineForService` is null for a visitor, which makes the button "rate".
  const id = shown ? (shown.id as Id<"services">) : null;
  const detail = useQuery(api.services.queries.getService, id ? { serviceId: id } : "skip");
  const summary = useQuery(
    api.reviews.queries.getServiceSummary,
    id ? { serviceId: id } : "skip"
  );
  const reviews = useQuery(
    api.reviews.queries.listForService,
    id ? { serviceId: id, limit: 3 } : "skip"
  );
  const myReview = useQuery(
    api.reviews.queries.getMineForService,
    id ? { serviceId: id } : "skip"
  );

  const live = useMemo(() => (detail ? toServiceItem(detail) : null), [detail]);
  const item = live ?? shown;
  // `null`, not `undefined` (still loading): travellers can no longer see it.
  const unavailable = detail === null;
  const providerName = detail?.provider
    ? [detail.provider.firstName, detail.provider.lastName].filter(Boolean).join(" ").trim()
    : "";
  // A provider looking at their own service: nothing here for them to book or
  // rate — the server refuses both, so neither is offered.
  const isOwner = !!user && !!item && item.ownerId === user._id;

  // A press that waited for the account, carried out now that it is known.
  // Adjusted during render, like the resets above, so the sheet it opens comes
  // up on the frame the spinner stops.
  if (whenReady && !isUserLoading && isAuthenticated) {
    setWhenReady(null);
    if (whenReady === "rate") setReviewOpen(true);
    else if (userCanBook(user)) setBookingOpen(true);
    else setVerifyOpen(true);
  }

  // What to do once this sheet is off the screen: sign in, the booking list,
  // all the reviews. A route pushed while the sheet is still up would open
  // under it, and on iOS nothing can be presented while it is leaving.
  const afterDismiss = useRef<(() => void) | null>(null);
  const leaveThen = (next: () => void) => {
    afterDismiss.current = next;
    onClose();
  };

  const handleDismissed = () => {
    // Let go of the service, and its four subscriptions with it — unless
    // another service has been opened since.
    if (!service) setShown(null);
    const next = afterDismiss.current;
    afterDismiss.current = null;
    next?.();
  };

  const goToSignIn = () => leaveThen(() => router.push("/auth"));

  // Signed out after all: the waiting press is carried out as the traveller
  // meant it, by taking them to sign in. It used to be dropped — the spinner
  // stopped and nothing happened, and only a second tap opened sign-in.
  // Leaving the sheet is a side effect, so it runs from an effect rather than
  // from render like the outcomes above. `whenReady` stays set until the
  // sheet lets go of this service (the resets above), which keeps the spinner
  // up while the sheet leaves and the effect from firing twice.
  const signInForPress = useEffectEvent(goToSignIn);
  const signInWanted = whenReady !== null && !isUserLoading && !isAuthenticated;
  useEffect(() => {
    if (signInWanted) signInForPress();
  }, [signInWanted]);

  // Three gates, in the order the traveller can do something about them: a
  // visitor signs in; an account with no verified number verifies one, since
  // the provider has to be able to call; everyone else books. None of them can
  // be answered while the account is loading, so a press then waits for it.
  const handleBook = () => {
    if (isUserLoading) {
      setWhenReady("book");
      return;
    }
    if (!isAuthenticated) {
      goToSignIn();
      return;
    }
    // The server's `canBook`: while SMS cannot reach Saudi numbers an
    // unconfirmed Saudi mobile is enough (lib/phoneRules.ts userCanBook).
    if (!userCanBook(user)) {
      // The sheet, not the sign-in screen: this traveller is already signed
      // in, and the sign-in form is past them.
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
      goToSignIn();
      return;
    }
    setReviewOpen(true);
  };

  const handleVerified = () => {
    setBookAfterVerify(true);
    setVerifyOpen(false);
  };

  const handleVerifyDismissed = () => {
    if (!bookAfterVerify) return;
    setBookAfterVerify(false);
    setBookingOpen(true);
  };

  // "View my bookings" on the "Request sent" alert, which the booking sheet
  // raises only once it has gone. This sheet leaves too, and only then is
  // /bookings pushed — and notifications offered, now nothing is on screen.
  const viewBookings = () =>
    leaveThen(() => {
      router.push("/bookings");
      maybeAskForPush("guest");
    });

  const seeAllReviews = () => {
    if (!item) return;
    const target = item.id;
    leaveThen(() => router.push(`/reviews/service/${target}`));
  };

  const reportService = () => {
    if (!item) return;
    setReportTarget({ type: "service", id: item.id, ownerId: item.ownerId as Id<"users"> });
    setReportOpen(true);
  };

  // Stable, so the memoised review cards are not re-rendered for it.
  const reportReview = useCallback((reviewId: string) => {
    setReportTarget({ type: "review", id: reviewId, ownerId: null });
    setReportOpen(true);
  }, []);

  // Straight to openURL, with no canOpenURL first — that is answered from
  // what the app declares, and says no to `tel:` on Android 11+ (see
  // ListingDetailSheet). openURL rejects when nothing can take the link.
  const openUrl = async (url: string, failureKey: "detailCallFailed" | "detailLinkFailed") => {
    try {
      await Linking.openURL(url);
    } catch {
      appAlert(t("error"), t(failureKey));
    }
  };

  const handleContact = () => {
    if (!item) return;
    const { contactPhone: phone, contactEmail: email } = item;
    if (phone && email) {
      // Both: the traveller chooses, seeing what each will open.
      appAlert(t("serviceContactTitle"), `${ltr(formatPhoneForDisplay(phone))}\n${email}`, [
        { text: t("detailCall"), onPress: () => void openUrl(telUrl(phone), "detailCallFailed") },
        {
          text: t("detailEmail"),
          onPress: () => void openUrl(`mailto:${email}`, "detailLinkFailed"),
        },
        { text: t("cancel"), style: "cancel" },
      ]);
      return;
    }
    if (phone) void openUrl(telUrl(phone), "detailCallFailed");
    else if (email) void openUrl(`mailto:${email}`, "detailLinkFailed");
  };

  const images = item?.images ?? [];
  const galleryWidth = width - SIDE * 2;

  // Follows the finger, clamped against the bounce at either end.
  const handleImageScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const raw = Math.round(e.nativeEvent.contentOffset.x / galleryWidth);
    const next = Math.min(Math.max(raw, 0), Math.max(images.length - 1, 0));
    setImageIndex((current) => (current === next ? current : next));
  };

  const alignText = isRTL && styles.textRTL;

  let footer: React.ReactNode = null;
  if (item) {
    const priceLine = formatServicePrice(item, language, currency);
    let action: React.ReactNode = null;
    if (unavailable) {
      action = (
        <Text style={[styles.footerNote, alignText]}>{t("errorServiceUnavailable")}</Text>
      );
    } else if (isOwner) {
      action = (
        <View style={styles.ownerPill}>
          <Text style={styles.ownerPillText}>{t("serviceYours")}</Text>
        </View>
      );
    } else if (item.bookable) {
      // The shared Button: its spinner keeps the size while a press waits on
      // the account.
      action = (
        <Button
          title={t("detailBook")}
          onPress={handleBook}
          loading={whenReady === "book"}
          style={styles.footerButton}
          textStyle={styles.footerButtonText}
        />
      );
    } else if (item.contactPhone || item.contactEmail) {
      action = (
        <Button
          title={t("serviceContact")}
          onPress={handleContact}
          style={styles.footerButton}
          textStyle={styles.footerButtonText}
        />
      );
    }
    if (action) {
      footer = (
        // Pinned under the page, so the price and the way to act on it stay
        // on screen while the traveller reads down it.
        <View style={[styles.footer, isRTL && styles.rowRTL]}>
          {!unavailable && (
            <View style={[styles.footerPriceWrap, isRTL && styles.alignEnd]}>
              <Text style={styles.footerPrice} numberOfLines={1}>
                {priceLine}
              </Text>
            </View>
          )}
          {action}
        </View>
      );
    }
  }

  return (
    <BottomSheet
      visible={!!service}
      onClose={onClose}
      onDismissed={handleDismissed}
      style={styles.sheetBody}
      maxHeightRatio={0.92}
    >
      {item ? (
        // Keyed on the opening: every service opens at the top of the page
        // and on its first photo, the same service reopened included.
        <React.Fragment key={opening}>
          <View style={styles.frame}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.gallery}>
                {images.length > 0 ? (
                  // One direction for the photos and the dots: in Arabic the
                  // row is flipped and each photo flipped back, which mirrors
                  // the order and the swipe while the offsets stay logical.
                  <ScrollView
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
                        style={[
                          styles.galleryImage,
                          { width: galleryWidth },
                          isRTL && styles.mirrored,
                        ]}
                        contentFit="cover"
                        transition={200}
                        accessibilityLabel={t("detailImageCount")
                          .replace("{current}", String(i + 1))
                          .replace("{total}", String(images.length))}
                      />
                    ))}
                  </ScrollView>
                ) : (
                  // The warm sand the cards fall back to, with the type's
                  // glyph, so no photo reads as intended rather than failed.
                  <View style={styles.galleryEmpty}>
                    <Feather
                      name={serviceTypeIcon(item.serviceType)}
                      size={36}
                      color={colors.onSurface.muted}
                    />
                  </View>
                )}

                {images.length > 1 && (
                  <View style={[styles.dots, isRTL && styles.rowRTL]} pointerEvents="none">
                    {images.map((_, i) => (
                      <View key={i} style={[styles.dot, i === imageIndex && styles.dotActive]} />
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.content}>
                <View style={[styles.badgeRow, isRTL && styles.rowRTL]}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{t(serviceTypeLabelKey(item.serviceType))}</Text>
                  </View>
                  {item.rating > 0 && (
                    <View style={[styles.ratingRow, isRTL && styles.rowRTL]}>
                      <Feather name="star" size={13} color={colors.warm} />
                      <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.title, alignText]}>
                  {pickLanguage(item.title, item.titleAr, language)}
                </Text>

                {item.city ? (
                  <Text style={[styles.subtitle, alignText]}>{cityLabel(item.city, language)}</Text>
                ) : null}

                {providerName ? (
                  <Text style={[styles.offeredBy, alignText]}>
                    {t("serviceOfferedBy").replace("{name}", providerName)}
                  </Text>
                ) : null}

                <Text style={[styles.price, !item.bookable && styles.priceQuiet, alignText]}>
                  {formatServicePrice(item, language, currency)}
                </Text>

                <View style={styles.facts}>
                  <Fact
                    icon="users"
                    value={groupSizeLabel(item.maxGroupSize ?? DEFAULT_MAX_GROUP, language)}
                    isRTL={isRTL}
                  />
                  {item.languages.length > 0 && (
                    <Fact
                      icon="globe"
                      value={`${t("languages")}: ${item.languages.join(isRTL ? "، " : ", ")}`}
                      isRTL={isRTL}
                    />
                  )}
                  {pickLanguage(item.availability, item.availabilityAr, language) ? (
                    <Fact
                      icon="clock"
                      value={pickLanguage(item.availability, item.availabilityAr, language)}
                      isRTL={isRTL}
                    />
                  ) : null}
                </View>

                {pickLanguage(item.description, item.descriptionAr, language) ? (
                  <Section title={t("detailAbout")} isRTL={isRTL}>
                    <Text style={[styles.paragraph, alignText]}>
                      {pickLanguage(item.description, item.descriptionAr, language)}
                    </Text>
                  </Section>
                ) : null}

                {/* The summary says "no reviews yet" by itself when nobody has
                    rated — there is no zero to fall back on, so an unrated
                    service shows no star at all. */}
                <Section title={t("reviewsTitle")} isRTL={isRTL}>
                  {summary && <RatingSummary value={summary} emptyHint={t("reviewsEmptyHint")} />}

                  {!isOwner && !unavailable && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.rateButton,
                        isRTL && styles.rowRTL,
                        pressed && styles.pressed,
                      ]}
                      onPress={handleRate}
                      disabled={whenReady === "rate"}
                      accessibilityRole="button"
                      accessibilityLabel={myReview ? t("editYourReview") : t("rateThisService")}
                      accessibilityState={{ busy: whenReady === "rate" }}
                    >
                      {whenReady === "rate" ? (
                        <ActivityIndicator color={colors.ink} />
                      ) : (
                        <>
                          <Feather name="star" size={15} color={colors.ink} />
                          <Text style={styles.rateButtonText}>
                            {myReview ? t("editYourReview") : t("rateThisService")}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}

                  {reviews?.map((review) => (
                    <ReviewCard key={review._id} review={review} onReport={reportReview} />
                  ))}

                  {!!summary && summary.count > 3 && (
                    <Pressable
                      onPress={seeAllReviews}
                      style={({ pressed }) => pressed && styles.pressed}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.seeAll, alignText]}>{t("reviewsSeeAll")}</Text>
                    </Pressable>
                  )}
                </Section>

                {!isOwner && !unavailable && (
                  <Pressable
                    onPress={reportService}
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
                )}
              </View>
            </ScrollView>

            {/* Close, floated over the photos rather than in a header band,
                and outside the scroll so it stays put while the page moves. */}
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                isRTL ? styles.closeButtonRTL : null,
                pressed && styles.pressed,
              ]}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={t("close")}
            >
              <Feather name="x" size={20} color={colors.ink} />
            </Pressable>
          </View>

          {footer}
        </React.Fragment>
      ) : null}

      {/* Inside this sheet's Modal, and mounted only while a service is open,
          so none of them — nor their dialog hosts — can outlive it. */}
      {service && (
        <>
          <ServiceBookingSheet
            visible={bookingOpen}
            service={item}
            providerName={providerName}
            onClose={() => setBookingOpen(false)}
            onViewBookings={viewBookings}
          />

          <ReviewSheet
            visible={reviewOpen}
            serviceId={service.id}
            existing={myReview}
            onClose={() => setReviewOpen(false)}
          />

          <ReportSheet
            visible={reportOpen}
            onClose={() => setReportOpen(false)}
            targetType={reportTarget?.type ?? "service"}
            targetId={reportTarget?.id ?? service.id}
            ownerId={reportTarget?.ownerId ?? null}
            // Called once the report sheet has gone; its default would open
            // sign-in underneath this sheet, which is still up.
            onSignIn={goToSignIn}
          />

          <VerifyPhoneSheet
            visible={verifyOpen}
            onClose={() => setVerifyOpen(false)}
            onVerified={handleVerified}
            onDismissed={handleVerifyDismissed}
          />
        </>
      )}
    </BottomSheet>
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

function Fact({
  icon,
  value,
  isRTL,
}: {
  icon: keyof typeof Feather.glyphMap;
  value: string;
  isRTL: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.fact, isRTL && styles.rowRTL]}>
      <Feather name={icon} size={15} color={colors.onSurface.muted} />
      <Text style={[styles.factText, isRTL && styles.textRTL]}>{value}</Text>
    </View>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    // The page pads itself, so the photos can take their own inset.
    sheetBody: {
      paddingHorizontal: 0,
    },
    // Holds the scroll and the floating close; shrinks with the panel so the
    // page scrolls inside it.
    frame: {
      flexShrink: 1,
    },
    scroll: {
      flexShrink: 1,
    },
    scrollContent: {
      paddingTop: 4,
      paddingBottom: 24,
    },
    gallery: {
      marginHorizontal: SIDE,
      height: GALLERY_HEIGHT,
      borderRadius: 20,
      overflow: "hidden",
      backgroundColor: colors.sand,
    },
    galleryImage: {
      height: GALLERY_HEIGHT,
      backgroundColor: colors.sand,
    },
    galleryEmpty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    mirrored: {
      transform: [{ scaleX: -1 }],
    },
    dots: {
      position: "absolute",
      bottom: 12,
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
      backgroundColor: "rgba(255,255,255,0.55)",
    },
    dotActive: {
      width: 18,
      backgroundColor: "#FFFFFF",
    },
    // 36pt drawn, 44pt to the finger with the slop, clear of the corner.
    closeButton: {
      position: "absolute",
      top: 14,
      right: SIDE + 10,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.92)",
      alignItems: "center",
      justifyContent: "center",
    },
    closeButtonRTL: {
      right: undefined,
      left: SIDE + 10,
    },
    pressed: {
      opacity: 0.7,
    },
    content: {
      paddingHorizontal: SIDE,
      paddingTop: 18,
      gap: 4,
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
    badgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 8,
    },
    // Neutral chip, as on the listing sheet: green stays for prices and
    // primary actions.
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
    offeredBy: {
      fontFamily: fonts.medium,
      fontSize: 14,
      color: colors.onSurface.variant,
      marginTop: 6,
    },
    price: {
      fontFamily: fonts.semibold,
      fontSize: 16,
      color: colors.primary.deep,
      marginTop: 10,
    },
    priceQuiet: {
      fontFamily: fonts.medium,
      color: colors.onSurface.variant,
    },
    facts: {
      marginTop: 14,
      gap: 6,
    },
    fact: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingVertical: 2,
    },
    factText: {
      flex: 1,
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 21,
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
      minHeight: 44,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    reportText: {
      fontFamily: fonts.regular,
      fontSize: 13,
      color: colors.onSurface.muted,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      paddingHorizontal: SIDE,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      backgroundColor: colors.surface.DEFAULT,
    },
    // Takes the room the button leaves, so a long price line is cut short
    // instead of running under Book.
    footerPriceWrap: {
      flex: 1,
    },
    footerPrice: {
      fontFamily: fonts.semibold,
      fontSize: 17,
      color: colors.ink,
    },
    footerButton: {
      paddingHorizontal: 28,
      paddingVertical: 13,
      borderRadius: 14,
      backgroundColor: colors.primary.DEFAULT,
    },
    footerButtonText: {
      fontFamily: fonts.semibold,
      fontSize: 16,
      color: colors.ink,
    },
    footerNote: {
      flex: 1,
      fontFamily: fonts.medium,
      fontSize: 14,
      color: colors.onSurface.variant,
      paddingVertical: 12,
    },
    ownerPill: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: colors.chip,
    },
    ownerPillText: {
      fontFamily: fonts.semibold,
      fontSize: 14,
      color: colors.onSurface.variant,
    },
  });
