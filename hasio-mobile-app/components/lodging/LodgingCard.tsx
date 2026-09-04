import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useConvexAuth } from "convex/react";
import type { Lodging, Language } from "@/types";
import { Feather } from "@expo/vector-icons";
import { getLocalizedText, useLanguage } from "@/hooks/useLanguage";
import { useCurrency } from "@/hooks/useCurrency";
import { colors, type AppFonts } from "@/constants/colors";
import { CaptionScrim, ImageScrim } from "@/components/ui/Gradients";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useAppStore } from "@/stores/appStore";
import { useToggleFavorite, useFavorites } from "@/hooks/useConvexData";
import { ReportSheet } from "@/components/ReportSheet";
import { PressableScale } from "@/components/ui";

interface LodgingCardProps {
  lodging: Lodging;
  language: Language;
  isRTL: boolean;
  onPress?: () => void;
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

export function LodgingCard({
  lodging,
  language,
  isRTL,
  onPress,
  perNightText,
  badge,
  showPrice = true,
}: LodgingCardProps) {
  const styles = useThemedStyles(makeStyles);
  const [reportOpen, setReportOpen] = useState(false);
  const { t } = useLanguage();
  const { format } = useCurrency();
  const { isAuthenticated } = useConvexAuth();
  const convexToggleFavorite = useToggleFavorite();
  const { favorites } = useFavorites();
  const isFavoriteLocal = useAppStore((state) => state.isFavorite(lodging.id));
  const addFavoriteLocal = useAppStore((state) => state.addFavorite);
  const removeFavoriteLocal = useAppStore((state) => state.removeFavorite);
  const isFavoriteConvex = isAuthenticated && favorites.some((f: any) => f._id === lodging.id);
  const isFavorite = isAuthenticated ? isFavoriteConvex : isFavoriteLocal;

  const toggleFavorite = () => {
    if (isAuthenticated) {
      convexToggleFavorite(lodging.id);
    }
    // Always update local state for instant feedback
    if (isFavorite) {
      removeFavoriteLocal(lodging.id);
    } else {
      addFavoriteLocal(lodging.id);
    }
  };

  const name = getLocalizedText(lodging.name, lodging.nameAr, language);
  const city = getLocalizedText(lodging.city, lodging.cityAr, language);
  // Localised like every other string on the card. Capitalising the raw value
  // left a Latin "Hotel" chip pinned to an otherwise Arabic card.
  const typeLabel = badge ?? t(`cat_${lodging.type}` as const);
  // The real nightly rate wins over the "$$$" band a host typed: it is the
  // number the quote is built from, and it is the only one worth converting.
  // `priceRange` is free-text display copy, so it is shown as-is or not at all.
  const priceText =
    lodging.pricePerNight != null ? format(lodging.pricePerNight) : lodging.priceRange;

  return (
    // Shadow lives on a wrapper that doesn't clip; iOS drops the shadow if the
    // same view has overflow: hidden.
    <View style={styles.shadowWrap}>
      <PressableScale
        style={styles.card}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          showPrice
            ? `${name}, ${typeLabel}, ${city}, ${priceText} ${perNightText}`
            : `${name}, ${typeLabel}, ${city}`
        }
      >
        <Image
          source={lodging.images?.[0] ? { uri: lodging.images[0] } : undefined}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />
        {/* Sheen, then the weighted bottom the caption reads against. Both
            sit above the photo and below every badge, so the overlays keep
            their own contrast. */}
        <ImageScrim />
        <CaptionScrim />

        {/* Rating Badge */}
        <View style={[styles.ratingBadge, isRTL && styles.ratingBadgeRTL]}>
          <Feather name="star" size={12} color={colors.warm} />
          <Text style={styles.ratingText}>{lodging.rating.toFixed(1)}</Text>
        </View>

        {/* More actions */}
        <Pressable
          style={[styles.moreButton, isRTL && styles.moreButtonRTL]}
          onPress={() => setReportOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("reportTitle")}
        >
          <Text style={styles.moreText}>⋯</Text>
        </Pressable>

        {/* Favorite Button */}
        <Pressable
          style={[styles.favoriteButton, isRTL && styles.favoriteButtonRTL]}
          onPress={toggleFavorite}
          hitSlop={10}
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
          <Text
            style={[styles.name, isRTL && styles.textRTL]}
            numberOfLines={1}
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
            {showPrice && (
              <Text style={styles.price}>
                {priceText}{" "}
                <Text style={styles.priceUnit}>{perNightText}</Text>
              </Text>
            )}
          </View>
        </View>
      </PressableScale>

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="listing"
        targetId={lodging.id}
      />
    </View>
  );
}

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
    height: 240,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.sand,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
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
  favoriteButton: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteButtonRTL: {
    right: undefined,
    left: 12,
  },
  moreButton: {
    position: "absolute",
    top: 12,
    right: 54,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  moreButtonRTL: {
    right: undefined,
    left: 54,
  },
  moreText: {
    fontSize: 18,
    color: colors.ink,
    fontFamily: fonts.bold,
    lineHeight: 18,
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
    paddingVertical: 4,
    borderRadius: 999,
  },
  typeText: {
    color: colors.ink,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.semibold,
  },
  // The serif at 20px is the display face the rest of the app uses for
  // headings; the pill was too shallow to carry it and ran a 15.5px sans
  // instead. lineHeight is 28 rather than the ~24 the Latin cut needs —
  // Cairo's ascenders and diacritics clip below that.
  name: {
    alignSelf: "stretch",
    marginTop: 8,
    fontSize: 20,
    lineHeight: 28,
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
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: fonts.regular,
    color: CAPTION_MUTED,
  },
  price: {
    fontSize: 15,
    lineHeight: 17,
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
