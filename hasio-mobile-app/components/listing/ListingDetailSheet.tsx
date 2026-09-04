import { appAlert } from "@/stores/dialogStore";
import { AppDialogHost } from "@/components/ui/AppDialog";
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Alert,
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
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import { ReportSheet } from "@/components/ReportSheet";
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
}

interface ListingDetailSheetProps {
  item: DetailItem | null;
  onClose: () => void;
}

const IMAGE_HEIGHT = 380;
// The body sheet pulls up over the hero by this much.
const SHEET_OVERLAP = 28;

export function ListingDetailSheet({ item, onClose }: ListingDetailSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [imageIndex, setImageIndex] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const galleryRef = React.useRef<ScrollView>(null);

  const scrollGalleryTo = (index: number) => {
    galleryRef.current?.scrollTo({ x: index * width, animated: true });
    setImageIndex(index);
  };

  // Rendered even with no item so the exit animation has something to play
  // against; `visible` alone drives it.
  const images = item?.images?.length ? item.images : [];
  const detail = item?.details;

  const openUrl = async (url: string, failureKey: "detailCallFailed" | "detailLinkFailed") => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        appAlert(t("error"), t(failureKey));
        return;
      }
      await Linking.openURL(url);
    } catch {
      appAlert(t("error"), t(failureKey));
    }
  };

  const handleCall = () => {
    if (!detail?.phone) return;
    // Strip spaces and dashes: `tel:` is tolerant on iOS but not on every
    // Android dialer.
    openUrl(`tel:${detail.phone.replace(/[\s-]/g, "")}`, "detailCallFailed");
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

  const handleImageScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    setImageIndex((current) => (current === next ? current : next));
  };

  const hasContact = !!(
    detail?.phone ||
    detail?.website ||
    detail?.email ||
    detail?.coordinates ||
    detail?.address
  );

  return (
    <>
    <Modal
      visible={!!item}
      animationType="slide"
      // pageSheet gives iOS its native card presentation and the swipe-down
      // dismiss users expect; Android ignores it and presents full screen.
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {item && (
          <>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
            >
              {/* Gallery */}
              <View style={styles.gallery}>
                {images.length > 0 ? (
                  <ScrollView
                    ref={galleryRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={handleImageScroll}
                  >
                    {images.map((uri, i) => (
                      <Image
                        key={`${uri}-${i}`}
                        source={{ uri }}
                        style={{ width, height: IMAGE_HEIGHT }}
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
                  <View style={styles.dots}>
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
                    {images.slice(0, 6).map((uri, i) => (
                      <Pressable
                        key={`thumb-${uri}-${i}`}
                        onPress={() => scrollGalleryTo(i)}
                        accessibilityRole="button"
                        accessibilityLabel={t("detailImageCount")
                          .replace("{current}", String(i + 1))
                          .replace("{total}", String(images.length))}
                      >
                        <Image
                          source={{ uri }}
                          style={[
                            styles.thumb,
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
                  {item.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  )}
                  {typeof item.rating === "number" && item.rating > 0 && (
                    <View style={[styles.ratingRow, isRTL && styles.rowRTL]}>
                      <Feather name="star" size={13} color={colors.warm} />
                      <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.title, isRTL && styles.textRTL]}>
                  {item.title}
                </Text>

                {item.subtitle ? (
                  <Text style={[styles.subtitle, isRTL && styles.textRTL]}>
                    {item.subtitle}
                  </Text>
                ) : null}

                {item.priceLine ? (
                  <Text style={[styles.price, isRTL && styles.textRTL]}>
                    {item.priceLine}
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
                    {item.description?.trim() || t("detailNoDescription")}
                  </Text>
                </Section>

                {/* Amenities */}
                {item.amenities && item.amenities.length > 0 && (
                  <Section title={t("detailAmenities")} isRTL={isRTL}>
                    <View style={[styles.chips, isRTL && styles.rowRTL]}>
                      {item.amenities.map((amenity) => (
                        <View key={amenity} style={styles.chip}>
                          <Text style={styles.chipText}>{amenity}</Text>
                        </View>
                      ))}
                    </View>
                  </Section>
                )}

                {/* Hours */}
                {detail?.workingHours && detail.workingHours.length > 0 && (
                  <Section title={t("detailHours")} isRTL={isRTL}>
                    {detail.workingHours.map((h) => (
                      <View
                        key={h.day}
                        style={[styles.hoursRow, isRTL && styles.rowRTL]}
                      >
                        <Text style={styles.hoursDay}>{h.day}</Text>
                        <Text style={styles.hoursTime}>
                          {h.isClosed ? t("detailClosed") : `${h.open} – ${h.close}`}
                        </Text>
                      </View>
                    ))}
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

                {/* Report */}
                <Pressable
                  onPress={() => setReportOpen(true)}
                  style={[styles.reportRow, isRTL && styles.rowRTL]}
                  accessibilityRole="button"
                  accessibilityLabel={t("reportTitle")}
                >
                  <Feather name="flag" size={14} color={colors.onSurface.muted} />
                  <Text style={styles.reportText}>{t("reportTitle")}</Text>
                </Pressable>
              </View>
            </ScrollView>

            {/* Close. Floated over the gallery rather than sitting in a header
                band, so the images run to the top edge of the sheet. */}
            <Pressable
              onPress={onClose}
              style={[
                styles.closeButton,
                // pageSheet already insets from the top; full screen does not.
                { top: Platform.OS === "ios" ? 16 : insets.top + 12 },
                isRTL ? styles.closeButtonRTL : null,
              ]}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t("close")}
            >
              <Feather name="x" size={20} color={colors.ink} />
            </Pressable>
          </>
        )}
      </View>
      {/* Alerts fired while this modal is open render above it. */}
      <AppDialogHost />
    </Modal>

    {/* Sibling of the detail modal, not a child of it. A transparent modal
        nested inside a `pageSheet` is clipped to the sheet's own frame on iOS;
        presented from here it covers the screen the way it does from a card. */}
    {item && (
      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="listing"
        targetId={item.id}
        ownerId={item.ownerId ? (item.ownerId as Id<"users">) : null}
      />
    )}
    </>
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
      style={[styles.actionButton, primary && styles.actionButtonPrimary]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather
        name={icon}
        size={16}
        color={primary ? colors.ink : colors.primary.deep}
      />
      <Text
        style={[styles.actionLabel, primary && styles.actionLabelPrimary]}
        numberOfLines={1}
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
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={value}>
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
    padding: 24,
    gap: 4,
  },
  thumbRail: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  thumb: {
    width: 52,
    height: 52,
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
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    // 44pt: these are the primary things to tap on this screen.
    minHeight: 44,
    paddingHorizontal: 12,
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
