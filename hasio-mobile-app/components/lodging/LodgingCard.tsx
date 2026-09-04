import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useConvexAuth } from "convex/react";
import type { Lodging, Language } from "@/types";
import { Feather } from "@expo/vector-icons";
import { getLocalizedText, useLanguage } from "@/hooks/useLanguage";
import { colors, type AppFonts } from "@/constants/colors";
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
}

export function LodgingCard({
  lodging,
  language,
  isRTL,
  onPress,
  perNightText,
}: LodgingCardProps) {
  const styles = useThemedStyles(makeStyles);
  const [reportOpen, setReportOpen] = useState(false);
  const { t } = useLanguage();
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
  const typeLabel = t(`cat_${lodging.type}` as const);

  return (
    // Shadow lives on a wrapper that doesn't clip; iOS drops the shadow if the
    // same view has overflow: hidden.
    <View style={styles.shadowWrap}>
      <PressableScale
        style={styles.card}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${typeLabel}, ${city}, ${lodging.priceRange} ${perNightText}`}
      >
        <Image
          source={lodging.images?.[0] ? { uri: lodging.images[0] } : undefined}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />

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

        {/* Floating info pill */}
        <View style={styles.pill}>
          <View style={[styles.pillTopRow, isRTL && styles.rowRTL]}>
            <Text
              style={[styles.name, isRTL && styles.textRTL]}
              numberOfLines={1}
            >
              {name}
            </Text>
            <View style={styles.typeChip}>
              <Text style={styles.typeText}>{typeLabel}</Text>
            </View>
          </View>
          <View style={[styles.pillBottomRow, isRTL && styles.rowRTL]}>
            <View style={[styles.locationGroup, isRTL && styles.rowRTL]}>
              <Feather name="map-pin" size={12} color={colors.onSurface.muted} />
              <Text
                style={[styles.location, isRTL && styles.textRTL]}
                numberOfLines={1}
              >
                {city}
              </Text>
            </View>
            <Text style={styles.price}>
              {lodging.priceRange}{" "}
              <Text style={styles.priceUnit}>{perNightText}</Text>
            </Text>
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
    right: 56,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  moreButtonRTL: {
    right: undefined,
    left: 56,
  },
  moreText: {
    fontSize: 18,
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    lineHeight: 18,
  },
  pill: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pillTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  pillBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 5,
  },
  rowRTL: {
    flexDirection: "row-reverse",
  },
  name: {
    flex: 1,
    fontSize: 15.5,
    fontFamily: fonts.semibold,
    color: colors.ink,
    letterSpacing: -0.2,
  },
  typeChip: {
    backgroundColor: colors.mint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typeText: {
    color: colors.primary.DEFAULT,
    fontSize: 11,
    fontFamily: fonts.semibold,
  },
  locationGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  location: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
  },
  price: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.primary.DEFAULT,
  },
  priceUnit: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
  },
  textRTL: {
    textAlign: "right",
  },
});
