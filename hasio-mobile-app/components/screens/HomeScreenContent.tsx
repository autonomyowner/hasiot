import React, { useState, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useLanguage, getLocalizedText } from "@/hooks/useLanguage";
import { useCurrency } from "@/hooks/useCurrency";
import { useCities, useHomeData } from "@/hooks/useConvexData";
import {
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
import { categoryColors, colors, type AppFonts } from "@/constants/colors";
import { CaptionScrim, ScreenGradient } from "@/components/ui/Gradients";
import { useThemedStyles } from "@/hooks/useAppFonts";
import {
  HOME_CARD_GAP,
  HOME_CARD_WIDTH,
  HOME_CONTAINER_PADDING,
  HOME_RAIL_CARD_HEIGHT,
  HOME_RAIL_CARD_WIDTH,
  HOME_RAIL_GAP,
  HOME_STAY_BANNER_HEIGHT,
  TAB_BAR_CLEARANCE,
} from "@/constants/layout";
import { generatedImages } from "@/assets/images/generated";
import {
  ListingDetailSheet,
  type DetailItem,
} from "@/components/listing/ListingDetailSheet";
import type { TranslationKey } from "@/constants/translations";
import type { Lodging } from "@/types";
import type { TabKey } from "@/app/(tabs)/_layout";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// Shared with the skeleton that stands in for this screen while it loads.
const CARD_GAP = HOME_CARD_GAP;
const CONTAINER_PADDING = HOME_CONTAINER_PADDING;
const CARD_WIDTH = HOME_CARD_WIDTH;

// What the destination chips filter on. "all" is not a kind any row carries,
// which is why it lives in the chip union and not in this one.
type DestinationKind = "attraction" | "tour" | "event";
type KindChip = "all" | DestinationKind;

// Chip order, and the key each kind reads under — "Places" rather than
// "Attractions" is a decision that belongs in the translations, not here.
const KIND_CHIPS: { key: DestinationKind; labelKey: TranslationKey }[] = [
  { key: "attraction", labelKey: "attractions" },
  { key: "tour", labelKey: "tours" },
  { key: "event", labelKey: "events" },
];

// How many cards the featured rail holds. Small on purpose: past five the rail
// stops being a selection and becomes the grid again, sideways.
const FEATURED_COUNT = 5;

interface HomeScreenContentProps {
  onNavigateToTab?: (key: TabKey) => void;
}

export function HomeScreenContent({ onNavigateToTab }: HomeScreenContentProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
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
  const { cities } = useCities();

  const [filters, setFilters] = useState<HomeFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterCount = activeFilterCount(filters);
  const [kind, setKind] = useState<KindChip>("all");

  // Filters narrow the whole screen, not just the search results — otherwise
  // setting one and then clearing the query would silently drop it.
  const allLodging = useMemo(
    () =>
      lodgings.filter(
        (item) =>
          (!filters.type || item.type === filters.type) &&
          (!filters.city || item.city === filters.city) &&
          (!filters.price || item.priceRange === filters.price)
      ),
    [lodgings, filters]
  );

  // A destination has no type or price of its own, so those two filters
  // exclude destinations entirely rather than matching everything: asking for
  // "$$ hotels" and being shown a set of parks is not a filter working. The
  // kind chips are a separate axis and narrow only this half.
  const destinations = useMemo(
    () =>
      filters.type || filters.price
        ? []
        : allDestinations.filter(
            (item) =>
              (!filters.city || item.city === filters.city) &&
              (kind === "all" || item.kind === kind)
          ),
    [allDestinations, filters, kind]
  );

  // Only the lodging types actually present, so the sheet never offers a
  // filter that can only ever return nothing.
  const lodgingTypes = useMemo(
    () => Array.from(new Set(lodgings.map((l) => l.type))).sort(),
    [lodgings]
  );

  // Same rule for the kind chips, off the unfiltered pool: which kinds exist
  // is a fact about the data, not about what is currently selected.
  const kindChips = useMemo<{ key: KindChip; labelKey: TranslationKey }[]>(() => {
    const present = new Set(allDestinations.map((item) => item.kind));
    return [
      { key: "all", labelKey: "all" },
      ...KIND_CHIPS.filter((chip) => present.has(chip.key)),
    ];
  }, [allDestinations]);

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

  // One results view for a query, for a set of filters, or for both. The
  // lists arriving here are already filtered, so this only applies the text
  // match — and when there is no query it applies nothing, which is what makes
  // filters alone able to drive the results view.
  const searchResults = useMemo(() => {
    const query = debouncedQuery.trim().toLowerCase();
    if (!query && filterCount === 0) return null;

    const lodgingResults = query
      ? allLodging.filter(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.nameAr.includes(query) ||
            item.city.toLowerCase().includes(query) ||
            item.cityAr.includes(query)
        )
      : allLodging;

    const destinationResults = query
      ? destinations.filter(
          (item) =>
            item.name.toLowerCase().includes(query) ||
            item.nameAr.includes(query) ||
            item.subtitle.toLowerCase().includes(query) ||
            item.subtitleAr.includes(query)
        )
      : destinations;

    return {
      lodging: lodgingResults,
      destinations: destinationResults,
      total: lodgingResults.length + destinationResults.length,
    };
  }, [debouncedQuery, filterCount, allLodging, destinations]);

  const [selected, setSelected] = useState<DetailItem | null>(null);

  // Home shows stays and destinations side by side, so each gets its own
  // mapping into the shared sheet's shape. Same normalising the list screens
  // do — done here so the sheet never has to know what it is showing.
  const lodgingDetail = (item: Lodging): DetailItem => ({
    id: item.id,
    title: getLocalizedText(item.name, item.nameAr, language),
    subtitle: getLocalizedText(item.city, item.cityAr, language),
    badge: t(`cat_${item.type}` as const),
    badgeColor: categoryColors[item.type],
    rating: item.rating,
    // A real nightly rate wins over the "$$$" band — see LodgingScreenContent.
    priceLine: item.pricePerNight
      ? `${format(item.pricePerNight)} ${t("perNight")}`
      : item.priceRange
        ? `${item.priceRange} ${t("perNight")}`
        : undefined,
    // Only a listing the host has actually priced can be booked — see the same
    // note in LodgingScreenContent.
    bookable: item.pricePerNight != null,
    maxGuests: item.maxGuests,
    images: item.images,
    description: getLocalizedText(item.description, item.descriptionAr, language),
    amenities: language === "ar" ? item.amenitiesAr : item.amenities,
    details: item.details,
    ownerId: item.owner_id,
  });

  // Destinations come straight off `useDestinations` rather than from a shared
  // type, so this one is structural.
  const destinationDetail = (
    item: (typeof destinations)[number]
  ): DetailItem => ({
    id: item.id,
    title: getLocalizedText(item.name, item.nameAr, language),
    subtitle: getLocalizedText(item.subtitle, item.subtitleAr, language),
    rating: item.rating,
    images: item.images?.length ? item.images : item.image ? [item.image] : [],
    description: getLocalizedText(item.description, item.descriptionAr, language),
    details: item.details,
    ownerId: item.owner_id,
  });

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
      <Animated.ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary.deep}
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
              {t("exploreAlAhsa")}
            </Text>
          </View>
          {/* Out of the search pill and up here, where it reads as a control
              over the whole screen rather than over the query. Active, it
              carries the count instead of the icon — ink on lime, never white. */}
          <Pressable
            onPress={() => setFilterOpen(true)}
            style={[
              styles.filterToggle,
              filterCount > 0 && styles.filterToggleActive,
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("filters")}
            accessibilityState={{ expanded: filterCount > 0 }}
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
              <Text style={[styles.eyebrowText, isRTL && styles.textRTL]}>
                AL-AHSA OASIS
              </Text>
            </View>
            <Text style={[styles.appName, isRTL && styles.textRTL]}>
              Hasio
            </Text>
            <Text style={[styles.subtitle, isRTL && styles.textRTL]}>
              {t("exploreOasis")}
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
            destination half of the results. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.kindChips,
            isRTL && styles.kindChipsRTL,
          ]}
        >
          {(isRTL ? [...kindChips].reverse() : kindChips).map((chip) => (
            <FilterChip
              key={chip.key}
              label={t(chip.labelKey)}
              selected={kind === chip.key}
              onPress={() => setKind(chip.key)}
            />
          ))}
        </ScrollView>

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
                <Text style={[styles.noResultsText, isRTL && styles.textRTL]}>
                  {/* An empty result from filters alone is a different problem
                      from an empty result for a search term, and needs a
                      different sentence — otherwise "no results for" hangs
                      with nothing after it. */}
                  {debouncedQuery.trim() ? t("noResults") : t("filterNoMatch")}
                </Text>
              </View>
            ) : (
              <>
                <Text style={[styles.resultsCount, isRTL && styles.textRTL]}>
                  {searchResults.total} {t("resultsFound")}
                </Text>

                {searchResults.lodging.length > 0 && (
                  <View style={styles.resultSection}>
                    <Text style={[styles.resultSectionTitle, isRTL && styles.textRTL]}>
                      {t("lodging")} ({searchResults.lodging.length})
                    </Text>
                    {searchResults.lodging.map((item, index) => (
                      <SearchResultItem
                        key={item.id}
                        name={getLocalizedText(item.name, item.nameAr, language)}
                        subtitle={`${getLocalizedText(item.city, item.cityAr, language)} • ${
                          item.pricePerNight != null
                            ? format(item.pricePerNight)
                            : item.priceRange
                        }`}
                        image={item.images?.[0]}
                        isRTL={isRTL}
                        index={index}
                        onPress={() => setSelected(lodgingDetail(item))}
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
                      <SearchResultItem
                        key={item.id}
                        name={getLocalizedText(item.name, item.nameAr, language)}
                        subtitle={getLocalizedText(item.subtitle, item.subtitleAr, language)}
                        image={item.image}
                        isRTL={isRTL}
                        index={index}
                        onPress={() => setSelected(destinationDetail(item))}
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
                headed over nothing — the grid below owns the empty state. */}
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

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={HOME_RAIL_CARD_WIDTH + HOME_RAIL_GAP}
                  decelerationRate="fast"
                  contentContainerStyle={[styles.rail, isRTL && styles.railRTL]}
                >
                  {(isRTL ? [...featured].reverse() : featured).map((dest) => (
                    <FeaturedCard
                      key={dest.id}
                      name={getLocalizedText(dest.name, dest.nameAr, language)}
                      subtitle={getLocalizedText(
                        dest.subtitle,
                        dest.subtitleAr,
                        language
                      )}
                      city={dest.city}
                      image={dest.image}
                      rating={dest.rating}
                      isRTL={isRTL}
                      onPress={() => setSelected(destinationDetail(dest))}
                    />
                  ))}
                </ScrollView>
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

            {/* Everything the rail did not take. */}
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
                {t("moreDestinations")}
              </Text>
            </View>

            {rest.length > 0 ? (
              <View style={[styles.gridContainer, isRTL && styles.gridContainerRTL]}>
                {rest.map((dest, index) => (
                  <DestinationGridCard
                    key={dest.id}
                    name={getLocalizedText(dest.name, dest.nameAr, language)}
                    subtitle={getLocalizedText(
                      dest.subtitle,
                      dest.subtitleAr,
                      language
                    )}
                    image={dest.image}
                    rating={dest.rating}
                    isRTL={isRTL}
                    isTall={index % 3 === 1}
                    onPress={() => setSelected(destinationDetail(dest))}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyStateContainer}>
                <Text style={[styles.emptyStateTitle, isRTL && styles.textRTL]}>
                  {t("emptyDestinationsTitle")}
                </Text>
                <Text style={[styles.emptyStateMessage, isRTL && styles.textRTL]}>
                  {t("emptyDestinationsMessage")}
                </Text>
              </View>
            )}
          </>
        )}

        {/* Clears the docked tab bar — the results view needs it as much as
            the grid does. */}
        <View style={styles.bottomSpacing} />
        </SkeletonFade>
      </Animated.ScrollView>

      <ListingDetailSheet item={selected} onClose={() => setSelected(null)} />

      <FilterSheet
        visible={filterOpen}
        value={filters}
        cities={cities}
        types={lodgingTypes}
        onChange={setFilters}
        onClose={() => setFilterOpen(false)}
      />
    </View>
  );
}

interface SearchResultItemProps {
  name: string;
  subtitle: string;
  image: string;
  isRTL: boolean;
  index: number;
  onPress?: () => void;
}

function SearchResultItem({ name, subtitle, image, isRTL, index, onPress }: SearchResultItemProps) {
  const styles = useThemedStyles(makeStyles);
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

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
      <AnimatedPressable
        style={[styles.searchResultItem, isRTL && styles.searchResultItemRTL, animatedStyle]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${subtitle}`}
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
            <Feather name="star" size={12} color={colors.warm} />
            <Text style={[styles.searchResultSubtitle, isRTL && styles.textRTL]} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

interface FeaturedCardProps {
  name: string;
  subtitle: string;
  city: string;
  image: string;
  rating?: number;
  isRTL: boolean;
  onPress?: () => void;
}

/** The rail card: the grid card's caption grammar, one size up, plus a place. */
function FeaturedCard({
  name,
  subtitle,
  city,
  image,
  rating,
  isRTL,
  onPress,
}: FeaturedCardProps) {
  const styles = useThemedStyles(makeStyles);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    // Same wrapper/card split as the grid — see the note on `gridCardWrapper`.
    <View style={styles.railCardWrapper}>
      <AnimatedPressable
        style={[styles.railCard, animatedStyle]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${subtitle}, ${city}`}
      >
        <Image
          source={image ? { uri: image } : undefined}
          style={styles.railCardImage}
          contentFit="cover"
          transition={300}
        />
        <CaptionScrim tall />

        {/* No pill rather than "0.0": an unreviewed place is not a bad one. */}
        {rating != null && rating > 0 && (
          <View style={[styles.gridCardRating, isRTL && styles.gridCardRatingRTL]}>
            <Feather name="star" size={11} color={colors.warm} />
            <Text style={styles.gridCardRatingText}>{rating.toFixed(1)}</Text>
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
      </AnimatedPressable>
    </View>
  );
}

interface DestinationGridCardProps {
  name: string;
  subtitle: string;
  image: string;
  rating?: number;
  isRTL: boolean;
  isTall?: boolean;
  onPress?: () => void;
}

function DestinationGridCard({
  name,
  subtitle,
  image,
  rating,
  isRTL,
  isTall = false,
  onPress,
}: DestinationGridCardProps) {
  const styles = useThemedStyles(makeStyles);
  const scale = useSharedValue(1);
  const cardHeight = isTall ? 260 : 210;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    // Plain View: the grid arrives with the rest of the screen through
    // SkeletonFade, so a per-card entrance would animate on top of that.
    <View style={[styles.gridCardWrapper, { height: cardHeight }]}>
      <AnimatedPressable
        style={[styles.gridCard, animatedStyle]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${subtitle}`}
      >
        <Image
          source={{ uri: image }}
          style={styles.gridCardImage}
          contentFit="cover"
          transition={300}
        />
        {/* `tall`: the name can wrap to a second line here, which pushes it
            up out of the standard scrim's strong half. */}
        <CaptionScrim tall />

        {/* Rating reads top-left, the same place and the same pill the lodging
            cards use, so the two card families scan alike. */}
        {rating != null && (
          <View style={[styles.gridCardRating, isRTL && styles.gridCardRatingRTL]}>
            <Feather name="star" size={11} color={colors.warm} />
            <Text style={styles.gridCardRatingText}>{rating.toFixed(1)}</Text>
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
      </AnimatedPressable>
    </View>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
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
    ...StyleSheet.absoluteFillObject,
  },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
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
  kindChips: {
    paddingHorizontal: CONTAINER_PADDING,
    marginTop: 18,
  },
  kindChipsRTL: {
    flexDirection: "row-reverse",
  },
  // Every section opens the same way: an optional eyebrow, then a serif title.
  sectionHead: {
    paddingHorizontal: CONTAINER_PADDING,
    marginTop: 24,
    marginBottom: 14,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.primary.deep,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  sectionTitle: {
    fontSize: 26,
    fontFamily: fonts.serif,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  rail: {
    paddingHorizontal: CONTAINER_PADDING,
    gap: HOME_RAIL_GAP,
  },
  railRTL: {
    flexDirection: "row-reverse",
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
    ...StyleSheet.absoluteFillObject,
  },
  bannerGradient: {
    ...StyleSheet.absoluteFillObject,
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
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: CONTAINER_PADDING,
    gap: CARD_GAP,
  },
  gridContainerRTL: {
    flexDirection: "row-reverse",
  },
  // The shadow lives here, on a wrapper that does not clip. Putting it on the
  // same view as `overflow: "hidden"` drops it entirely on iOS, and on Android
  // the elevation shadow ignores the card's animated opacity — so while a card
  // faded in from the skeleton, a full-strength shadow sat under a
  // half-transparent card and read as a dark halo on the photo. The radius is
  // repeated so Android shapes the shadow to the rounded card.
  gridCardWrapper: {
    width: CARD_WIDTH,
    marginBottom: 0,
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
  // because at this width one truncates most Al-Ahsa place names.
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
  bottomSpacing: {
    height: TAB_BAR_CLEARANCE,
  },
  searchResultsContainer: {
    paddingHorizontal: CONTAINER_PADDING,
    paddingTop: 16,
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
  searchResultMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  searchResultMetaRowRTL: {
    flexDirection: "row-reverse",
  },
  searchResultSubtitle: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
  },
  emptyStateContainer: {
    paddingHorizontal: 24,
    paddingTop: 40,
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
});
