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
import { TAB_BAR_CLEARANCE } from "@/constants/layout";
import { useEvents } from "@/hooks/useConvexData";
import { FilterChip, SkeletonFade, SkeletonList } from "@/components/ui";
import { EventCard } from "@/components/events/EventCard";
import {
  ListingDetailSheet,
  type DetailItem,
} from "@/components/listing/ListingDetailSheet";
import type { Event, EventFilter, EventCategory } from "@/types";

const filters: { key: EventFilter; labelKey: "all" | "festivals" | "conferences" | "outdoor" | "indoor" | "seasonal" }[] = [
  { key: "all", labelKey: "all" },
  { key: "festival", labelKey: "festivals" },
  { key: "conference", labelKey: "conferences" },
  { key: "outdoor", labelKey: "outdoor" },
  { key: "indoor", labelKey: "indoor" },
  { key: "seasonal", labelKey: "seasonal" },
];

export function EventsScreenContent() {
  const insets = useSafeAreaInsets();
  const { t, language, isRTL } = useLanguage();
  const [activeFilter, setActiveFilter] = useState<EventFilter>("all");

  // Get events from Convex with fallback to mock data
  const categoryFilter = activeFilter === "all" ? undefined : activeFilter as EventCategory;
  const { events, isLoading } = useEvents(categoryFilter);

  // Filter locally if using "all" filter
  const filteredEvents = useMemo(() => {
    if (activeFilter === "all") return events;
    return events.filter((item) => item.category === activeFilter);
  }, [activeFilter, events]);

  const displayFilters = isRTL ? [...filters].reverse() : filters;

  const [selected, setSelected] = useState<DetailItem | null>(null);

  const toDetailItem = (item: Event): DetailItem => ({
    id: item.id,
    title: getLocalizedText(item.title, item.titleAr, language),
    subtitle: getLocalizedText(item.location, item.locationAr, language),
    badge: t(`cat_${item.category}` as const),
    badgeColor: categoryColors[item.category],
    // An event's headline fact is when it runs, so the date and time take the
    // slot a price occupies on the other two screens.
    priceLine: [item.date, item.time].filter(Boolean).join(" • ") || undefined,
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
        <Text style={[styles.eyebrow, isRTL && styles.textRTL]}>
          {t("eventsEyebrow")}
        </Text>
        <Text style={[styles.title, isRTL && styles.textRTL]}>
          {t("events")}
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

      {/* Events List — cross-faded from its skeleton; see LodgingScreenContent. */}
      <SkeletonFade
        fill
        loading={isLoading}
        skeleton={<SkeletonList variant="event" isRTL={isRTL} />}
      >
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              language={language}
              isRTL={isRTL}
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
                {t("emptyEventsTitle")}
              </Text>
              <Text style={[styles.emptyMessage, isRTL && styles.textRTL]}>
                {t("emptyEventsMessage")}
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
    paddingBottom: 12,
  },
  headerRTL: {
    alignItems: "flex-end",
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.semibold,
    color: colors.primary.DEFAULT,
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
