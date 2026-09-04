import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image, type ImageSource } from "expo-image";
import { colors, type AppFonts } from "@/constants/colors";
import { CaptionScrim } from "./Gradients";
import { useThemedStyles } from "@/hooks/useAppFonts";
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
  const styles = useThemedStyles(makeStyles);
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
      <CaptionScrim tall />
      <View style={[styles.content, isRTL && styles.contentRTL]}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{subtitle}</Text>
        </View>
        <Text style={[styles.title, isRTL && styles.textRTL]} numberOfLines={2}>
          {title}
        </Text>
      </View>
    </PressableScale>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
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
  content: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "flex-start",
    padding: 16,
  },
  contentRTL: {
    alignItems: "flex-end",
  },
  // The subtitle is the category, not a place — it used to carry a map-pin
  // inside a white pill, which said the wrong thing about it twice over. As a
  // lime chip it matches the type chip on the lodging and destination cards,
  // and ink on lime is 12.1:1 whatever the photograph does underneath.
  chip: {
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  title: {
    alignSelf: "stretch",
    marginTop: 8,
    fontSize: 22,
    lineHeight: 30,
    fontFamily: fonts.serif,
    color: "#FFFFFF",
    letterSpacing: -0.2,
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  textRTL: {
    textAlign: "right",
  },
});
