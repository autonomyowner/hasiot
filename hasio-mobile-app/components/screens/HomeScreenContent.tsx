import React, { useCallback, useMemo, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  Pressable,
  FlatList,
  type ListRenderItem,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useLanguage, getLocalizedText } from "@/hooks/useLanguage";
import { useCurrency } from "@/hooks/useCurrency";
import { useHomeData, type Destination } from "@/hooks/useConvexData";
import {
  Button,
  SearchBar,
  FilterChip,
  FilterSheet,
  PressableScale,
  EMPTY_FILTERS,
  activeFilterCount,
  type HomeFilters,
  SkeletonFade,
  SkeletonHomeSections,
} from "@/components/ui";
import { canonicalCity } from "@/constants/cities";
import { categoryColors, colors, type AppFonts } from "@/constants/colors";
import { enterFade } from "@/constants/motion";
import { CaptionScrim, ScreenGradient } from "@/components/ui/Gradients";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import {
  CHIP_GAP,
  CHIP_TARGET_INSET,
  HOME_CARD_GAP,
  HOME_CARD_WIDTH,
  HOME_CHIP_ROW_MARGIN_TOP,
  HOME_CONTAINER_PADDING,
  HOME_GRID_CARD_HEIGHT,
  HOME_GRID_CARD_TALL_HEIGHT,
  HOME_RAIL_CARD_HEIGHT,
  HOME_RAIL_CARD_WIDTH,
  HOME_RAIL_GAP,
  HOME_SECTION_EYEBROW,
  HOME_SECTION_MARGIN_BOTTOM,
  HOME_SECTION_MARGIN_TOP,
  HOME_SECTION_TITLE,
  HOME_STAY_BANNER_HEIGHT,
} from "@/constants/layout";
import { generatedImages } from "@/assets/images/generated";
import {
  ListingDetailSheet,
  type DetailItem,
} from "@/components/listing/ListingDetailSheet";
import { translations, type TranslationKey } from "@/constants/translations";
import {
  countForm,
  matchesQuery,
  normalizeForSearch,
  searchableText,
} from "@/lib/searchText";
import type { Language, Lodging } from "@/types";
import type { TabKey } from "@/app/(tabs)/_layout";

// Shared with the skeleton that stands in for this screen while it loads.
const CARD_GAP = HOME_CARD_GAP;
const CONTAINER_PADDING = HOME_CONTAINER_PADDING;
const CARD_WIDTH = HOME_CARD_WIDTH;

// Home's photo cards give a little more under the finger than the app's
// default: they are larger, and 0.98 of a 300pt card barely registers.
const CARD_PRESS_SCALE = 0.96;

// The hero is a fixed 190pt box over a photograph. At the largest text sizes
// its three lines outgrew it and were cut off by its rounded corners; they
// still grow, up to this, and everything else on the screen scales freely.
const HERO_MAX_FONT_SCALE = 1.3;

// What the destination chips filter on. "all" is not a kind any row carries,
// which is why it lives in the chip union and not in this one.
type DestinationKind = "attraction" | "tour" | "event";
type KindChip = "all" | DestinationKind;
type KindChipItem = { key: KindChip; labelKey: TranslationKey };

// Chip order, and the key each kind reads under — "Places" rather than
// "Attractions" is a decision that belongs in the translations, not here.
const KIND_CHIPS: { key: DestinationKind; labelKey: TranslationKey }[] = [
  { key: "attraction", labelKey: "attractions" },
  { key: "tour", labelKey: "tours" },
  { key: "event", labelKey: "events" },
];

const ALL_KINDS: KindChipItem = { key: "all", labelKey: "all" };

// How many cards the featured rail holds. Small on purpose: past five the rail
// stops being a selection and becomes the grid again, sideways.
const FEATURED_COUNT = 5;

// How many places the grid shows before "Show more", and how many each press
// adds. The grid is not virtualised, so every card in it is built at once.
const GRID_PAGE = 24;

const kindChipKey = (chip: KindChipItem) => chip.key;
const destinationKey = (dest: Destination) => dest.id;

/**
 * Whether the grid card at `index` is the tall one.
 *
 * The grid is two columns filled alternately, and each column alternates
 * short and tall from opposite ends: the first row is short beside tall (as
 * the skeleton draws it), and the two columns never drift more than one step
 * apart. It used to be one wrapping row with a tall card at every third index,
 * and a row is as tall as its tallest card — so each short card beside a tall
 * one left a 50pt hole under it.
 */
function isTallGridCard(index: number): boolean {
  const row = Math.floor(index / 2);
  return index % 2 === 0 ? row % 2 === 1 : row % 2 === 0;
}

interface HomeScreenContentProps {
  onNavigateToTab?: (key: TabKey) => void;
}

export function HomeScreenContent({ onNavigateToTab }: HomeScreenContentProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const bottomClearance = useTabBarClearance();
  const { t, language, isRTL } = useLanguage();
  const { format } = useCurrency();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useSharedValue(0);

  const onRefresh = () => {
    setRefreshing(true);
    // Convex queries auto-update via subscriptions; brief visual feedback
    setTimeout(() => setRefreshing(false), 800);
  };

  // Read at render rather than memoised: it is one call to Date, and a value
  // cached for the life of the screen would still say "good morning" at dinner.
  const hour = new Date().getHours();
  const greetingKey: TranslationKey =
    hour < 12
      ? "morningGreeting"
      : hour < 17
        ? "afternoonGreeting"
        : "eveningGreeting";

  // Get data from Convex with fallback to mock data
  const { lodgings, destinations: allDestinations, isLoading } = useHomeData();

  // The cities the filter sheet offers, counted from the rows this screen
  // shows. They used to come from `getCities`, which also counts restaurants —
  // listed nowhere on Home — so a count could be wrong, and a city whose only
  // listings were restaurants was offered and then filtered to nothing.
  const cities = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of [...lodgings, ...allDestinations]) {
      const key = canonicalCity(item.city);
      totals.set(key, (totals.get(key) ?? 0) + 1);
    }
    return Array.from(totals, ([city, count]) => ({ city, count })).sort(
      (a, b) => b.count - a.count || a.city.localeCompare(b.city)
    );
  }, [lodgings, allDestinations]);

  const [filters, setFilters] = useState<HomeFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterCount = activeFilterCount(filters);
  const [kind, setKind] = useState<KindChip>("all");
  const [gridLimit, setGridLimit] = useState(GRID_PAGE);

  // The cheapest and dearest night on offer, snapped outwards to the slider's
  // step so its ends are round numbers. Derived from the data rather than
  // fixed: a range that stops below the only suite in town cannot select it.
  const priceBounds = useMemo(() => {
    const rates = lodgings
      .map((item) => item.pricePerNight)
      .filter((rate): rate is number => rate != null && rate > 0);
    if (rates.length === 0) return undefined;
    const step = 50;
    return {
      min: Math.floor(Math.min(...rates) / step) * step,
      max: Math.ceil(Math.max(...rates) / step) * step,
    };
  }, [lodgings]);

  const budgetActive = filters.priceMin !== null || filters.priceMax !== null;

  // Filters narrow the whole screen, not just the search results — otherwise
  // setting one and then clearing the query would silently drop it.
  //
  // A stay with no nightly rate is dropped once a budget is set. It is not that
  // it fails the test — nobody knows what it costs — and showing it anyway
  // would put the one listing whose price you cannot check inside the range you
  // just drew.
  const allLodging = useMemo(
    () =>
      lodgings.filter(
        (item) =>
          (!filters.type || item.type === filters.type) &&
          (!filters.city || canonicalCity(item.city) === filters.city) &&
          (!budgetActive ||
            (item.pricePerNight != null &&
              (filters.priceMin === null || item.pricePerNight >= filters.priceMin) &&
              (filters.priceMax === null || item.pricePerNight <= filters.priceMax)))
      ),
    [lodgings, filters, budgetActive]
  );

  // A destination has no type or nightly rate of its own, so those two filters
  // exclude destinations entirely rather than matching everything: asking for
  // stays under 300 a night and being shown a set of parks is not a filter
  // working. The kind chips are a separate axis and narrow only this half.
  const destinations = useMemo(
    () =>
      filters.type || budgetActive
        ? []
        : allDestinations.filter(
            (item) =>
              (!filters.city || canonicalCity(item.city) === filters.city) &&
              (kind === "all" || item.kind === kind)
          ),
    [allDestinations, filters, budgetActive, kind]
  );

  // Only the lodging types actually present, so the sheet never offers a
  // filter that can only ever return nothing.
  const lodgingTypes = useMemo(
    () => Array.from(new Set(lodgings.map((l) => l.type))).sort(),
    [lodgings]
  );

  // Same rule for the kind chips, off the unfiltered pool: which kinds exist
  // is a fact about the data, not about what is currently selected. The one
  // exception is the selected kind itself, which keeps its chip if its last
  // place goes, so the selection stays visible and the empty state can offer
  // the way back.
  const kindChips = useMemo<KindChipItem[]>(() => {
    const present = new Set(allDestinations.map((item) => item.kind));
    return [
      ALL_KINDS,
      ...KIND_CHIPS.filter((chip) => present.has(chip.key) || chip.key === kind),
    ];
  }, [allDestinations, kind]);

  // Featured is the best of what is on screen, not a flag on the row. It used
  // to be `rating >= 4.5`, and those ratings are seed data due to be cleared —
  // the day that lands, a threshold empties the rail while ranking still fills
  // it. Review count breaks the tie so 5.0 from one review does not outrank
  // 4.8 from forty, and the index keeps the sort stable under any engine.
  const { featured, rest } = useMemo(() => {
    const top = destinations
      .map((dest, index) => ({ dest, index }))
      .sort(
        (a, b) =>
          b.dest.rating - a.dest.rating ||
          b.dest.reviewCount - a.dest.reviewCount ||
          a.index - b.index
      )
      .slice(0, FEATURED_COUNT)
      .map((entry) => entry.dest);

    const picked = new Set(top.map((dest) => dest.id));
    return {
      featured: top,
      rest: destinations.filter((dest) => !picked.has(dest.id)),
    };
  }, [destinations]);

  const gridItems = useMemo(() => rest.slice(0, gridLimit), [rest, gridLimit]);

  // The debounce is for typing, not for clearing: emptying the box brings the
  // browse view back at once, where it used to keep showing results for a
  // query that was no longer there for another 300ms.
  const query = searchQuery.trim() ? debouncedQuery : "";
  const searchTerm = useMemo(() => normalizeForSearch(query), [query]);

  // What each row can be found by, folded once per data change rather than on
  // every keystroke: both names and both city labels, plus the kind of stay in
  // both languages for a stay, and the category for a place. A place could not
  // be found by its city at all before, and none of it matched Arabic typed
  // without the hamza — see lib/searchText.ts.
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
  const destinationText = useMemo(
    () =>
      new Map(
        allDestinations.map((item) => [
          item.id,
          searchableText(
            item.name,
            item.nameAr,
            item.subtitle,
            item.subtitleAr,
            item.city,
            item.cityAr
          ),
        ])
      ),
    [allDestinations]
  );

  // One results view for a query, for a set of filters, or for both. The
  // lists arriving here are already filtered, so this only applies the text
  // match — and when there is no query it applies nothing, which is what makes
  // filters alone able to drive the results view.
  const searchResults = useMemo(() => {
    if (!searchTerm && filterCount === 0) return null;

    const lodgingResults = searchTerm
      ? allLodging.filter((item) =>
          matchesQuery(lodgingText.get(item.id) ?? "", searchTerm)
        )
      : allLodging;

    const destinationResults = searchTerm
      ? destinations.filter((item) =>
          matchesQuery(destinationText.get(item.id) ?? "", searchTerm)
        )
      : destinations;

    return {
      lodging: lodgingResults,
      destinations: destinationResults,
      total: lodgingResults.length + destinationResults.length,
    };
  }, [searchTerm, filterCount, allLodging, destinations, lodgingText, destinationText]);

  const [selected, setSelected] = useState<DetailItem | null>(null);

  // Home shows stays and destinations side by side, so each gets its own
  // mapping into the shared sheet's shape. Same normalising the list screens
  // do — done here so the sheet never has to know what it is showing.
  const lodgingDetail = useCallback(
    (item: Lodging): DetailItem => ({
      id: item.id,
      title: getLocalizedText(item.name, item.nameAr, language),
      subtitle: getLocalizedText(item.city, item.cityAr, language),
      badge: t(`cat_${item.type}` as const),
      badgeColor: categoryColors[item.type],
      rating: item.rating,
      // A real nightly rate wins over the "$$$" band, and a band alone is not
      // a nightly price — see LodgingScreenContent.
      priceLine:
        item.pricePerNight != null
          ? `${format(item.pricePerNight)} ${t("perNight")}`
          : item.priceRange || undefined,
      // Only a listing the host has actually priced can be booked — see the same
      // note in LodgingScreenContent.
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

  const destinationDetail = useCallback(
    (item: Destination): DetailItem => ({
      id: item.id,
      title: getLocalizedText(item.name, item.nameAr, language),
      subtitle: getLocalizedText(item.subtitle, item.subtitleAr, language),
      rating: item.rating,
      images: item.images?.length ? item.images : item.image ? [item.image] : [],
      description: getLocalizedText(item.description, item.descriptionAr, language),
      details: item.details,
      ownerId: item.owner_id,
    }),
    [language]
  );

  // Stable callbacks, handed the row they belong to, so the memoised cards
  // below can sit out the renders that do not concern them — every keystroke
  // in the search box used to rebuild every card on the screen.
  const openLodging = useCallback(
    (item: Lodging) => setSelected(lodgingDetail(item)),
    [lodgingDetail]
  );
  const openDestination = useCallback(
    (item: Destination) => setSelected(destinationDetail(item)),
    [destinationDetail]
  );
  const closeDetail = useCallback(() => setSelected(null), []);
  const openFilters = useCallback(() => setFilterOpen(true), []);
  const closeFilters = useCallback(() => setFilterOpen(false), []);
  const showAllKinds = useCallback(() => setKind("all"), []);
  const showMore = useCallback(() => setGridLimit((limit) => limit + GRID_PAGE), []);

  const renderKindChip = useCallback<ListRenderItem<KindChipItem>>(
    ({ item }) => (
      <FilterChip
        label={t(item.labelKey)}
        selected={kind === item.key}
        onPress={() => setKind(item.key)}
      />
    ),
    [t, kind]
  );

  const renderFeatured = useCallback<ListRenderItem<Destination>>(
    ({ item }) => (
      <FeaturedCard
        dest={item}
        language={language}
        isRTL={isRTL}
        onOpen={openDestination}
      />
    ),
    [language, isRTL, openDestination]
  );

  const ratingLabel = t("rating");
  const resultsLabel = searchResults
    ? t(`resultsCount_${countForm(searchResults.total, language)}` as const).replace(
        "{n}",
        String(searchResults.total)
      )
    : "";
  // The count in words for a screen reader. It was reported as `expanded`,
  // which says a menu is open rather than that two filters are on.
  const filterLabel =
    filterCount > 0
      ? t("filtersActiveCount").replace("{n}", String(filterCount))
      : t("filters");

  // Runs on the UI thread — the JS thread being busy (queries resolving,
  // screens mounting) can no longer make the hero fade stutter.
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 140],
      [1, 0.35],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [0, 140],
      [0, -14],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenGradient />
      {/* The keyboard used to swallow the first tap on a search result — it
          only closed the keyboard, and the result needed a second tap.
          "handled" lets a tap on anything that takes taps land at once, and
          a drag of the page puts the keyboard away. The rows nested in here
          say the same for themselves: each scroll view decides on its own. */}
      <Animated.ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            // `tintColor` is iOS only; Android draws its spinner in `colors`,
            // which was left at the platform default.
            tintColor={colors.primary.deep}
            colors={[colors.primary.deep]}
            progressBackgroundColor={colors.surface.DEFAULT}
          />
        }
      >
        {/* Greeting and the filter toggle. Inside the ScrollView rather than
            pinned above it: this is an opening line, not a chrome bar, and it
            should leave the screen as soon as there is content to read. */}
        <Animated.View
          entering={FadeInDown.duration(600)}
          style={[styles.topBar, isRTL && styles.topBarRTL]}
        >
          <View style={[styles.topBarText, isRTL && styles.topBarTextRTL]}>
            <Text style={[styles.greeting, isRTL && styles.textRTL]}>
              {t(greetingKey)}
            </Text>
            <Text style={[styles.topBarTitle, isRTL && styles.textRTL]}>
              {t("exploreProvince")}
            </Text>
          </View>
          {/* Out of the search pill and up here, where it reads as a control
              over the whole screen rather than over the query. Active, it
              carries the count instead of the icon — ink on lime, never white. */}
          <Pressable
            onPress={openFilters}
            style={({ pressed }) => [
              styles.filterToggle,
              filterCount > 0 && styles.filterToggleActive,
              pressed && styles.pressed,
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={filterLabel}
          >
            {filterCount > 0 ? (
              <Text style={styles.filterToggleCount}>{filterCount}</Text>
            ) : (
              <Feather name="sliders" size={18} color={colors.ink} />
            )}
          </Pressable>
        </Animated.View>

        {/* Mini-hero header: bundled oasis imagery with the brand block
            overlaid, the inspiration's "text over landscape" opening. */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(600)}
          style={[styles.hero, headerAnimatedStyle]}
        >
          <Image
            source={generatedImages.heroOasis}
            style={styles.heroImage}
            contentFit="cover"
            transition={300}
          />
          <LinearGradient
            colors={["rgba(31,29,23,0.08)", "transparent", "rgba(31,29,23,0.62)"]}
            style={styles.heroGradient}
          />
          <View style={[styles.heroContent, isRTL && styles.heroContentRTL]}>
            <View style={[styles.eyebrowRow, isRTL && styles.eyebrowRowRTL]}>
              <Feather name="map-pin" size={12} color="#FFFFFF" />
              {/* Translated: it was a hard-coded English "EASTERN PROVINCE"
                  sitting over an otherwise Arabic hero. */}
              <Text
                style={[styles.eyebrowText, isRTL && styles.textRTL]}
                maxFontSizeMultiplier={HERO_MAX_FONT_SCALE}
              >
                {t("homeHeroEyebrow")}
              </Text>
            </View>
            <Text
              style={[styles.appName, isRTL && styles.textRTL]}
              maxFontSizeMultiplier={HERO_MAX_FONT_SCALE}
            >
              Hasio
            </Text>
            <Text
              style={[styles.subtitle, isRTL && styles.textRTL]}
              maxFontSizeMultiplier={HERO_MAX_FONT_SCALE}
            >
              {t("heroTagline")}
            </Text>
          </View>
        </Animated.View>

        {/* Search pill floats up over the hero's bottom edge. */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.searchContainer}
        >
          <SearchBar
            label={t("whereTo")}
            placeholder={t("searchHint")}
            value={searchQuery}
            onChangeText={setSearchQuery}
            isRTL={isRTL}
          />
        </Animated.View>

        {/* Everything below the search bar is data-driven, so the skeleton
            covers all of it: the kind chips, the featured rail, the stay
            banner and the grid, at their own dimensions rather than as a stack
            of list cards. */}
        <SkeletonFade
          loading={isLoading}
          skeleton={<SkeletonHomeSections isRTL={isRTL} />}
        >
        {/* Above the fork, so the same chips narrow the browse view and the
            destination half of the results.

            This row and the rail below are FlatLists with `inverted` in
            Arabic, which mirrors the order, the edge they start from, the
            direction they scroll and (for the rail) the snapping, all in one
            place. They used to reverse their arrays *and* lay them out
            row-reverse; the two cancelled, and a content container is only as
            wide as its content, so in Arabic both rows started on the left in
            English order — while the skeleton, a full-width row-reverse View,
            started on the right, and the content jumped sideways as it
            landed. `alwaysBounceHorizontal={false}`: a row that fits has
            nothing to scroll, and a swipe there should change tabs on iOS. */}
        <FlatList
          horizontal
          inverted={isRTL}
          data={kindChips}
          keyExtractor={kindChipKey}
          renderItem={renderKindChip}
          showsHorizontalScrollIndicator={false}
          alwaysBounceHorizontal={false}
          keyboardShouldPersistTaps="handled"
          style={styles.kindChipList}
          contentContainerStyle={styles.kindChips}
        />

        {searchResults ? (
          <View style={styles.searchResultsContainer}>
            {searchResults.total === 0 ? (
              <View style={styles.noResultsContainer}>
                <Image
                  source={generatedImages.emptySearch}
                  style={styles.noResultsImage}
                  contentFit="contain"
                  transition={200}
                />
                <Text style={styles.noResultsText}>
                  {/* An empty result from filters alone is a different problem
                      from an empty result for a search term, and needs a
                      different sentence — otherwise "no results for" hangs
                      with nothing after it. */}
                  {searchTerm ? t("noResults") : t("filterNoMatch")}
                </Text>
              </View>
            ) : (
              <>
                <Text style={[styles.resultsCount, isRTL && styles.textRTL]}>
                  {resultsLabel}
                </Text>

                {searchResults.lodging.length > 0 && (
                  <View style={styles.resultSection}>
                    <Text style={[styles.resultSectionTitle, isRTL && styles.textRTL]}>
                      {t("lodging")} ({searchResults.lodging.length})
                    </Text>
                    {searchResults.lodging.map((item, index) => (
                      <LodgingResult
                        key={item.id}
                        lodging={item}
                        language={language}
                        isRTL={isRTL}
                        index={index}
                        format={format}
                        ratingLabel={ratingLabel}
                        onOpen={openLodging}
                      />
                    ))}
                  </View>
                )}

                {searchResults.destinations.length > 0 && (
                  <View style={styles.resultSection}>
                    <Text style={[styles.resultSectionTitle, isRTL && styles.textRTL]}>
                      {t("destinations")} ({searchResults.destinations.length})
                    </Text>
                    {searchResults.destinations.map((item, index) => (
                      <DestinationResult
                        key={item.id}
                        dest={item}
                        language={language}
                        isRTL={isRTL}
                        index={index}
                        ratingLabel={ratingLabel}
                        onOpen={openDestination}
                      />
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        ) : (
          <>
            {/* Featured. Hidden outright when the pool is empty rather than
                headed over nothing — the empty state below speaks for it. */}
            {featured.length > 0 && (
              <>
                <View style={styles.sectionHead}>
                  <Text style={[styles.sectionEyebrow, isRTL && styles.textRTL]}>
                    {t("handpicked")}
                  </Text>
                  <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
                    {t("featuredDestinations")}
                  </Text>
                </View>

                {/* Snaps a card at a time from whichever edge the row starts
                    at: the card, the gap and the 20pt inset line up with the
                    stride in either direction. */}
                <FlatList
                  horizontal
                  inverted={isRTL}
                  data={featured}
                  keyExtractor={destinationKey}
                  renderItem={renderFeatured}
                  showsHorizontalScrollIndicator={false}
                  alwaysBounceHorizontal={false}
                  keyboardShouldPersistTaps="handled"
                  snapToInterval={HOME_RAIL_CARD_WIDTH + HOME_RAIL_GAP}
                  decelerationRate="fast"
                  contentContainerStyle={styles.rail}
                />
              </>
            )}

            {/* The one route out of this screen. It replaces the category rail
                that used to sit here with a single card in it — a rail of one
                scrolls nowhere and reads as a loading failure. Only under
                "All": under a kind chip it would advertise the one thing the
                chip just excluded. */}
            {kind === "all" && (
              <View style={styles.bannerWrapper}>
                <PressableScale
                  style={styles.banner}
                  onPress={() => onNavigateToTab?.("lodging")}
                  accessibilityRole="button"
                  accessibilityLabel={t("findYourStay")}
                >
                  <Image
                    source={generatedImages.catLodging}
                    style={styles.bannerImage}
                    contentFit="cover"
                    transition={300}
                  />
                  {/* Sideways scrim, weighted behind the text — so the stops
                      flip with the row rather than the photograph. */}
                  <LinearGradient
                    colors={
                      isRTL
                        ? ["rgba(31,29,23,0.10)", "rgba(31,29,23,0.78)"]
                        : ["rgba(31,29,23,0.78)", "rgba(31,29,23,0.10)"]
                    }
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.bannerGradient}
                  />
                  <View style={[styles.bannerRow, isRTL && styles.bannerRowRTL]}>
                    <View style={[styles.bannerText, isRTL && styles.bannerTextRTL]}>
                      <Text style={[styles.bannerEyebrow, isRTL && styles.textRTL]}>
                        {t("lodging")}
                      </Text>
                      <Text style={[styles.bannerTitle, isRTL && styles.textRTL]}>
                        {t("findYourStay")}
                      </Text>
                      <Text style={[styles.bannerSub, isRTL && styles.textRTL]}>
                        {t("stayBannerSub")}
                      </Text>
                    </View>
                    <View style={styles.bannerArrow}>
                      <Feather
                        name={isRTL ? "arrow-left" : "arrow-right"}
                        size={18}
                        color={colors.ink}
                      />
                    </View>
                  </View>
                </PressableScale>
              </View>
            )}

            {/* Everything the rail did not take — headed only when there is
                something under the heading. A pool of five or fewer used to
                show "More Destinations" and then "No destinations found"
                directly under a full rail. */}
            {rest.length > 0 && (
              <>
                <View style={styles.sectionHead}>
                  <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
                    {t("moreDestinations")}
                  </Text>
                </View>

                <View style={[styles.grid, isRTL && styles.gridRTL]}>
                  {[0, 1].map((column) => (
                    <View key={column} style={styles.gridColumn}>
                      {gridItems.map((dest, index) =>
                        index % 2 === column ? (
                          <DestinationGridCard
                            key={dest.id}
                            dest={dest}
                            language={language}
                            isRTL={isRTL}
                            tall={isTallGridCard(index)}
                            onOpen={openDestination}
                          />
                        ) : null
                      )}
                    </View>
                  ))}
                </View>

                {rest.length > gridItems.length && (
                  <Button
                    title={t("showMorePlaces")}
                    variant="outline"
                    size="sm"
                    onPress={showMore}
                    hitSlop={6}
                    style={styles.showMore}
                  />
                )}
              </>
            )}

            {/* Nothing at all to show. Under a kind chip that has emptied —
                its last place delisted while it was selected — the way back
                is right here rather than up in the chip row. */}
            {featured.length === 0 && rest.length === 0 && (
              <View style={styles.emptyStateContainer}>
                <Text style={styles.emptyStateTitle}>
                  {t("emptyDestinationsTitle")}
                </Text>
                <Text style={styles.emptyStateMessage}>
                  {kind === "all"
                    ? t("emptyDestinationsMessage")
                    : t("emptyKindMessage")}
                </Text>
                {kind !== "all" && (
                  <Button
                    title={t("seeAll")}
                    variant="outline"
                    size="sm"
                    onPress={showAllKinds}
                    hitSlop={6}
                    style={styles.emptyAction}
                  />
                )}
              </View>
            )}
          </>
        )}

        {/* Clears the docked tab bar — the results view needs it as much as
            the grid does. Inline because the height carries the bottom inset,
            which only a hook can read. */}
        <View style={{ height: bottomClearance }} />
        </SkeletonFade>
      </Animated.ScrollView>

      <ListingDetailSheet item={selected} onClose={closeDetail} />

      <FilterSheet
        visible={filterOpen}
        value={filters}
        cities={cities}
        types={lodgingTypes}
        priceBounds={priceBounds}
        onChange={setFilters}
        onClose={closeFilters}
      />
    </View>
  );
}

interface ResultRowProps {
  name: string;
  /** What reads under the name — city, price, category — without blanks. */
  details: string[];
  image?: string;
  rating: number;
  ratingLabel: string;
  isRTL: boolean;
  index: number;
  onPress: () => void;
}

/** One search result. The memoised rows below decide when it re-renders. */
function ResultRow({
  name,
  details,
  image,
  rating,
  ratingLabel,
  isRTL,
  index,
  onPress,
}: ResultRowProps) {
  const styles = useThemedStyles(makeStyles);
  const rated = rating > 0;

  return (
    // The shared entrance, capped at the seventh row. The delay used to grow
    // with the index, so the fiftieth result of a one-letter search waited
    // two and a half seconds to appear.
    <Animated.View entering={enterFade(index)}>
      <PressableScale
        style={[styles.searchResultItem, isRTL && styles.searchResultItemRTL]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={[
          name,
          ...details,
          rated ? `${ratingLabel} ${rating.toFixed(1)}` : "",
        ]
          .filter(Boolean)
          .join(", ")}
      >
        <Image
          source={image ? { uri: image } : undefined}
          style={styles.searchResultImage}
          contentFit="cover"
          transition={200}
        />
        <View style={[styles.searchResultContent, isRTL && styles.searchResultContentRTL]}>
          <Text style={[styles.searchResultName, isRTL && styles.textRTL]} numberOfLines={1}>
            {name}
          </Text>
          <View style={[styles.searchResultMetaRow, isRTL && styles.searchResultMetaRowRTL]}>
            {/* The star only beside a rating. It used to lead every line —
                a city and a price — as if that were the score. */}
            {rated && (
              <View style={[styles.searchResultRatingGroup, isRTL && styles.searchResultMetaRowRTL]}>
                <Feather name="star" size={12} color={colors.warm} />
                <Text style={styles.searchResultRating}>{rating.toFixed(1)}</Text>
              </View>
            )}
            {details.length > 0 && (
              <Text
                style={[styles.searchResultSubtitle, isRTL && styles.textRTL]}
                numberOfLines={1}
              >
                {details.join(" • ")}
              </Text>
            )}
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

interface LodgingResultProps {
  lodging: Lodging;
  language: Language;
  isRTL: boolean;
  index: number;
  format: (amountSar: number) => string;
  ratingLabel: string;
  onOpen: (lodging: Lodging) => void;
}

const LodgingResult = React.memo(function LodgingResult({
  lodging,
  language,
  isRTL,
  index,
  format,
  ratingLabel,
  onOpen,
}: LodgingResultProps) {
  // A real nightly rate, else the host's band, else nothing at all — the line
  // used to end in a dangling "•" when there was no price.
  const price =
    lodging.pricePerNight != null ? format(lodging.pricePerNight) : lodging.priceRange;
  return (
    <ResultRow
      name={getLocalizedText(lodging.name, lodging.nameAr, language)}
      details={[getLocalizedText(lodging.city, lodging.cityAr, language), price].filter(
        Boolean
      )}
      image={lodging.images?.[0]}
      rating={lodging.rating}
      ratingLabel={ratingLabel}
      isRTL={isRTL}
      index={index}
      onPress={() => onOpen(lodging)}
    />
  );
});

interface DestinationResultProps {
  dest: Destination;
  language: Language;
  isRTL: boolean;
  index: number;
  ratingLabel: string;
  onOpen: (dest: Destination) => void;
}

const DestinationResult = React.memo(function DestinationResult({
  dest,
  language,
  isRTL,
  index,
  ratingLabel,
  onOpen,
}: DestinationResultProps) {
  return (
    <ResultRow
      name={getLocalizedText(dest.name, dest.nameAr, language)}
      details={[
        getLocalizedText(dest.subtitle, dest.subtitleAr, language),
        getLocalizedText(dest.city, dest.cityAr, language),
      ].filter(Boolean)}
      image={dest.image}
      rating={dest.rating}
      ratingLabel={ratingLabel}
      isRTL={isRTL}
      index={index}
      onPress={() => onOpen(dest)}
    />
  );
});

interface DestinationCardProps {
  dest: Destination;
  language: Language;
  isRTL: boolean;
  onOpen: (dest: Destination) => void;
}

/** The rail card: the grid card's caption grammar, one size up, plus a place. */
const FeaturedCard = React.memo(function FeaturedCard({
  dest,
  language,
  isRTL,
  onOpen,
}: DestinationCardProps) {
  const styles = useThemedStyles(makeStyles);
  const name = getLocalizedText(dest.name, dest.nameAr, language);
  const subtitle = getLocalizedText(dest.subtitle, dest.subtitleAr, language);
  // Folded and in the reader's language: the rail printed the stored English
  // city — a village name, often — on an otherwise Arabic card.
  const city = getLocalizedText(dest.city, dest.cityAr, language);

  return (
    // Same wrapper/card split as the grid — see the note on `gridCardWrapper`.
    <View style={styles.railCardWrapper}>
      <PressableScale
        style={styles.railCard}
        scaleTo={CARD_PRESS_SCALE}
        onPress={() => onOpen(dest)}
        accessibilityRole="button"
        accessibilityLabel={[name, subtitle, city].filter(Boolean).join(", ")}
      >
        <Image
          source={dest.image ? { uri: dest.image } : undefined}
          style={styles.railCardImage}
          contentFit="cover"
          transition={300}
        />
        <CaptionScrim tall />

        {/* No pill rather than "0.0": an unreviewed place is not a bad one. */}
        {dest.rating > 0 && (
          <View style={[styles.gridCardRating, isRTL && styles.gridCardRatingRTL]}>
            <Feather name="star" size={11} color={colors.warm} />
            <Text style={styles.gridCardRatingText}>{dest.rating.toFixed(1)}</Text>
          </View>
        )}

        <View style={[styles.railCaption, isRTL && styles.railCaptionRTL]}>
          <View style={styles.gridCardChip}>
            <Text style={styles.gridCardChipText} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <Text
            style={[styles.railCardName, isRTL && styles.textRTL]}
            numberOfLines={2}
          >
            {name}
          </Text>
          <View style={[styles.railCityRow, isRTL && styles.railCityRowRTL]}>
            <Feather name="map-pin" size={12} color="#FFFFFF" />
            <Text
              style={[styles.railCity, isRTL && styles.textRTL]}
              numberOfLines={1}
            >
              {city}
            </Text>
          </View>
        </View>
      </PressableScale>
    </View>
  );
});

const DestinationGridCard = React.memo(function DestinationGridCard({
  dest,
  language,
  isRTL,
  tall,
  onOpen,
}: DestinationCardProps & { tall: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const name = getLocalizedText(dest.name, dest.nameAr, language);
  const subtitle = getLocalizedText(dest.subtitle, dest.subtitleAr, language);

  return (
    // Plain View: the grid arrives with the rest of the screen through
    // SkeletonFade, so a per-card entrance would animate on top of that.
    <View
      style={[
        styles.gridCardWrapper,
        { height: tall ? HOME_GRID_CARD_TALL_HEIGHT : HOME_GRID_CARD_HEIGHT },
      ]}
    >
      <PressableScale
        style={styles.gridCard}
        scaleTo={CARD_PRESS_SCALE}
        onPress={() => onOpen(dest)}
        accessibilityRole="button"
        accessibilityLabel={[name, subtitle].filter(Boolean).join(", ")}
      >
        {/* No `{ uri: "" }` for a place without a photo: that is a request
            for nothing, where `undefined` simply leaves the sand showing. */}
        <Image
          source={dest.image ? { uri: dest.image } : undefined}
          style={styles.gridCardImage}
          contentFit="cover"
          transition={300}
        />
        {/* `tall`: the name can wrap to a second line here, which pushes it
            up out of the standard scrim's strong half. */}
        <CaptionScrim tall />

        {/* Rating reads top-left, the same place and the same pill the lodging
            cards use, so the two card families scan alike — and, like them,
            not at all until someone has rated the place. */}
        {dest.rating > 0 && (
          <View style={[styles.gridCardRating, isRTL && styles.gridCardRatingRTL]}>
            <Feather name="star" size={11} color={colors.warm} />
            <Text style={styles.gridCardRatingText}>{dest.rating.toFixed(1)}</Text>
          </View>
        )}

        <View style={[styles.gridCaption, isRTL && styles.gridCaptionRTL]}>
          <View style={styles.gridCardChip}>
            <Text style={styles.gridCardChipText} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <Text
            style={[styles.gridCardName, isRTL && styles.textRTL]}
            numberOfLines={2}
          >
            {name}
          </Text>
        </View>
      </PressableScale>
    </View>
  );
});

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: CONTAINER_PADDING,
    paddingTop: 8,
  },
  topBarRTL: {
    flexDirection: "row-reverse",
  },
  topBarText: {
    flex: 1,
  },
  topBarTextRTL: {
    alignItems: "flex-end",
  },
  greeting: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.onSurface.muted,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  topBarTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontFamily: fonts.serif,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  filterToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  // The lime fill is the "on" state, so the hairline that outlined the empty
  // button would only muddy its edge.
  filterToggleActive: {
    backgroundColor: colors.primary.DEFAULT,
    borderWidth: 0,
  },
  filterToggleCount: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  hero: {
    marginHorizontal: CONTAINER_PADDING,
    marginTop: 14,
    height: 190,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: colors.sand,
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
  },
  heroGradient: {
    ...StyleSheet.absoluteFill,
  },
  heroContent: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 18,
    paddingBottom: 40,
  },
  heroContentRTL: {
    alignItems: "flex-end",
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  eyebrowRowRTL: {
    flexDirection: "row-reverse",
  },
  eyebrowText: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: "#FFFFFF",
    letterSpacing: 2,
    textTransform: "uppercase",
    opacity: 0.92,
  },
  appName: {
    fontSize: 34,
    fontFamily: fonts.serif,
    color: "#FFFFFF",
    letterSpacing: -0.3,
    lineHeight: 38,
    textShadowColor: "rgba(0, 0, 0, 0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "rgba(255, 255, 255, 0.88)",
    marginTop: 2,
    letterSpacing: 0.3,
  },
  textRTL: {
    textAlign: "right",
  },
  // Pulled up over the hero's bottom edge so the pill floats over the image.
  searchContainer: {
    paddingHorizontal: CONTAINER_PADDING + 12,
    marginTop: -30,
  },
  // Each chip carries a transparent band above and below its pill — its 44pt
  // target, see FilterChip. The row gives that space back here, so the pills
  // sit exactly where they did and where the skeleton draws them.
  kindChipList: {
    marginTop: HOME_CHIP_ROW_MARGIN_TOP - CHIP_TARGET_INSET,
    marginBottom: -CHIP_TARGET_INSET,
  },
  kindChips: {
    paddingHorizontal: CONTAINER_PADDING,
    gap: CHIP_GAP,
  },
  // Every section opens the same way: an optional eyebrow, then a serif title.
  // The line heights are set, and shared with the skeleton, rather than left
  // to the font: Cairo's natural line is nearly twice its size, so in Arabic
  // the Featured head stood ~30pt taller than the placeholder that preceded
  // it, and everything below jumped down as the data landed.
  sectionHead: {
    paddingHorizontal: CONTAINER_PADDING,
    marginTop: HOME_SECTION_MARGIN_TOP,
    marginBottom: HOME_SECTION_MARGIN_BOTTOM,
  },
  sectionEyebrow: {
    fontSize: HOME_SECTION_EYEBROW.fontSize,
    lineHeight: HOME_SECTION_EYEBROW.lineHeight,
    fontFamily: fonts.semibold,
    color: colors.primary.deep,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontSize: HOME_SECTION_TITLE.fontSize,
    lineHeight: HOME_SECTION_TITLE.lineHeight,
    fontFamily: fonts.serif,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  rail: {
    paddingHorizontal: CONTAINER_PADDING,
    gap: HOME_RAIL_GAP,
  },
  railCardWrapper: {
    width: HOME_RAIL_CARD_WIDTH,
    height: HOME_RAIL_CARD_HEIGHT,
    borderRadius: 28,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  railCard: {
    flex: 1,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: colors.sand,
  },
  railCardImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
    backgroundColor: colors.sand,
  },
  railCaption: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    alignItems: "flex-start",
  },
  railCaptionRTL: {
    alignItems: "flex-end",
  },
  railCardName: {
    alignSelf: "stretch",
    marginTop: 8,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fonts.serif,
    color: "#FFFFFF",
    letterSpacing: -0.2,
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  railCityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },
  railCityRowRTL: {
    flexDirection: "row-reverse",
  },
  railCity: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: "rgba(255, 255, 255, 0.9)",
  },
  bannerWrapper: {
    marginHorizontal: CONTAINER_PADDING,
    marginTop: 20,
    borderRadius: 24,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  banner: {
    height: HOME_STAY_BANNER_HEIGHT,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.sand,
  },
  bannerImage: {
    ...StyleSheet.absoluteFill,
  },
  bannerGradient: {
    ...StyleSheet.absoluteFill,
  },
  bannerRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    // Gap rather than a margin on the arrow: it is the same 12 on whichever
    // side the row runs, so RTL needs no variant of its own.
    gap: 12,
    padding: 18,
  },
  bannerRowRTL: {
    flexDirection: "row-reverse",
  },
  bannerText: {
    flex: 1,
    alignItems: "flex-start",
  },
  bannerTextRTL: {
    alignItems: "flex-end",
  },
  bannerEyebrow: {
    fontSize: 10.5,
    fontFamily: fonts.semibold,
    color: colors.hostingAccent,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  bannerTitle: {
    fontSize: 24,
    fontFamily: fonts.serif,
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  bannerSub: {
    fontSize: 12.5,
    fontFamily: fonts.regular,
    color: "rgba(255, 255, 255, 0.88)",
  },
  bannerArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary.DEFAULT,
  },
  // Two columns side by side, each a stack of cards. The first column holds
  // the first card, so in Arabic it is the right-hand one.
  grid: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: CONTAINER_PADDING,
    gap: CARD_GAP,
  },
  gridRTL: {
    flexDirection: "row-reverse",
  },
  gridColumn: {
    width: CARD_WIDTH,
    gap: CARD_GAP,
  },
  showMore: {
    alignSelf: "center",
    marginTop: 20,
  },
  // The shadow lives here, on a wrapper that does not clip. Putting it on the
  // same view as `overflow: "hidden"` drops it entirely on iOS, and on Android
  // the elevation shadow ignores the card's animated opacity — so while a card
  // faded in from the skeleton, a full-strength shadow sat under a
  // half-transparent card and read as a dark halo on the photo. The radius is
  // repeated so Android shapes the shadow to the rounded card.
  gridCardWrapper: {
    width: CARD_WIDTH,
    borderRadius: 24,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  gridCard: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.sand,
  },
  gridCardImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  gridCardRating: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  gridCardRatingRTL: {
    left: undefined,
    right: 10,
    flexDirection: "row-reverse",
  },
  gridCardRatingText: {
    fontSize: 11.5,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  // Same block as the lodging card, sized for a column half the width: the
  // inset drops 16 -> 12 and the title 20 -> 17, and the title takes two lines
  // because at this width one truncates most Eastern Province place names.
  gridCaption: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 14,
    alignItems: "flex-start",
  },
  gridCaptionRTL: {
    alignItems: "flex-end",
  },
  gridCardChip: {
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  gridCardChipText: {
    fontSize: 10.5,
    lineHeight: 13,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  gridCardName: {
    alignSelf: "stretch",
    marginTop: 7,
    fontSize: 17,
    lineHeight: 23,
    fontFamily: fonts.serif,
    color: "#FFFFFF",
    letterSpacing: -0.2,
    textShadowColor: "rgba(0, 0, 0, 0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  // Starts below the chips' target band rather than over it — as the later
  // sibling it would sit on top and take their touches — with the same 16pt
  // to its text as before.
  searchResultsContainer: {
    paddingHorizontal: CONTAINER_PADDING,
    marginTop: CHIP_TARGET_INSET,
    paddingTop: 16 - CHIP_TARGET_INSET,
  },
  resultsCount: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.primary.deep,
    marginBottom: 20,
  },
  noResultsContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  noResultsImage: {
    width: 140,
    height: 140,
    marginBottom: 12,
  },
  noResultsText: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
    textAlign: "center",
  },
  resultSection: {
    marginBottom: 24,
  },
  resultSectionTitle: {
    fontSize: 22,
    fontFamily: fonts.serif,
    color: colors.ink,
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  // A hairline instead of a shadow: a results list is a stack of rows, and a
  // dozen shadows on the cream ground read as fog rather than as depth.
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 10,
  },
  searchResultItemRTL: {
    flexDirection: "row-reverse",
  },
  searchResultImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.sand,
  },
  searchResultContent: {
    flex: 1,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  searchResultContentRTL: {
    alignItems: "flex-end",
  },
  searchResultName: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.ink,
    marginBottom: 4,
  },
  // `gap` rather than a margin on either piece: the same on whichever side
  // the row runs.
  searchResultMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchResultMetaRowRTL: {
    flexDirection: "row-reverse",
  },
  searchResultRatingGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  searchResultRating: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  // Shrinks rather than pushing the row out of the card on a long line.
  searchResultSubtitle: {
    flexShrink: 1,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
  },
  // Centred in either language, so its text is centred too — it used to be
  // pushed right in Arabic inside a centred block.
  // Clear of the chips' target band for the same reason as the results.
  emptyStateContainer: {
    paddingHorizontal: 24,
    marginTop: CHIP_TARGET_INSET,
    paddingTop: 40 - CHIP_TARGET_INSET,
    alignItems: "center",
  },
  emptyStateTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.ink,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateMessage: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
    textAlign: "center",
  },
  emptyAction: {
    marginTop: 18,
  },
});
