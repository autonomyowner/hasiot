import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useConvexAuth } from "convex/react";
import type { Lodging, Language } from "@/types";
import { Feather } from "@expo/vector-icons";
import { getLocalizedText, useLanguage } from "@/hooks/useLanguage";
import { categoryColors, colors, fonts } from "@/constants/colors";
import { useAppStore } from "@/stores/appStore";
import { useToggleFavorite, useFavorites } from "@/hooks/useConvexData";
import { ReportSheet } from "@/components/ReportSheet";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const scale = useSharedValue(1);
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

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
  const typeColor = categoryColors[lodging.type] || categoryColors.hotel;

  return (
    <AnimatedPressable
      style={[styles.container, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${typeLabel}, ${city}, ${lodging.priceRange} ${perNightText}`}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        <Image
          source={lodging.images?.[0] ? { uri: lodging.images[0] } : undefined}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />

        {/* Rating Badge */}
        <View style={styles.ratingBadge}>
          <Feather name="star" size={12} color={colors.warm} />
          <Text style={styles.ratingText}>{lodging.rating.toFixed(1)}</Text>
        </View>

        {/* More actions */}
        <Pressable
          style={styles.moreButton}
          onPress={() => setReportOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("reportTitle")}
        >
          <Text style={styles.moreText}>⋯</Text>
        </Pressable>

        {/* Favorite Button */}
        <Pressable
          style={styles.favoriteButton}
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
      </View>

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="listing"
        targetId={lodging.id}
      />

      {/* Content */}
      <View style={[styles.content, isRTL && styles.contentRTL]}>
        {/* Type Badge */}
        <View
          style={[
            styles.typeBadge,
            isRTL && styles.typeBadgeRTL,
            { backgroundColor: typeColor },
          ]}
        >
          <Text style={styles.typeText}>{typeLabel}</Text>
        </View>

        {/* Name */}
        <Text
          style={[styles.name, isRTL && styles.textRTL]}
          numberOfLines={1}
        >
          {name}
        </Text>

        {/* Location */}
        <Text
          style={[styles.location, isRTL && styles.textRTL]}
          numberOfLines={1}
        >
          {city}
        </Text>

        {/* Price */}
        <Text style={[styles.price, isRTL && styles.textRTL]}>
          {lodging.priceRange}{" "}
          <Text style={styles.priceUnit}>{perNightText}</Text>
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 10,
    shadowColor: "#1F1D17",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 16,
  },
  imageContainer: {
    height: 180,
    position: "relative",
    backgroundColor: colors.sand,
    borderRadius: 18,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
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
    borderRadius: 14,
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
  moreText: {
    fontSize: 18,
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    lineHeight: 18,
  },
  content: {
    padding: 14,
    paddingBottom: 6,
  },
  contentRTL: {
    alignItems: "flex-end",
  },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 11,
    marginBottom: 10,
  },
  // `contentRTL` sets alignItems: "flex-end", but a child's own alignSelf wins,
  // so the badge needs an explicit RTL override to flip with the rest.
  typeBadgeRTL: {
    alignSelf: "flex-end",
  },
  typeText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontFamily: fonts.semibold,
  },
  name: {
    fontSize: 16.5,
    fontFamily: fonts.semibold,
    color: colors.ink,
    marginBottom: 4,
  },
  location: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
    marginBottom: 8,
  },
  price: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.primary.DEFAULT,
  },
  priceUnit: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
  },
  textRTL: {
    textAlign: "right",
  },
});
