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
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useLanguage, getLocalizedText } from "@/hooks/useLanguage";
import { useHomeData } from "@/hooks/useConvexData";
import {
  SearchBar,
  CategoryCard,
  SkeletonFade,
  SkeletonHomeSections,
} from "@/components/ui";
import { categoryColors, colors, fonts } from "@/constants/colors";
import {
  HOME_CARD_GAP,
  HOME_CARD_WIDTH,
  HOME_CONTAINER_PADDING,
} from "@/constants/layout";
import {
  ListingDetailSheet,
  type DetailItem,
} from "@/components/listing/ListingDetailSheet";
import type { Food, Lodging, Event } from "@/types";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// Shared with the skeleton that stands in for this screen while it loads.
const CARD_GAP = HOME_CARD_GAP;
const CONTAINER_PADDING = HOME_CONTAINER_PADDING;
const CARD_WIDTH = HOME_CARD_WIDTH;

interface HomeScreenContentProps {
  onNavigateToTab?: (index: number) => void;
}

export function HomeScreenContent({ onNavigateToTab }: HomeScreenContentProps) {
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

  const categoryCards = [
    {
      id: "lodging",
      title: t("discoverLodging"),
      subtitle: t("lodging"),
      image:
        "https://pub-d7fc967a0d9e4e42bba0d712e4f9b96e.r2.dev/lodging/intercontinental-aea218dd.webp",
      tabIndex: 1,
    },
    {
      id: "food",
      title: t("exploreFoodDrinks"),
      subtitle: t("food"),
      image:
        "https://pub-d7fc967a0d9e4e42bba0d712e4f9b96e.r2.dev/food/traditional-restaurant-7f7a7b7f.webp",
      tabIndex: 2,
    },
    {
      id: "events",
      title: t("findEvents"),
      subtitle: t("events"),
      image:
        "https://pub-d7fc967a0d9e4e42bba0d712e4f9b96e.r2.dev/events/date-festival-0ae96b03.jpg",
      tabIndex: 3,
    },
  ];

  // Get data from Convex with fallback to mock data
  const { lodgings, foods, events, destinations, isLoading } = useHomeData();

  const featuredItems = destinations.filter((d) => d.featured);
  const moreDestinations = destinations.filter((d) => !d.featured);

  // Use Convex data (with mock fallback)
  const allLodging = lodgings;
  const allFood = foods;
  const allEvents = events;

  // Search functionality
  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) return null;

    const query = debouncedQuery.toLowerCase();

    const lodgingResults = allLodging.filter((item) =>
      item.name.toLowerCase().includes(query) ||
      item.nameAr.includes(query) ||
      item.city.toLowerCase().includes(query) ||
      item.cityAr.includes(query)
    );

    const foodResults = allFood.filter((item) =>
      item.name.toLowerCase().includes(query) ||
      item.nameAr.includes(query) ||
      item.cuisine.toLowerCase().includes(query) ||
      item.cuisineAr.includes(query)
    );

    const eventResults = allEvents.filter((item) =>
      item.title.toLowerCase().includes(query) ||
      item.titleAr.includes(query) ||
      item.location.toLowerCase().includes(query) ||
      item.locationAr.includes(query)
    );

    const destinationResults = destinations.filter((item) =>
      item.name.toLowerCase().includes(query) ||
      item.nameAr.includes(query) ||
      item.subtitle.toLowerCase().includes(query) ||
      item.subtitleAr.includes(query)
    );

    return {
      lodging: lodgingResults,
      food: foodResults,
      events: eventResults,
      destinations: destinationResults,
      total: lodgingResults.length + foodResults.length + eventResults.length + destinationResults.length,
    };
  }, [debouncedQuery, allLodging, allFood, allEvents, destinations]);

  const [selected, setSelected] = useState<DetailItem | null>(null);

  // Home shows all four kinds of listing side by side, so each gets its own
  // mapping into the shared sheet's shape. Same normalising the three list
  // screens do — done here so the sheet never has to know what it is showing.
  const lodgingDetail = (item: Lodging): DetailItem => ({
    id: item.id,
    title: getLocalizedText(item.name, item.nameAr, language),
    subtitle: getLocalizedText(item.city, item.cityAr, language),
    badge: t(`cat_${item.type}` as const),
    badgeColor: categoryColors[item.type],
    rating: item.rating,
    priceLine: item.priceRange ? `${item.priceRange} ${t("perNight")}` : undefined,
    images: item.images,
    description: getLocalizedText(item.description, item.descriptionAr, language),
    amenities: language === "ar" ? item.amenitiesAr : item.amenities,
    details: item.details,
    ownerId: item.owner_id,
  });

  const foodDetail = (item: Food): DetailItem => ({
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

  const eventDetail = (item: Event): DetailItem => ({
    id: item.id,
    title: getLocalizedText(item.title, item.titleAr, language),
    subtitle: getLocalizedText(item.location, item.locationAr, language),
    badge: t(`cat_${item.category}` as const),
    badgeColor: categoryColors[item.category],
    priceLine: [item.date, item.time].filter(Boolean).join(" • ") || undefined,
    images: item.images,
    description: getLocalizedText(item.description, item.descriptionAr, language),
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

  const handleScroll = (event: any) => {
    scrollY.value = event.nativeEvent.contentOffset.y;
  };

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 100],
      [1, 0],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [0, 100],
      [0, -20],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary.DEFAULT}
          />
        }
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(600)}
          style={[styles.header, isRTL && styles.headerRTL, headerAnimatedStyle]}
        >
          <View style={[styles.eyebrowRow, isRTL && styles.eyebrowRowRTL]}>
            <Feather name="map-pin" size={13} color={colors.primary.DEFAULT} />
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
        </Animated.View>

        {/* Search Bar */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.searchContainer}
        >
          <SearchBar
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChangeText={setSearchQuery}
            isRTL={isRTL}
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
                <Text style={[styles.noResultsText, isRTL && styles.textRTL]}>
                  {t("noResults")}
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

                {searchResults.food.length > 0 && (
                  <View style={styles.resultSection}>
                    <Text style={[styles.resultSectionTitle, isRTL && styles.textRTL]}>
                      {t("food")} ({searchResults.food.length})
                    </Text>
                    {searchResults.food.map((item, index) => (
                      <SearchResultItem
                        key={item.id}
                        name={getLocalizedText(item.name, item.nameAr, language)}
                        subtitle={getLocalizedText(item.cuisine, item.cuisineAr, language)}
                        image={item.images?.[0]}
                        isRTL={isRTL}
                        index={index}
                        onPress={() => setSelected(foodDetail(item))}
                      />
                    ))}
                  </View>
                )}

                {searchResults.events.length > 0 && (
                  <View style={styles.resultSection}>
                    <Text style={[styles.resultSectionTitle, isRTL && styles.textRTL]}>
                      {t("events")} ({searchResults.events.length})
                    </Text>
                    {searchResults.events.map((item, index) => (
                      <SearchResultItem
                        key={item.id}
                        name={getLocalizedText(item.title, item.titleAr, language)}
                        subtitle={`${getLocalizedText(item.location, item.locationAr, language)} • ${item.date}`}
                        image={item.images?.[0]}
                        isRTL={isRTL}
                        index={index}
                        onPress={() => setSelected(eventDetail(item))}
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
                  onPress={() => onNavigateToTab?.(card.tabIndex)}
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
            <Text style={styles.seeAllLink}>{t("seeAll")}</Text>
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
            <Text style={styles.seeAllLink}>{t("seeAll")}</Text>
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
      </ScrollView>

      <ListingDetailSheet item={selected} onClose={() => setSelected(null)} />
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
  isRTL: boolean;
  isTall?: boolean;
  onPress?: () => void;
}

function DestinationGridCard({
  name,
  subtitle,
  image,
  isRTL,
  isTall = false,
  onPress,
}: DestinationGridCardProps) {
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
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.75)"]}
          style={styles.gridCardGradient}
        />
        <View
          style={[
            styles.gridCardContent,
            isRTL && styles.gridCardContentRTL,
          ]}
        >
          <Text style={[styles.gridCardName, isRTL && styles.textRTL]}>
            {name}
          </Text>
          <View style={styles.gridCardDivider} />
          <Text style={[styles.gridCardSubtitle, isRTL && styles.textRTL]}>
            {subtitle}
          </Text>
        </View>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: CONTAINER_PADDING,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerRTL: {
    alignItems: "flex-end",
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  eyebrowRowRTL: {
    flexDirection: "row-reverse",
  },
  eyebrowText: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: colors.primary.DEFAULT,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  appName: {
    fontSize: 30,
    fontFamily: fonts.serif,
    color: colors.ink,
    letterSpacing: -0.3,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 17,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  textRTL: {
    textAlign: "right",
  },
  searchContainer: {
    paddingHorizontal: CONTAINER_PADDING,
    paddingVertical: 12,
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
  seeAllLink: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.primary.DEFAULT,
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
  gridCardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  gridCardContent: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 14,
  },
  gridCardContentRTL: {
    alignItems: "flex-end",
  },
  gridCardName: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: "#FFFFFF",
    letterSpacing: -0.3,
    lineHeight: 22,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  gridCardDivider: {
    width: 22,
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    marginVertical: 5,
    borderRadius: 1,
  },
  gridCardSubtitle: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: "rgba(255, 255, 255, 0.95)",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  bottomSpacing: {
    height: 24,
  },
  searchResultsContainer: {
    paddingHorizontal: CONTAINER_PADDING,
    paddingTop: 16,
  },
  resultsCount: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.primary.DEFAULT,
    marginBottom: 20,
  },
  noResultsContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
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
