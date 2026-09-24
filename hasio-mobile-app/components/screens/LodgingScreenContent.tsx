import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  type ListRenderItem,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { getLocalizedText, useLanguage } from "@/hooks/useLanguage";
import { useCurrency } from "@/hooks/useCurrency";
import { categoryColors, colors, type AppFonts } from "@/constants/colors";
import { CHIP_GAP, CHIP_TARGET_INSET } from "@/constants/layout";
import { ScreenGradient } from "@/components/ui/Gradients";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import { useLodgings } from "@/hooks/useConvexData";
import { Button, FilterChip, SkeletonFade, SkeletonList } from "@/components/ui";
import { LodgingCard } from "@/components/lodging/LodgingCard";
import {
  ListingDetailSheet,
  type DetailItem,
} from "@/components/listing/ListingDetailSheet";
import type { TranslationKey } from "@/constants/translations";
import type { Lodging, LodgingFilter, LodgingType } from "@/types";

type StayChip = { key: LodgingFilter; labelKey: TranslationKey };

const ALL_CHIP: StayChip = { key: "all", labelKey: "all" };

// The kinds of stay, in the order their chips appear.
const KIND_CHIPS: { key: LodgingType; labelKey: TranslationKey }[] = [
  { key: "hotel", labelKey: "hotels" },
  { key: "apartment", labelKey: "apartments" },
  { key: "camp", labelKey: "camps" },
  { key: "homestay", labelKey: "homestays" },
];

const lodgingKey = (item: Lodging) => item.id;
const chipKey = (chip: StayChip) => chip.key;

export function LodgingScreenContent() {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const bottomClearance = useTabBarClearance();
  const { t, language, isRTL } = useLanguage();
  const { format } = useCurrency();
  const [activeFilter, setActiveFilter] = useState<LodgingFilter>("all");

  // Every stay, narrowed here rather than by the query: the chips have to
  // know which kinds exist, which a list already cut down to one kind cannot
  // say.
  const { lodgings, isLoading } = useLodgings();

  // A chip for each kind of stay that is actually listed, as Home does for its
  // places. The row used to offer all four kinds whatever the data held, and a
  // chip with nothing behind it is a dead end. The selected kind keeps its chip
  // even if its last stay goes (delisted while it was selected), so the
  // selection stays visible and the empty state can offer the way back.
  const chips = useMemo<StayChip[]>(() => {
    const present = new Set(lodgings.map((item) => item.type));
    return [
      ALL_CHIP,
      ...KIND_CHIPS.filter(
        (chip) => present.has(chip.key) || chip.key === activeFilter
      ),
    ];
  }, [lodgings, activeFilter]);

  const filteredLodging = useMemo(
    () =>
      activeFilter === "all"
        ? lodgings
        : lodgings.filter((item) => item.type === activeFilter),
    [activeFilter, lodgings]
  );

  const [selected, setSelected] = useState<DetailItem | null>(null);

  // Localise here rather than inside the sheet: the three list screens describe
  // different things, and normalising at the call site keeps the sheet from
  // needing a branch per listing type.
  const toDetailItem = useCallback(
    (item: Lodging): DetailItem => ({
      id: item.id,
      title: getLocalizedText(item.name, item.nameAr, language),
      subtitle: getLocalizedText(item.city, item.cityAr, language),
      badge: t(`cat_${item.type}` as const),
      badgeColor: categoryColors[item.type],
      rating: item.rating,
      // A real nightly rate wins over the "$$$" band: it is the number the
      // quote is built from, and the Book bar only renders when there is a
      // priceLine. A band alone is shown as a band — it is not a nightly price.
      priceLine:
        item.pricePerNight != null
          ? `${format(item.pricePerNight)} ${t("perNight")}`
          : item.priceRange || undefined,
      // Only a listing the host has actually priced can be booked: the sheet
      // quotes from `pricePerNight`, and `priceRange` is free-text display copy
      // ("$$$") that cannot be multiplied by nights.
      bookable: item.pricePerNight != null,
      maxGuests: item.maxGuests,
      images: item.images,
      description: getLocalizedText(item.description, item.descriptionAr, language),
      amenities: language === "ar" ? item.amenitiesAr : item.amenities,
      details: item.details,
      ownerId: item.owner_id,
    }),
    [language, t, format]
  );

  // Stable, so the memoised cards skip a render when nothing about them
  // changed — they used to get a fresh closure each, on every render.
  const openLodging = useCallback(
    (item: Lodging) => setSelected(toDetailItem(item)),
    [toDetailItem]
  );
  const closeDetail = useCallback(() => setSelected(null), []);
  const showAll = useCallback(() => setActiveFilter("all"), []);

  const perNightText = t("perNight");
  const renderLodging = useCallback<ListRenderItem<Lodging>>(
    ({ item }) => (
      <LodgingCard
        lodging={item}
        language={language}
        isRTL={isRTL}
        perNightText={perNightText}
        onPress={openLodging}
      />
    ),
    [language, isRTL, perNightText, openLodging]
  );

  const renderChip = useCallback<ListRenderItem<StayChip>>(
    ({ item }) => (
      // Only "All" can be drawn before the data says which kinds exist; the
      // rest fade in beside it rather than popping into the row.
      <Animated.View entering={FadeIn.duration(180)}>
        <FilterChip
          label={t(item.labelKey)}
          selected={activeFilter === item.key}
          onPress={() => setActiveFilter(item.key)}
        />
      </Animated.View>
    ),
    [t, activeFilter]
  );

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

      {/* Kind chips. `inverted` mirrors the row in Arabic — the order, the
          edge it starts from and the direction it scrolls — in one place.
          The row used to reverse its array *and* lay it out row-reverse; the
          two cancelled out, so Arabic chips started on the left in English
          order. `alwaysBounceHorizontal={false}`: a row that fits has nothing
          to scroll, and a swipe there should change tabs on iOS instead. */}
      <Animated.View entering={FadeInDown.delay(200).duration(600)}>
        <FlatList
          horizontal
          inverted={isRTL}
          data={chips}
          keyExtractor={chipKey}
          renderItem={renderChip}
          showsHorizontalScrollIndicator={false}
          alwaysBounceHorizontal={false}
          contentContainerStyle={styles.filtersContainer}
        />
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
          keyExtractor={lodgingKey}
          renderItem={renderLodging}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottomClearance },
          ]}
          showsVerticalScrollIndicator={false}
          // Three cards fill a phone. Ten were built up front, so the first
          // frame after the skeleton waited on cards nobody could see yet.
          initialNumToRender={4}
          windowSize={7}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t("emptyLodgingTitle")}</Text>
              <Text style={styles.emptyMessage}>
                {activeFilter === "all"
                  ? t("emptyLodgingNoneMessage")
                  : t("emptyKindMessage")}
              </Text>
              {activeFilter !== "all" && (
                <Button
                  title={t("seeAll")}
                  variant="outline"
                  size="sm"
                  onPress={showAll}
                  hitSlop={6}
                  style={styles.emptyAction}
                />
              )}
            </View>
          }
        />
      </SkeletonFade>

      <ListingDetailSheet item={selected} onClose={closeDetail} />
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
  // 12pt above and below the pills, as before: each chip already brings
  // CHIP_TARGET_INSET of its own, its 44pt target (see FilterChip).
  filtersContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12 - CHIP_TARGET_INSET,
    gap: CHIP_GAP,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  // Centred in either language, so its text is centred too — it used to be
  // pushed right in Arabic inside a centred block.
  // The bottom padding keeps the "See all" button's slop inside this view,
  // where it can be hit.
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.ink,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyMessage: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
    textAlign: "center",
  },
  emptyAction: {
    marginTop: 18,
  },
});
