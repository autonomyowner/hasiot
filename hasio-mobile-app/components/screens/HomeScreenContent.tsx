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
import { useCities, useHomeData } from "@/hooks/useConvexData";
import {
  SearchBar,
  CategoryCard,
  FilterSheet,
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
  TAB_BAR_CLEARANCE,
} from "@/constants/layout";
import { generatedImages } from "@/assets/images/generated";
import {
  ListingDetailSheet,
  type DetailItem,
} from "@/components/listing/ListingDetailSheet";
import type { Lodging } from "@/types";
import type { TabKey } from "@/app/(tabs)/_layout";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// Shared with the skeleton that stands in for this screen while it loads.
const CARD_GAP = HOME_CARD_GAP;
const CONTAINER_PADDING = HOME_CONTAINER_PADDING;
const CARD_WIDTH = HOME_CARD_WIDTH;

interface HomeScreenContentProps {
  onNavigateToTab?: (key: TabKey) => void;
}

export function HomeScreenContent({ onNavigateToTab }: HomeScreenContentProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t, language, isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useSharedValue(0);

  const onRefresh = () => {
    setRefreshing(true);
    // Convex queries auto-update via subscriptions; brief visual feedback
    setTimeout(() => setRefreshing(false), 800);
  };

  // Bundled AI-generated imagery — no network fetch, renders instantly.
  const categoryCards = [
    {
      id: "lodging",
      title: t("discoverLodging"),
      subtitle: t("lodging"),
      image: generatedImages.catLodging,
      tabKey: "lodging" as const,
    },
  ];

  // Get data from Convex with fallback to mock data
  const { lodgings, destinations: allDestinations, isLoading } = useHomeData();
  const { cities } = useCities();

  const [filters, setFilters] = useState<HomeFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterCount = activeFilterCount(filters);

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
  // "$$ hotels" and being shown a set of parks is not a filter working.
  const destinations = useMemo(
    () =>
      filters.type || filters.price
        ? []
        : allDestinations.filter((item) => !filters.city || item.city === filters.city),
    [allDestinations, filters]
  );

  // Only the lodging types actually present, so the sheet never offers a
  // filter that can only ever return nothing.
  const lodgingTypes = useMemo(
    () => Array.from(new Set(lodgings.map((l) => l.type))).sort(),
    [lodgings]
  );

  const featuredItems = destinations.filter((d) => d.featured);
  const moreDestinations = destinations.filter((d) => !d.featured);

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
      ? `${t("sar")} ${item.pricePerNight} ${t("perNight")}`
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
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChangeText={setSearchQuery}
            isRTL={isRTL}
            onFilterPress={() => setFilterOpen(true)}
            filterCount={filterCount}
          />
        </Animated.View>

        {/* Everything below the search bar is data-driven, so the skeleton
            covers all of it: the category rail and both destination grids, at
            their own dimensions rather than as a stack of list cards. */}
        <SkeletonFade
          loading={isLoading}
          skeleton={<SkeletonHomeSections isRTL={isRTL} />}
        >
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
                        subtitle={`${getLocalizedText(item.city, item.cityAr, language)} • ${item.priceRange}`}
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
            {/* Category Cards. These sections used to drop in one after another;
                SkeletonFade now cross-fades the lot, and a slide underneath a
                fading placeholder only fights it. */}
        <View style={styles.section}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.categoryCardsContainer,
              isRTL && styles.categoryCardsContainerRTL,
            ]}
          >
            {(isRTL ? [...categoryCards].reverse() : categoryCards).map(
              (card) => (
                <CategoryCard
                  key={card.id}
                  title={card.title}
                  subtitle={card.subtitle}
                  imageUrl={card.image}
                  onPress={() => onNavigateToTab?.(card.tabKey)}
                  isRTL={isRTL}
                />
              )
            )}
          </ScrollView>
        </View>

        {/* Featured Destinations - 2 Column Grid */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
            <Text
              style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}
            >
              {t("featuredDestinations")}
            </Text>
          </View>

          {featuredItems.length > 0 ? (
            <View style={[styles.gridContainer, isRTL && styles.gridContainerRTL]}>
              {featuredItems.map((dest, index) => (
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
                  isTall={index % 3 === 0}
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
        </View>

        {/* More Destinations - 2 Column Grid */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
            <Text
              style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}
            >
              {t("moreDestinations")}
            </Text>
          </View>

          {moreDestinations.length > 0 ? (
            <View style={[styles.gridContainer, isRTL && styles.gridContainerRTL]}>
              {moreDestinations.map((dest, index) => (
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
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
          </>
        )}
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
  hero: {
    marginHorizontal: CONTAINER_PADDING,
    marginTop: 12,
    height: 176,
    borderRadius: 24,
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
  rowRTL: {
    flexDirection: "row-reverse",
  },
  // Pulled up over the hero's bottom edge so the pill floats over the image.
  searchContainer: {
    paddingHorizontal: CONTAINER_PADDING + 14,
    marginTop: -26,
    paddingBottom: 4,
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: CONTAINER_PADDING,
    marginBottom: 12,
  },
  sectionHeaderRTL: {
    flexDirection: "row-reverse",
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.ink,
    letterSpacing: -0.2,
  },
  sectionTitleRTL: {
    textAlign: "right",
  },
  categoryCardsContainer: {
    paddingHorizontal: CONTAINER_PADDING,
  },
  categoryCardsContainerRTL: {
    flexDirection: "row-reverse",
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
  gridCardWrapper: {
    width: CARD_WIDTH,
    marginBottom: 0,
  },
  gridCard: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.sand,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
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
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.ink,
    marginBottom: 12,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 20,
    padding: 10,
    marginBottom: 10,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchResultItemRTL: {
    flexDirection: "row-reverse",
  },
  searchResultImage: {
    width: 62,
    height: 62,
    borderRadius: 14,
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
  loadingContainer: {
    paddingTop: 40,
    alignItems: "center",
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
