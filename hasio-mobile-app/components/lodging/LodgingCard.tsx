import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, type TextLayoutEvent } from "react-native";
import { Image } from "expo-image";
import type { Lodging, Language } from "@/types";
import { Feather } from "@expo/vector-icons";
import { getLocalizedText, useLanguage } from "@/hooks/useLanguage";
import { useCurrency } from "@/hooks/useCurrency";
import { colors, type AppFonts } from "@/constants/colors";
import {
  LODGING_CARD_CHIP_PADDING_VERTICAL,
  LODGING_CARD_CHIP_TEXT,
  LODGING_CARD_HEIGHT,
  LODGING_CARD_LOCATION_TEXT,
  LODGING_CARD_NAME_TEXT,
  LODGING_CARD_PRICE_TEXT,
} from "@/constants/layout";
import { CaptionScrim, ImageScrim } from "@/components/ui/Gradients";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { appAlert } from "@/stores/dialogStore";
import { useToggleFavorite, useFavoriteIds } from "@/hooks/useConvexData";
import { ReportSheet } from "@/components/ReportSheet";
import { PressableScale } from "@/components/ui";
import type { Id } from "../../../convex/_generated/dataModel";

interface LodgingCardProps {
  lodging: Lodging;
  language: Language;
  isRTL: boolean;
  /**
   * Handed the card's own stay, so a list can pass one stable callback for
   * every row. A fresh closure per row is a new prop on every render, and the
   * card could never skip one.
   */
  onPress?: (lodging: Lodging) => void;
  perNightText: string;
  /**
   * Overrides the type chip. The card is shaped for stays, but Favorites
   * hands it restaurants and attractions too; without this they would wear
   * a "Hotel" badge because the mapper has to coerce them into a stay type.
   */
  badge?: string;
  /** Off for anything that is not booked by the night. Defaults to on. */
  showPrice?: boolean;
}

// The heart and the "⋯" are 36pt discs 8pt apart. Four points of slop all
// round make each a 44pt target, and the two targets meet in the middle of the
// gap instead of overlapping: they used to be 34pt with 10pt of slop each, so
// they overlapped by 12pt, and a tap aimed at "⋯" near the heart saved the
// place instead — the heart is drawn later, so it won the overlap.
const ICON_BUTTON = 36;
const ICON_INSET = 12;
const ICON_GAP = 8;
const ICON_HIT_SLOP = { top: 4, bottom: 4, left: 4, right: 4 } as const;

/**
 * Memoised: a list re-renders on every keystroke and every filter change, and
 * with a stable `onPress` a card whose stay has not changed now sits those out.
 * It still re-renders when its heart does — that comes from its own hook.
 */
export const LodgingCard = React.memo(function LodgingCard({
  lodging,
  language,
  isRTL,
  onPress,
  perNightText,
  badge,
  showPrice = true,
}: LodgingCardProps) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useLanguage();
  const { format } = useCurrency();
  const isFavorite = useFavoriteIds().has(lodging.id);
  const toggleFavoriteFor = useToggleFavorite();

  // The report sheet — its own mutations, auth subscription and bottom sheet —
  // mounts on the first "⋯" tap rather than with the card, and then stays, so
  // its close animation and any later opening are instant. A Stay tab of a
  // dozen cards used to carry a dozen closed report sheets.
  const [reportMounted, setReportMounted] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const openReport = () => {
    setReportMounted(true);
    setReportOpen(true);
  };

  // Whether the name took its second line; see the caption scrim below.
  const [nameWraps, setNameWraps] = useState(false);
  const handleNameLayout = (event: TextLayoutEvent) =>
    setNameWraps(event.nativeEvent.lines.length > 1);

  // The heart flips at once either way — on the device for a guest, and as an
  // optimistic change for an account, which Convex rolls back if the server
  // refuses. A refusal used to be swallowed, so the heart just quietly went
  // back to grey; now it says why.
  const toggleFavorite = () => {
    toggleFavoriteFor(lodging.id, isFavorite).catch(() => {
      appAlert(t("error"), t("pleaseTryAgain"));
    });
  };

  const name = getLocalizedText(lodging.name, lodging.nameAr, language);
  const city = getLocalizedText(lodging.city, lodging.cityAr, language);
  // Localised like every other string on the card. Capitalising the raw value
  // left a Latin "Hotel" chip pinned to an otherwise Arabic card.
  const typeLabel = badge ?? t(`cat_${lodging.type}` as const);
  // The real nightly rate wins over the "$$$" band a host typed: it is the
  // number the quote is built from, and it is the only one worth converting.
  // `priceRange` is free-text display copy, so it is shown as-is — and without
  // "per night", because a band is not a nightly price. With neither there is
  // no price at all, where the card used to print a bare " per night".
  const hasRate = lodging.pricePerNight != null;
  const priceText =
    lodging.pricePerNight != null ? format(lodging.pricePerNight) : lodging.priceRange;
  const showPriceLine = showPrice && !!priceText;
  // An unreviewed place shows no rating rather than "★ 0.0": it is not a bad
  // place, only a new one.
  const rated = lodging.rating > 0;

  const accessibilityLabel = [
    name,
    typeLabel,
    city,
    showPriceLine ? (hasRate ? `${priceText} ${perNightText}` : priceText) : "",
    rated ? `${t("rating")} ${lodging.rating.toFixed(1)}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    // Shadow lives on a wrapper that doesn't clip; iOS drops the shadow if the
    // same view has overflow: hidden.
    <View style={styles.shadowWrap}>
      <PressableScale
        style={styles.card}
        onPress={() => onPress?.(lodging)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Image
          source={lodging.images?.[0] ? { uri: lodging.images[0] } : undefined}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />
        {/* Sheen, then the weighted bottom the caption reads against. Both
            sit above the photo and below every badge, so the overlays keep
            their own contrast. The scrim reaches further up once the name
            wraps, or its first line would sit in the ramp's weak half. */}
        <ImageScrim />
        <CaptionScrim tall={nameWraps} />

        {rated && (
          <View style={[styles.ratingBadge, isRTL && styles.ratingBadgeRTL]}>
            <Feather name="star" size={12} color={colors.warm} />
            <Text style={styles.ratingText}>{lodging.rating.toFixed(1)}</Text>
          </View>
        )}

        {/* More actions */}
        <Pressable
          style={({ pressed }) => [
            styles.iconButton,
            styles.moreButton,
            isRTL && styles.moreButtonRTL,
            pressed && styles.iconPressed,
          ]}
          onPress={openReport}
          hitSlop={ICON_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={t("reportTitle")}
        >
          <Feather name="more-horizontal" size={18} color={colors.ink} />
        </Pressable>

        {/* Favorite Button */}
        <Pressable
          style={({ pressed }) => [
            styles.iconButton,
            styles.favoriteButton,
            isRTL && styles.favoriteButtonRTL,
            pressed && styles.iconPressed,
          ]}
          onPress={toggleFavorite}
          hitSlop={ICON_HIT_SLOP}
          accessibilityRole="button"
          accessibilityState={{ selected: isFavorite }}
          accessibilityLabel={
            isFavorite ? t("removeFromFavorites") : t("addToFavorites")
          }
        >
          <Feather
            name="heart"
            size={18}
            color={isFavorite ? colors.favorite : colors.ink}
          />
        </Pressable>

        {/* Caption. No panel behind it — it sits on the photograph and the
            scrim above carries its contrast. */}
        <View style={[styles.caption, isRTL && styles.captionRTL]}>
          <View style={styles.typeChip}>
            <Text style={styles.typeText}>{typeLabel}</Text>
          </View>
          {/* Two lines: at one, most hotel names in the province lost their
              second half to an ellipsis. */}
          <Text
            style={[styles.name, isRTL && styles.textRTL]}
            numberOfLines={2}
            onTextLayout={handleNameLayout}
          >
            {name}
          </Text>
          <View style={[styles.metaRow, isRTL && styles.rowRTL]}>
            <View style={[styles.locationGroup, isRTL && styles.rowRTL]}>
              <Feather name="map-pin" size={12} color={CAPTION_MUTED} />
              <Text
                style={[styles.location, isRTL && styles.textRTL]}
                numberOfLines={1}
              >
                {city}
              </Text>
            </View>
            {showPriceLine && (
              <Text style={styles.price} numberOfLines={1}>
                {priceText}
                {hasRate ? (
                  <Text style={styles.priceUnit}>{` ${perNightText}`}</Text>
                ) : null}
              </Text>
            )}
          </View>
        </View>
      </PressableScale>

      {reportMounted && (
        <ReportSheet
          visible={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="listing"
          targetId={lodging.id}
          // The detail sheet's report offers "Block this provider" for a
          // host's listing; the card's now does the same.
          ownerId={lodging.owner_id ? (lodging.owner_id as Id<"users">) : null}
        />
      )}
    </View>
  );
});

// White on the scrim, at the three weights the caption uses. Kept as
// constants because the map-pin icon needs the same value as the label beside
// it, and an icon colour cannot come out of a StyleSheet.
const CAPTION = "#FFFFFF";
const CAPTION_MUTED = "rgba(255, 255, 255, 0.84)";
const CAPTION_FAINT = "rgba(255, 255, 255, 0.74)";

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  shadowWrap: {
    marginBottom: 20,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderRadius: 24,
  },
  card: {
    height: LODGING_CARD_HEIGHT,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.sand,
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  ratingBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  ratingBadgeRTL: {
    left: undefined,
    right: 12,
    flexDirection: "row-reverse",
  },
  ratingText: {
    color: colors.ink,
    fontSize: 12,
    fontFamily: fonts.semibold,
  },
  iconButton: {
    position: "absolute",
    top: ICON_INSET,
    width: ICON_BUTTON,
    height: ICON_BUTTON,
    borderRadius: ICON_BUTTON / 2,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconPressed: {
    opacity: 0.7,
  },
  favoriteButton: {
    right: ICON_INSET,
  },
  favoriteButtonRTL: {
    right: undefined,
    left: ICON_INSET,
  },
  moreButton: {
    right: ICON_INSET + ICON_BUTTON + ICON_GAP,
  },
  moreButtonRTL: {
    right: undefined,
    left: ICON_INSET + ICON_BUTTON + ICON_GAP,
  },
  // `alignItems` sizes the type chip to its label; everything below it is
  // stretched back to full width so the meta row can push the price out to the
  // far edge. Flipping this one property is what mirrors the block in Arabic.
  caption: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    alignItems: "flex-start",
  },
  captionRTL: {
    alignItems: "flex-end",
  },
  rowRTL: {
    flexDirection: "row-reverse",
  },
  // Lime is a fill, never a text colour: ink on it is 12.1:1, white is 1.4:1.
  // As a solid chip it also sidesteps the photograph underneath entirely,
  // which is why the type moved up here out of the meta line.
  typeChip: {
    backgroundColor: colors.primary.DEFAULT,
    paddingHorizontal: 9,
    paddingVertical: LODGING_CARD_CHIP_PADDING_VERTICAL,
    borderRadius: 999,
  },
  typeText: {
    color: colors.ink,
    fontSize: LODGING_CARD_CHIP_TEXT.fontSize,
    lineHeight: LODGING_CARD_CHIP_TEXT.lineHeight,
    fontFamily: fonts.semibold,
  },
  // The serif at 20px is the display face the rest of the app uses for
  // headings; the pill was too shallow to carry it and ran a 15.5px sans
  // instead. lineHeight is 28 rather than the ~24 the Latin cut needs —
  // Cairo's ascenders and diacritics clip below that.
  name: {
    alignSelf: "stretch",
    marginTop: 8,
    fontSize: LODGING_CARD_NAME_TEXT.fontSize,
    lineHeight: LODGING_CARD_NAME_TEXT.lineHeight,
    fontFamily: fonts.serif,
    color: CAPTION,
    letterSpacing: -0.2,
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  metaRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 6,
  },
  locationGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  location: {
    flexShrink: 1,
    fontSize: LODGING_CARD_LOCATION_TEXT.fontSize,
    lineHeight: LODGING_CARD_LOCATION_TEXT.lineHeight,
    fontFamily: fonts.regular,
    color: CAPTION_MUTED,
  },
  price: {
    fontSize: LODGING_CARD_PRICE_TEXT.fontSize,
    lineHeight: LODGING_CARD_PRICE_TEXT.lineHeight,
    fontFamily: fonts.bold,
    color: CAPTION,
  },
  priceUnit: {
    fontSize: 11.5,
    fontFamily: fonts.regular,
    color: CAPTION_FAINT,
  },
  textRTL: {
    textAlign: "right",
  },
});
