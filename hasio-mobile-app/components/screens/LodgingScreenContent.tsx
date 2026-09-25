import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Keyboard,
  Pressable,
  type ListRenderItem,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { getLocalizedText, useLanguage } from "@/hooks/useLanguage";
import { useCurrency } from "@/hooks/useCurrency";
import { useDebounce } from "@/hooks/useDebounce";
import { categoryColors, colors, type AppFonts } from "@/constants/colors";
import { canonicalCity } from "@/constants/cities";
import { CHIP_GAP, CHIP_TARGET_INSET } from "@/constants/layout";
import { ScreenGradient } from "@/components/ui/Gradients";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import { useLodgings } from "@/hooks/useConvexData";
import { Button, FilterChip, SearchBar, SkeletonFade, SkeletonList } from "@/components/ui";
import { LodgingCard } from "@/components/lodging/LodgingCard";
import {
  ListingDetailSheet,
  type DetailItem,
} from "@/components/listing/ListingDetailSheet";
import { CityPill, CitySheet, ServicesList } from "@/components/services/ServicesList";
import { useBookTabStore, type BookSegment } from "@/stores/bookTabStore";
import { translations, type TranslationKey } from "@/constants/translations";
import { matchesQuery, normalizeForSearch, searchableText } from "@/lib/searchText";
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

// The segments are 40pt tall inside the track's 4pt padding; this much slop
// reaches the track's edges, inside it, which makes each a 48pt target.
const SEGMENT_SLOP = { top: 4, bottom: 4 } as const;

/**
 * The Book tab (it was Stay): somewhere to stay, or someone to book — a guide,
 * a driver, a photographer (design D3).
 *
 * One header over a Stays | Services switch. The switch lives in a store, not
 * in this screen: Home's "Local services" row lands here on Services, and the
 * choice holds across swipes between tabs. Both halves stay mounted once shown
 * — hidden, not unmounted — so switching back keeps the scroll, the search
 * and the filters where they were, and never reloads a list.
 */
export function LodgingScreenContent() {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const segment = useBookTabStore((state) => state.segment);
  const setSegment = useBookTabStore((state) => state.setSegment);

  // Services mounts the first time it is shown, not with the tab: most visits
  // are for a stay. Adjusted during render, so it is there on that frame.
  const [servicesMounted, setServicesMounted] = useState(segment === "services");
  if (segment === "services" && !servicesMounted) setServicesMounted(true);

  const chooseSegment = useCallback(
    (next: BookSegment) => {
      // A search field's keyboard would otherwise stay up over the other half.
      Keyboard.dismiss();
      setSegment(next);
    },
    [setSegment]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenGradient />
      <Animated.View
        entering={FadeInDown.delay(100).duration(600)}
        style={[styles.header, isRTL && styles.headerRTL]}
      >
        <Text style={[styles.eyebrow, isRTL && styles.textRTL]}>{t("bookEyebrow")}</Text>
        <Text style={[styles.title, isRTL && styles.textRTL]}>{t("tabStay")}</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(600)}>
        <SegmentSwitch value={segment} onChange={chooseSegment} />
      </Animated.View>

      <View style={[styles.pane, segment !== "stays" && styles.paneHidden]}>
        <StaysPane />
      </View>
      {servicesMounted && (
        <View style={[styles.pane, segment !== "services" && styles.paneHidden]}>
          <ServicesList />
        </View>
      )}
    </View>
  );
}

/**
 * Stays | Services. Two tabs on the segmented-control track, the chosen one a
 * white pill with ink on it; mirrored in Arabic, so Stays is on the right.
 */
function SegmentSwitch({
  value,
  onChange,
}: {
  value: BookSegment;
  onChange: (segment: BookSegment) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL } = useLanguage();
  const segments: { key: BookSegment; label: string }[] = [
    { key: "stays", label: t("bookSegmentStays") },
    { key: "services", label: t("bookSegmentServices") },
  ];

  return (
    <View style={[styles.segmentTrack, isRTL && styles.rowRTL]} accessibilityRole="tablist">
      {segments.map(({ key, label }) => {
        const selected = value === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            hitSlop={SEGMENT_SLOP}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && !selected && styles.pressed,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
          >
            <Text
              style={[styles.segmentText, selected && styles.segmentTextSelected]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * The Stays half: today's list of stays, with a search and a city filter.
 *
 * Narrowed here rather than by the query: the kind chips have to know which
 * kinds exist, which a list already cut down cannot say, and the whole set is
 * a few dozen rows. The search matches as Home's does — both names, the city
 * and the kind in both languages, folded for Arabic spelling (lib/searchText).
 */
function StaysPane() {
  const styles = useThemedStyles(makeStyles);
  const bottomClearance = useTabBarClearance();
  const { t, language, isRTL } = useLanguage();
  const { format } = useCurrency();
  const [activeFilter, setActiveFilter] = useState<LodgingFilter>("all");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  // The debounce is for typing, not for clearing: an emptied box brings the
  // whole list back at once.
  const searchTerm = useMemo(
    () => normalizeForSearch(query.trim() ? debouncedQuery : ""),
    [query, debouncedQuery]
  );
  const [city, setCity] = useState<string | null>(null);
  const [cityOpen, setCityOpen] = useState(false);

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

  // What each stay can be found by, folded once per data change rather than
  // on every keystroke.
  const lodgingText = useMemo(
    () =>
      new Map(
        lodgings.map((item) => [
          item.id,
          searchableText(
            item.name,
            item.nameAr,
            item.city,
            item.cityAr,
            translations.en[`cat_${item.type}` as const],
            translations.ar[`cat_${item.type}` as const]
          ),
        ])
      ),
    [lodgings]
  );

  // The city compares canonically: a stay stored as "Hofuf" is in Al Ahsa.
  const filteredLodging = useMemo(
    () =>
      lodgings.filter(
        (item) =>
          (activeFilter === "all" || item.type === activeFilter) &&
          (!city || canonicalCity(item.city) === city) &&
          (!searchTerm || matchesQuery(lodgingText.get(item.id) ?? "", searchTerm))
      ),
    [activeFilter, city, searchTerm, lodgings, lodgingText]
  );

  // A city or a search on top of the kind — the empty state says so.
  const narrowed = city !== null || searchTerm !== "";

  const [selected, setSelected] = useState<DetailItem | null>(null);

  // Localise here rather than inside the sheet: the list screens describe
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
  const openCities = useCallback(() => setCityOpen(true), []);
  const closeCities = useCallback(() => setCityOpen(false), []);
  // The way back from an empty list: every filter off, the search cleared.
  const showAll = useCallback(() => {
    setActiveFilter("all");
    setCity(null);
    setQuery("");
  }, []);

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
    <View style={styles.pane}>
      <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.searchWrap}>
        <SearchBar
          placeholder={t("searchStays")}
          value={query}
          onChangeText={setQuery}
          isRTL={isRTL}
        />
      </Animated.View>

      {/* Kind chips, with the city filter at their head. `inverted` mirrors
          the row in Arabic — the order, the edge it starts from and the
          direction it scrolls — in one place. The row used to reverse its
          array *and* lay it out row-reverse; the two cancelled out, so Arabic
          chips started on the left in English order. `alwaysBounceHorizontal
          ={false}`: a row that fits has nothing to scroll, and a swipe there
          should change tabs on iOS instead. */}
      <Animated.View entering={FadeInDown.delay(250).duration(600)}>
        <FlatList
          horizontal
          inverted={isRTL}
          data={chips}
          keyExtractor={chipKey}
          renderItem={renderChip}
          ListHeaderComponent={<CityPill city={city} onPress={openCities} />}
          showsHorizontalScrollIndicator={false}
          alwaysBounceHorizontal={false}
          keyboardShouldPersistTaps="handled"
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
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          // Three cards fill a phone. Ten were built up front, so the first
          // frame after the skeleton waited on cards nobody could see yet.
          initialNumToRender={4}
          windowSize={7}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>{t("emptyLodgingTitle")}</Text>
              <Text style={styles.emptyMessage}>
                {narrowed
                  ? t("emptyStaysFilteredHint")
                  : activeFilter === "all"
                    ? t("emptyLodgingNoneMessage")
                    : t("emptyKindMessage")}
              </Text>
              {(narrowed || activeFilter !== "all") && (
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
      <CitySheet visible={cityOpen} value={city} onChange={setCity} onClose={closeCities} />
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
  rowRTL: {
    flexDirection: "row-reverse",
  },
  pressed: {
    opacity: 0.7,
  },
  pane: {
    flex: 1,
  },
  // Hidden, not unmounted: see LodgingScreenContent.
  paneHidden: {
    display: "none",
  },
  // The segmented-control track the palette names for it, with the chosen
  // segment a white pill on it.
  segmentTrack: {
    flexDirection: "row",
    marginHorizontal: 24,
    marginBottom: 8,
    padding: 4,
    borderRadius: 999,
    backgroundColor: colors.chip,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  segmentSelected: {
    backgroundColor: colors.surface.DEFAULT,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  segmentText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.onSurface.variant,
  },
  segmentTextSelected: {
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  searchWrap: {
    paddingHorizontal: 24,
    paddingTop: 4,
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
