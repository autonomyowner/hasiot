import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import type { Food, Language } from "@/types";
import { Feather } from "@expo/vector-icons";
import { getLocalizedText, useLanguage } from "@/hooks/useLanguage";
import { colors, fonts } from "@/constants/colors";
import { ReportSheet } from "@/components/ReportSheet";
import { PressableScale } from "@/components/ui";
import type { Id } from "../../../convex/_generated/dataModel";

interface FoodCardProps {
  food: Food;
  language: Language;
  isRTL: boolean;
  onPress?: () => void;
  avgPriceText: string;
}

export function FoodCard({
  food,
  language,
  isRTL,
  onPress,
  avgPriceText,
}: FoodCardProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const { t } = useLanguage();

  const name = getLocalizedText(food.name, food.nameAr, language);
  const cuisine = getLocalizedText(food.cuisine, food.cuisineAr, language);
  const categoryLabel = t(`cat_${food.category}` as const);

  return (
    // Shadow lives on a wrapper that doesn't clip; iOS drops the shadow if the
    // same view has overflow: hidden.
    <View style={styles.shadowWrap}>
      <PressableScale
        style={styles.card}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${categoryLabel}, ${cuisine}, ${food.avgPrice} ${avgPriceText}`}
      >
        <Image
          source={food.images?.[0] ? { uri: food.images[0] } : undefined}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />

        {/* Rating Badge */}
        <View style={[styles.ratingBadge, isRTL && styles.ratingBadgeRTL]}>
          <Feather name="star" size={12} color={colors.warm} />
          <Text style={styles.ratingText}>{food.rating.toFixed(1)}</Text>
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
              <Text style={styles.typeText}>{categoryLabel}</Text>
            </View>
          </View>
          <View style={[styles.pillBottomRow, isRTL && styles.rowRTL]}>
            <Text
              style={[styles.meta, isRTL && styles.textRTL]}
              numberOfLines={1}
            >
              {[cuisine, food.hours].filter(Boolean).join(" · ")}
            </Text>
            <Text style={styles.price}>
              {food.avgPrice}{" "}
              <Text style={styles.priceUnit}>{avgPriceText}</Text>
            </Text>
          </View>
        </View>
      </PressableScale>

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="listing"
        targetId={food.id}
        ownerId={food.owner_id ? (food.owner_id as Id<"users">) : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
    height: 220,
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
  moreButtonRTL: {
    right: undefined,
    left: 12,
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
  meta: {
    flex: 1,
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
