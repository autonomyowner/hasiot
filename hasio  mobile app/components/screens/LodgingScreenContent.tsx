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
import { useLodgings } from "@/hooks/useConvexData";
import { FilterChip } from "@/components/ui";
import { LodgingCard } from "@/components/lodging/LodgingCard";
import type { LodgingFilter, LodgingType } from "@/types";

const filters: { key: LodgingFilter; labelKey: "all" | "hotels" | "apartments" | "camps" | "homestays" }[] = [
  { key: "all", labelKey: "all" },
  { key: "hotel", labelKey: "hotels" },
  { key: "apartment", labelKey: "apartments" },
  { key: "camp", labelKey: "camps" },
  { key: "homestay", labelKey: "homestays" },
];

export function LodgingScreenContent() {
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(600)}
        style={[styles.header, isRTL && styles.headerRTL]}
      >
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

      {/* Lodging List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0D7A5F" />
        </View>
      ) : (
        <FlatList
          data={filteredLodging}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(300 + index * 100).duration(600)}>
              <LodgingCard
                lodging={item}
                language={language}
                isRTL={isRTL}
                perNightText={t("perNight")}
              />
            </Animated.View>
          )}
          contentContainerStyle={styles.listContent}
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
