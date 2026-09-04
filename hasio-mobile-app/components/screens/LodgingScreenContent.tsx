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
import { categoryColors, colors, type AppFonts } from "@/constants/colors";
import { ScreenGradient } from "@/components/ui/Gradients";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { TAB_BAR_CLEARANCE } from "@/constants/layout";
import { useLodgings } from "@/hooks/useConvexData";
import { FilterChip, SkeletonFade, SkeletonList } from "@/components/ui";
import { LodgingCard } from "@/components/lodging/LodgingCard";
import {
  ListingDetailSheet,
  type DetailItem,
} from "@/components/listing/ListingDetailSheet";
import type { Lodging, LodgingFilter, LodgingType } from "@/types";

const filters: { key: LodgingFilter; labelKey: "all" | "hotels" | "apartments" | "camps" | "homestays" }[] = [
  { key: "all", labelKey: "all" },
  { key: "hotel", labelKey: "hotels" },
  { key: "apartment", labelKey: "apartments" },
  { key: "camp", labelKey: "camps" },
  { key: "homestay", labelKey: "homestays" },
];

export function LodgingScreenContent() {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t, language, isRTL } = useLanguage();
  const [activeFilter, setActiveFilter] = useState<LodgingFilter>("all");

  // Get lodgings from Convex with fallback to mock data
  const typeFilter = activeFilter === "all" ? undefined : activeFilter as LodgingType;
  const { lodgings, isLoading } = useLodgings(typeFilter);

  // Filter locally if using "all" filter
  const filteredLodging = useMemo(() => {
    if (activeFilter === "all") return lodgings;
    return lodgings.filter((item) => item.type === activeFilter);
  }, [activeFilter, lodgings]);

  const displayFilters = isRTL ? [...filters].reverse() : filters;

  const [selected, setSelected] = useState<DetailItem | null>(null);

  // Localise here rather than inside the sheet: the three list screens describe
  // different things, and normalising at the call site keeps the sheet from
  // needing a branch per listing type.
  const toDetailItem = (item: Lodging): DetailItem => ({
    id: item.id,
    title: getLocalizedText(item.name, item.nameAr, language),
    subtitle: getLocalizedText(item.city, item.cityAr, language),
    badge: t(`cat_${item.type}` as const),
    badgeColor: categoryColors[item.type],
    rating: item.rating,
    priceLine: item.priceRange ? `${item.priceRange} ${t("perNight")}` : undefined,
    bookable: true,
    images: item.images,
    description: getLocalizedText(item.description, item.descriptionAr, language),
    amenities: language === "ar" ? item.amenitiesAr : item.amenities,
    details: item.details,
    ownerId: item.owner_id,
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenGradient />
      {/* Header */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(600)}
        style={[styles.header, isRTL && styles.headerRTL]}
      >
        <Text style={[styles.eyebrow, isRTL && styles.textRTL]}>
          {t("lodgingEyebrow")}
        </Text>
        <Text style={[styles.title, isRTL && styles.textRTL]}>
          {t("lodging")}
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

      {/* Lodging List. The cards no longer animate in one by one: the skeleton
          they replace is fading out on top of them, and content sliding up
          through a stationary placeholder reads as a stumble. SkeletonFade
          cross-fades the whole list instead. */}
      <SkeletonFade
        fill
        loading={isLoading}
        skeleton={<SkeletonList variant="lodging" isRTL={isRTL} />}
      >
        <FlatList
          data={filteredLodging}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <LodgingCard
              lodging={item}
              language={language}
              isRTL={isRTL}
              perNightText={t("perNight")}
              onPress={() => setSelected(toDetailItem(item))}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: TAB_BAR_CLEARANCE + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, isRTL && styles.textRTL]}>
                {t("emptyLodgingTitle")}
              </Text>
              <Text style={[styles.emptyMessage, isRTL && styles.textRTL]}>
                {t("emptyLodgingMessage")}
              </Text>
            </View>
          }
        />
      </SkeletonFade>

      <ListingDetailSheet item={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerRTL: {
    alignItems: "flex-end",
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.primary.deep,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
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
