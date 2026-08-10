import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { getLocalizedText, useLanguage } from "@/hooks/useLanguage";
import { categoryColors, colors, fonts } from "@/constants/colors";
import { useFoods } from "@/hooks/useConvexData";
import { FilterChip, SkeletonFade, SkeletonList } from "@/components/ui";
import { FoodCard } from "@/components/food/FoodCard";
import {
  ListingDetailSheet,
  type DetailItem,
} from "@/components/listing/ListingDetailSheet";
import type { Food, FoodFilter, FoodCategory } from "@/types";

const filters: { key: FoodFilter; labelKey: "all" | "restaurants" | "productiveFamilies" | "fastFood" | "drinks" }[] = [
  { key: "all", labelKey: "all" },
  { key: "restaurant", labelKey: "restaurants" },
  { key: "home_kitchen", labelKey: "productiveFamilies" },
  { key: "fastfood", labelKey: "fastFood" },
  { key: "drinks", labelKey: "drinks" },
];

export function FoodScreenContent() {
  const insets = useSafeAreaInsets();
  const { t, language, isRTL } = useLanguage();
  const [activeFilter, setActiveFilter] = useState<FoodFilter>("all");

  // Get foods from Convex with fallback to mock data
  const categoryFilter = activeFilter === "all" ? undefined : activeFilter as FoodCategory;
  const { foods, isLoading } = useFoods(categoryFilter);

  // Filter locally if using "all" filter
  const filteredFood = useMemo(() => {
    if (activeFilter === "all") return foods;
    return foods.filter((item) => item.category === activeFilter);
  }, [activeFilter, foods]);

  const displayFilters = isRTL ? [...filters].reverse() : filters;

  const [selected, setSelected] = useState<DetailItem | null>(null);

  const toDetailItem = (item: Food): DetailItem => ({
    id: item.id,
    title: getLocalizedText(item.name, item.nameAr, language),
    subtitle: getLocalizedText(item.cuisine, item.cuisineAr, language),
    badge: t(`cat_${item.category}` as const),
    badgeColor: categoryColors[item.category],
    rating: item.rating,
    priceLine: item.avgPrice ? `${item.avgPrice} ${t("averagePrice")}` : undefined,
    images: item.images,
    description: getLocalizedText(item.description, item.descriptionAr, language),
    details: item.details,
    ownerId: item.owner_id,
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(600)}
        style={[styles.header, isRTL && styles.headerRTL]}
      >
        <Text style={[styles.title, isRTL && styles.textRTL]}>
          {t("food")}
        </Text>
      </Animated.View>

      {/* Filters */}
      <Animated.View entering={FadeInDown.delay(200).duration(600)}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.filtersContainer,
            isRTL && styles.filtersContainerRTL,
          ]}
        >
          {displayFilters.map((filter) => (
            <FilterChip
              key={filter.key}
              label={t(filter.labelKey)}
              selected={activeFilter === filter.key}
              onPress={() => setActiveFilter(filter.key)}
            />
          ))}
        </ScrollView>
      </Animated.View>

      {/* Food List — cross-faded from its skeleton; see LodgingScreenContent. */}
      <SkeletonFade
        fill
        loading={isLoading}
        skeleton={<SkeletonList variant="food" isRTL={isRTL} />}
      >
        <FlatList
          data={filteredFood}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FoodCard
              food={item}
              language={language}
              isRTL={isRTL}
              avgPriceText={t("averagePrice")}
              onPress={() => setSelected(toDetailItem(item))}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, isRTL && styles.textRTL]}>
                {t("emptyFoodTitle")}
              </Text>
              <Text style={[styles.emptyMessage, isRTL && styles.textRTL]}>
                {t("emptyFoodMessage")}
              </Text>
            </View>
          }
        />
      </SkeletonFade>

      <ListingDetailSheet item={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerRTL: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 34,
    fontFamily: fonts.serif,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  textRTL: {
    textAlign: "right",
  },
  filtersContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  filtersContainerRTL: {
    flexDirection: "row-reverse",
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.ink,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
});
