import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image, type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { colors, fonts } from "@/constants/colors";
import {
  CATEGORY_CARD_HEIGHT,
  CATEGORY_CARD_WIDTH,
} from "@/constants/layout";
import { PressableScale } from "./PressableScale";

interface CategoryCardProps {
  title: string;
  subtitle: string;
  /** Remote URL or a bundled `require()` module. */
  imageUrl: string | number | ImageSource;
  onPress: () => void;
  isRTL?: boolean;
}

export function CategoryCard({
  title,
  subtitle,
  imageUrl,
  onPress,
  isRTL = false,
}: CategoryCardProps) {
  const source =
    typeof imageUrl === "string"
      ? imageUrl
        ? { uri: imageUrl }
        : undefined
      : imageUrl;

  return (
    <PressableScale
      style={styles.container}
      scaleTo={0.97}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
    >
      <Image source={source} style={styles.image} contentFit="cover" transition={300} />
      <LinearGradient
        colors={["transparent", "rgba(20, 18, 12, 0.18)", "rgba(20, 18, 12, 0.62)"]}
        style={styles.gradient}
      />
      <View style={[styles.content, isRTL && styles.contentRTL]}>
        <Text style={[styles.title, isRTL && styles.textRTL]} numberOfLines={2}>
          {title}
        </Text>
        <View style={[styles.captionPill, isRTL && styles.captionPillRTL]}>
          <Feather name="map-pin" size={11} color={colors.ink} />
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CATEGORY_CARD_WIDTH,
    height: CATEGORY_CARD_HEIGHT,
    borderRadius: 24,
    overflow: "hidden",
    marginRight: 16,
    backgroundColor: colors.sand,
  },
  image: {
    width: "100%",
    height: "100%",
    position: "absolute",
    backgroundColor: colors.sand,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 16,
  },
  contentRTL: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 22,
    fontFamily: fonts.serif,
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: -0.2,
    textShadowColor: "rgba(0, 0, 0, 0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  // Floating white pill, echoing the destination-grid cards.
  captionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  captionPillRTL: {
    flexDirection: "row-reverse",
    alignSelf: "flex-end",
  },
  subtitle: {
    fontSize: 11.5,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  textRTL: {
    textAlign: "right",
  },
});
