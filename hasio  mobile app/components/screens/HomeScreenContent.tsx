import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Dimensions,
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
import { useLanguage, getLocalizedText } from "@/hooks/useLanguage";
import { useHomeData } from "@/hooks/useConvexData";
import { SearchBar, CategoryCard } from "@/components/ui";
import type { Food, Lodging, Event } from "@/types";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const { width } = Dimensions.get("window");
const CARD_GAP = 8;
const CONTAINER_PADDING = 20;
const CARD_WIDTH = (width - (CONTAINER_PADDING * 2) - CARD_GAP) / 2;

interface HomeScreenContentProps {
  onNavigateToTab?: (index: number) => void;
}

export function HomeScreenContent({ onNavigateToTab }: HomeScreenContentProps) {
  const insets = useSafeAreaInsets();
  const { t, language, isRTL } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
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
  const { lodgings, foods, events, destinations } = useHomeData();

  const featuredItems = destinations.filter((d) => d.featured);
  const moreDestinations = destinations.filter((d) => !d.featured);

  // Use Convex data (with mock fallback)
  const allLodging = lodgings;
  const allFood = foods;
  const allEvents = events;

  // Search functionality
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;

    const query = searchQuery.toLowerCase();

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
  }, [searchQuery, allLodging, allFood, allEvents]);

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
            tintColor="#B85C38"
          />
        }
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(600)}
          style={[styles.header, isRTL && styles.headerRTL, headerAnimatedStyle]}
        >
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

        {/* Search Results */}
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
                        image={item.images[0]}
                        isRTL={isRTL}
                        index={index}
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
                        image={item.images[0]}
                        isRTL={isRTL}
                        index={index}
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
                        image={item.images[0]}
                        isRTL={isRTL}
                        index={index}
                      />
                    ))}
                  </View>
                )}

                {searchResults.destinations.length > 0 && (
                  <View style={styles.resultSection}>
                    <Text style={[styles.resultSectionTitle, isRTL && styles.textRTL]}>
                      Destinations ({searchResults.destinations.length})
                    </Text>
                    {searchResults.destinations.map((item, index) => (
                      <SearchResultItem
                        key={item.id}
                        name={getLocalizedText(item.name, item.nameAr, language)}
                        subtitle={getLocalizedText(item.subtitle, item.subtitleAr, language)}
                        image={item.image}
                        isRTL={isRTL}
                        index={index}
                      />
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        ) : (
          <>
            {/* Category Cards */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(600)}
          style={styles.section}
        >
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
        </Animated.View>

        {/* Featured Destinations - 2 Column Grid */}
        <Animated.View
          entering={FadeInDown.delay(400).duration(600)}
          style={styles.section}
        >
          <View style={styles.sectionHeader}>
            <Text
              style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}
            >
              {t("featuredDestinations")}
            </Text>
            <View style={styles.decorativeLine} />
          </View>

          <View style={styles.gridContainer}>
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
                index={index}
                isTall={index % 3 === 0}
              />
            ))}
          </View>
        </Animated.View>

        {/* More Destinations - 2 Column Grid */}
        <Animated.View
          entering={FadeInDown.delay(500).duration(600)}
          style={styles.section}
        >
          <View style={styles.sectionHeader}>
            <Text
              style={[styles.sectionTitle, isRTL && styles.sectionTitleRTL]}
            >
              More Destinations
            </Text>
            <View style={styles.decorativeLine} />
          </View>

          <View style={styles.gridContainer}>
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
                index={index}
                isTall={index % 3 === 1}
              />
            ))}
          </View>
        </Animated.View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

interface SearchResultItemProps {
  name: string;
  subtitle: string;
  image: string;
  isRTL: boolean;
  index: number;
}

function SearchResultItem({ name, subtitle, image, isRTL, index }: SearchResultItemProps) {
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
        style={[styles.searchResultItem, animatedStyle]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Image
          source={{ uri: image }}
          style={styles.searchResultImage}
          contentFit="cover"
          transition={200}
        />
        <View style={[styles.searchResultContent, isRTL && styles.searchResultContentRTL]}>
          <Text style={[styles.searchResultName, isRTL && styles.textRTL]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.searchResultSubtitle, isRTL && styles.textRTL]} numberOfLines={1}>
            {subtitle}
          </Text>
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
  index: number;
  isTall?: boolean;
}

function DestinationGridCard({
  name,
  subtitle,
  image,
  isRTL,
  index,
  isTall = false,
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
    <Animated.View
      entering={FadeInDown.delay(100 + index * 50).duration(600)}
      style={[styles.gridCardWrapper, { height: cardHeight }]}
    >
      <AnimatedPressable
        style={[styles.gridCard, animatedStyle]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F1EB",
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
  appName: {
    fontSize: 28,
    fontFamily: "System",
    fontWeight: "700",
    color: "#0D7A5F",
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 17,
    color: "#6B5D4F",
    marginTop: 4,
    fontWeight: "400",
    letterSpacing: 0.3,
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
    paddingHorizontal: CONTAINER_PADDING,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2C2416",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  sectionTitleRTL: {
    textAlign: "right",
  },
  decorativeLine: {
    width: 50,
    height: 3,
    backgroundColor: "#B85C38",
    borderRadius: 2,
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
  gridCardWrapper: {
    width: CARD_WIDTH,
    marginBottom: 0,
  },
  gridCard: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#E8DFD4",
    shadowColor: "#2C2416",
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
    fontWeight: "700",
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
    color: "rgba(255, 255, 255, 0.95)",
    fontWeight: "500",
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
    fontWeight: "600",
    color: "#0D7A5F",
    marginBottom: 20,
  },
  noResultsContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  noResultsText: {
    fontSize: 16,
    color: "#737373",
  },
  resultSection: {
    marginBottom: 24,
  },
  resultSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2C2416",
    marginBottom: 12,
  },
  searchResultItem: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchResultImage: {
    width: 80,
    height: 80,
  },
  searchResultContent: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
  },
  searchResultContentRTL: {
    alignItems: "flex-end",
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 4,
  },
  searchResultSubtitle: {
    fontSize: 13,
    color: "#737373",
  },
});
