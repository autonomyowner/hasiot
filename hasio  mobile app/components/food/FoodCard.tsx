import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { Food, Language } from "@/types";
import { Feather } from "@expo/vector-icons";
import { getLocalizedText } from "@/hooks/useLanguage";
import { categoryColors, colors, fonts } from "@/constants/colors";
import { ReportSheet } from "@/components/ReportSheet";
import type { Id } from "../../../convex/_generated/dataModel";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface FoodCardProps {
  food: Food;
  language: Language;
  isRTL: boolean;
  onPress?: () => void;
  avgPriceText: string;
}

const categoryLabels: Record<string, string> = {
  restaurant: "Restaurant",
  home_kitchen: "Home Kitchen",
  fastfood: "Fast Food",
  drinks: "Drinks",
};

export function FoodCard({
  food,
  language,
  isRTL,
  onPress,
  avgPriceText,
}: FoodCardProps) {
  const scale = useSharedValue(1);
  const [reportOpen, setReportOpen] = useState(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const name = getLocalizedText(food.name, food.nameAr, language);
  const cuisine = getLocalizedText(food.cuisine, food.cuisineAr, language);
  const categoryLabel = categoryLabels[food.category] || food.category;
  const categoryColor = categoryColors[food.category] || categoryColors.restaurant;

  return (
    <AnimatedPressable
      style={[styles.container, animatedStyle]}
      onPress={onPress}
      onLongPress={() => setReportOpen(true)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        <Image
          source={food.images?.[0] ? { uri: food.images[0] } : undefined}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />

        {/* Rating Badge */}
        <View style={styles.ratingBadge}>
          <Feather name="star" size={12} color={colors.warm} />
          <Text style={styles.ratingText}>{food.rating.toFixed(1)}</Text>
        </View>

        {/* More actions */}
        <Pressable
          style={styles.moreButton}
          onPress={() => setReportOpen(true)}
          hitSlop={10}
        >
          <Text style={styles.moreText}>⋯</Text>
        </Pressable>
      </View>

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="listing"
        targetId={food.id}
        ownerId={food.owner_id ? (food.owner_id as Id<"users">) : null}
      />

      {/* Content */}
      <View style={[styles.content, isRTL && styles.contentRTL]}>
        {/* Category Badge */}
        <View
          style={[
            styles.categoryBadge,
            isRTL && styles.categoryBadgeRTL,
            { backgroundColor: categoryColor },
          ]}
        >
          <Text style={styles.categoryText}>{categoryLabel}</Text>
        </View>

        {/* Name */}
        <Text
          style={[styles.name, isRTL && styles.textRTL]}
          numberOfLines={1}
        >
          {name}
        </Text>

        {/* Cuisine */}
        <Text
          style={[styles.cuisine, isRTL && styles.textRTL]}
          numberOfLines={1}
        >
          {cuisine}
        </Text>

        {/* Hours */}
        <Text style={[styles.hours, isRTL && styles.textRTL]}>
          {food.hours}
        </Text>

        {/* Price */}
        <Text style={[styles.price, isRTL && styles.textRTL]}>
          {food.avgPrice}{" "}
          <Text style={styles.priceUnit}>{avgPriceText}</Text>
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
    height: 160,
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
  moreButton: {
    position: "absolute",
    top: 12,
    right: 12,
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
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 11,
    marginBottom: 10,
  },
  // `contentRTL` sets alignItems: "flex-end", but a child's own alignSelf wins,
  // so the badge needs an explicit RTL override to flip with the rest.
  categoryBadgeRTL: {
    alignSelf: "flex-end",
  },
  categoryText: {
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
  cuisine: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
    marginBottom: 4,
  },
  hours: {
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
