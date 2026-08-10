import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { Event, Language } from "@/types";
import { getLocalizedText, useLanguage } from "@/hooks/useLanguage";
import { categoryColors, colors, fonts } from "@/constants/colors";
import { ReportSheet } from "@/components/ReportSheet";
import type { Id } from "../../../convex/_generated/dataModel";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface EventCardProps {
  event: Event;
  language: Language;
  isRTL: boolean;
  onPress?: () => void;
}

export function EventCard({
  event,
  language,
  isRTL,
  onPress,
}: EventCardProps) {
  const scale = useSharedValue(1);
  const [reportOpen, setReportOpen] = useState(false);
  const { t } = useLanguage();

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
  const categoryLabel = t(`cat_${event.category}` as const);
  const categoryColor = categoryColors[event.category] || categoryColors.festival;

  return (
    <AnimatedPressable
      style={[styles.container, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${categoryLabel}, ${location}, ${event.date}`}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        <Image
          source={event.images?.[0] ? { uri: event.images[0] } : undefined}
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
      </View>

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="listing"
        targetId={event.id}
        ownerId={event.owner_id ? (event.owner_id as Id<"users">) : null}
      />

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
  dateBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  dateText: {
    color: colors.ink,
    fontSize: 12,
    fontFamily: fonts.semibold,
  },
  categoryBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 11,
  },
  categoryText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontFamily: fonts.semibold,
  },
  moreButton: {
    position: "absolute",
    bottom: 12,
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
  title: {
    fontSize: 16.5,
    fontFamily: fonts.semibold,
    color: colors.ink,
    marginBottom: 6,
    lineHeight: 22,
  },
  time: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.primary.DEFAULT,
    marginBottom: 4,
  },
  location: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
  },
  textRTL: {
    textAlign: "right",
  },
});
