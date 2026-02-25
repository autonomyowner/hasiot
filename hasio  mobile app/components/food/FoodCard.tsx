import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { Food, Language } from "@/types";
import { getLocalizedText } from "@/hooks/useLanguage";
import { categoryColors } from "@/constants/colors";

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
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: food.images[0] }}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />

        {/* Rating Badge */}
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>{food.rating.toFixed(1)}</Text>
        </View>
      </View>

      {/* Content */}
      <View style={[styles.content, isRTL && styles.contentRTL]}>
        {/* Category Badge */}
        <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
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
    height: 160,
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
  content: {
    padding: 16,
  },
  contentRTL: {
    alignItems: "flex-end",
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 10,
  },
  categoryText: {
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
  cuisine: {
    fontSize: 14,
    color: "#737373",
    marginBottom: 4,
  },
  hours: {
    fontSize: 13,
    color: "#A3A3A3",
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
