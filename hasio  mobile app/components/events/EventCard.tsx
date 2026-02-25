import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { Event, Language } from "@/types";
import { getLocalizedText } from "@/hooks/useLanguage";
import { categoryColors } from "@/constants/colors";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface EventCardProps {
  event: Event;
  language: Language;
  isRTL: boolean;
  onPress?: () => void;
}

const categoryLabels: Record<string, string> = {
  festival: "Festival",
  conference: "Conference",
  outdoor: "Outdoor",
  indoor: "Indoor",
  seasonal: "Seasonal",
};

export function EventCard({
  event,
  language,
  isRTL,
  onPress,
}: EventCardProps) {
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

  const title = getLocalizedText(event.title, event.titleAr, language);
  const location = getLocalizedText(event.location, event.locationAr, language);
  const categoryLabel = categoryLabels[event.category] || event.category;
  const categoryColor = categoryColors[event.category] || categoryColors.festival;

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
          source={{ uri: event.images[0] }}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />

        {/* Date Badge */}
        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>{event.date}</Text>
        </View>

        {/* Category Badge */}
        <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
          <Text style={styles.categoryText}>{categoryLabel}</Text>
        </View>
      </View>

      {/* Content */}
      <View style={[styles.content, isRTL && styles.contentRTL]}>
        {/* Title */}
        <Text
          style={[styles.title, isRTL && styles.textRTL]}
          numberOfLines={2}
        >
          {title}
        </Text>

        {/* Time */}
        <Text style={[styles.time, isRTL && styles.textRTL]}>
          {event.time}
        </Text>

        {/* Location */}
        <Text
          style={[styles.location, isRTL && styles.textRTL]}
          numberOfLines={1}
        >
          {location}
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
  dateBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dateText: {
    color: "#1A1A1A",
    fontSize: 13,
    fontWeight: "600",
  },
  categoryBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  categoryText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  content: {
    padding: 16,
  },
  contentRTL: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
    marginBottom: 6,
    lineHeight: 24,
  },
  time: {
    fontSize: 14,
    color: "#0D7A5F",
    fontWeight: "500",
    marginBottom: 4,
  },
  location: {
    fontSize: 14,
    color: "#737373",
  },
  textRTL: {
    textAlign: "right",
  },
});
