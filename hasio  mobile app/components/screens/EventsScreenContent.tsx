import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useLanguage } from "@/hooks/useLanguage";
import { useEvents } from "@/hooks/useConvexData";
import { FilterChip } from "@/components/ui";
import { EventCard } from "@/components/events/EventCard";
import type { EventFilter, EventCategory } from "@/types";

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(600)}
        style={[styles.header, isRTL && styles.headerRTL]}
      >
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

      {/* Events List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0D7A5F" />
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(300 + index * 100).duration(600)}>
              <EventCard
                event={item}
                language={language}
                isRTL={isRTL}
              />
            </Animated.View>
          )}
          contentContainerStyle={styles.listContent}
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
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
    fontSize: 28,
    fontWeight: "700",
    color: "#1A1A1A",
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
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: "#737373",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
});
