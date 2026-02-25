import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useConvexAuth } from "convex/react";
import type { Lodging, Language } from "@/types";
import { getLocalizedText } from "@/hooks/useLanguage";
import { categoryColors } from "@/constants/colors";
import { useAppStore } from "@/stores/appStore";
import { useToggleFavorite, useFavorites } from "@/hooks/useConvexData";

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
  const typeLabel = lodging.type.charAt(0).toUpperCase() + lodging.type.slice(1);
  const typeColor = categoryColors[lodging.type] || categoryColors.hotel;

  return (
    <AnimatedPressable
      style={[styles.container, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: lodging.images[0] }}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />

        {/* Rating Badge */}
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>{lodging.rating.toFixed(1)}</Text>
        </View>

        {/* Favorite Button */}
        <Pressable style={styles.favoriteButton} onPress={toggleFavorite}>
          <Text style={styles.favoriteText}>{isFavorite ? "♥" : "♡"}</Text>
        </Pressable>
      </View>

      {/* Content */}
      <View style={[styles.content, isRTL && styles.contentRTL]}>
        {/* Type Badge */}
        <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
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
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  imageContainer: {
    height: 180,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  ratingBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  ratingText: {
    color: "#D97706",
    fontSize: 14,
    fontWeight: "700",
  },
  favoriteButton: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteText: {
    fontSize: 18,
    color: "#DC6B5A",
  },
  content: {
    padding: 16,
  },
  contentRTL: {
    alignItems: "flex-end",
  },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
  },
  typeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: "#737373",
    marginBottom: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0D7A5F",
  },
  priceUnit: {
    fontSize: 13,
    fontWeight: "400",
    color: "#737373",
  },
  textRTL: {
    textAlign: "right",
  },
});
