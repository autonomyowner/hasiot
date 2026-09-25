import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { Button, FilterChip, SearchBar } from "@/components/ui";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PressableScale } from "@/components/ui/PressableScale";
import { Skeleton, SkeletonFade, SkeletonLine, sweepPhase } from "@/components/ui/Skeleton";
import { CITIES, cityLabel } from "@/constants/cities";
import { colors, type AppFonts } from "@/constants/colors";
import {
  CHIP_GAP,
  CHIP_PADDING_VERTICAL,
  CHIP_TARGET_INSET,
  CHIP_TEXT,
  LIST_CONTAINER_PADDING,
} from "@/constants/layout";
import { PRESS_SCALE_CHIP } from "@/constants/motion";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useAllServices, useServiceList, type ServiceItem } from "@/hooks/useConvexData";
import { useDebounce } from "@/hooks/useDebounce";
import { useLanguage } from "@/hooks/useLanguage";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import {
  presentServiceTypes,
  serviceTypeLabelKey,
  type ServiceType,
} from "@/lib/serviceDisplay";
import { ServiceCard } from "./ServiceCard";
import { ServiceDetailSheet } from "./ServiceDetailSheet";

type TypeChip = "all" | ServiceType;

const typeChipKey = (chip: TypeChip) => chip;
const serviceKey = (service: ServiceItem) => service.id;

// The city sheet's chips are 36pt tall and their rows sit 8pt apart: 4pt above
// and below makes each a 44pt target without reaching into the next row's.
const CITY_CHIP_SLOP = { top: 4, bottom: 4 } as const;

/**
 * The Services half of the Book tab: a search, the type chips with the city
 * filter at their head, and the list — each row opening the service sheet.
 *
 * The search is debounced for typing as Home's is, and cleared at once; it
 * runs on the server and through the same Arabic folding Home uses (see
 * useServiceList). Everything is sorted as a traveller browses: what can be
 * booked first.
 */
export function ServicesList() {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL } = useLanguage();
  const bottomClearance = useTabBarClearance();

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  // The debounce is for typing, not for clearing: an emptied box brings the
  // whole list back at once.
  const search = query.trim() ? debouncedQuery : "";
  const [type, setType] = useState<TypeChip>("all");
  const [city, setCity] = useState<string | null>(null);
  const [cityOpen, setCityOpen] = useState(false);
  const [selected, setSelected] = useState<ServiceItem | null>(null);

  // The unfiltered list decides which type chips are worth showing — what is
  // listed at all is a fact about the data, not about the current selection.
  const { services: everything } = useAllServices();
  const { services, isLoading } = useServiceList({
    serviceType: type === "all" ? null : type,
    city,
    search,
  });

  const chips = useMemo<TypeChip[]>(
    () => ["all", ...presentServiceTypes(everything, type)],
    [everything, type]
  );
  const filtered = type !== "all" || city !== null || search !== "";

  // Stable, so the memoised cards sit out the renders that are not theirs.
  const openService = useCallback((service: ServiceItem) => setSelected(service), []);
  const closeService = useCallback(() => setSelected(null), []);
  const openCities = useCallback(() => setCityOpen(true), []);
  const closeCities = useCallback(() => setCityOpen(false), []);
  const showAll = useCallback(() => {
    setType("all");
    setCity(null);
    setQuery("");
  }, []);

  const renderChip = useCallback<ListRenderItem<TypeChip>>(
    ({ item }) => (
      // Only "All" can be drawn before the data says which types exist; the
      // rest fade in beside it rather than popping into the row.
      <Animated.View entering={FadeIn.duration(180)}>
        <FilterChip
          label={item === "all" ? t("all") : t(serviceTypeLabelKey(item))}
          selected={type === item}
          onPress={() => setType(item)}
        />
      </Animated.View>
    ),
    [t, type]
  );

  const renderService = useCallback<ListRenderItem<ServiceItem>>(
    ({ item }) => <ServiceCard service={item} onPress={openService} />,
    [openService]
  );

  return (
    <View style={styles.fill}>
      <View style={styles.searchWrap}>
        <SearchBar
          placeholder={t("searchServices")}
          value={query}
          onChangeText={setQuery}
          isRTL={isRTL}
        />
      </View>

      {/* Type chips, with the city filter first. `inverted` mirrors the row
          in Arabic — the order, the edge it starts from and the way it
          scrolls — header included. A row that fits has nothing to scroll,
          and a swipe there should change tabs on iOS instead. */}
      <FlatList
        horizontal
        inverted={isRTL}
        data={chips}
        keyExtractor={typeChipKey}
        renderItem={renderChip}
        ListHeaderComponent={<CityPill city={city} onPress={openCities} />}
        showsHorizontalScrollIndicator={false}
        alwaysBounceHorizontal={false}
        keyboardShouldPersistTaps="handled"
        style={styles.chipList}
        contentContainerStyle={styles.chips}
      />

      <SkeletonFade fill loading={isLoading} skeleton={<ServicesSkeleton isRTL={isRTL} />}>
        <FlatList
          data={services}
          keyExtractor={serviceKey}
          renderItem={renderService}
          contentContainerStyle={[styles.list, { paddingBottom: bottomClearance }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={6}
          windowSize={7}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t("noServicesTitle")}</Text>
              <Text style={styles.emptyMessage}>
                {filtered ? t("noServicesHint") : t("noServicesAnyHint")}
              </Text>
              {filtered && (
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

      <ServiceDetailSheet service={selected} onClose={closeService} />
      <CitySheet visible={cityOpen} value={city} onChange={setCity} onClose={closeCities} />
    </View>
  );
}

/**
 * The city filter's button, at the head of a chip row: the city chosen (or
 * "All cities") with a pin and a chevron, ink-filled once a city is set so an
 * active filter reads as one — the way a selected chip beside it does.
 *
 * Shared with the Stays half of the Book tab.
 */
export function CityPill({ city, onPress }: { city: string | null; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL, language } = useLanguage();
  const label = city ? cityLabel(city, language) : t("allCities");
  const active = city !== null;
  const tint = active ? "#FFFFFF" : colors.onSurface.variant;

  return (
    <PressableScale
      style={styles.pillTarget}
      scaleTo={PRESS_SCALE_CHIP}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t("city")}: ${label}`}
    >
      <View style={[styles.pill, active && styles.pillActive, isRTL && styles.rowRTL]}>
        <Feather name="map-pin" size={13} color={tint} />
        <Text style={[styles.pillText, active && styles.pillTextActive]} numberOfLines={1}>
          {label}
        </Text>
        <Feather name="chevron-down" size={14} color={tint} />
      </View>
    </PressableScale>
  );
}

/**
 * The thirteen cities of the province, and "All cities", as a sheet of chips.
 * Choosing one applies it and closes the sheet: a single choice needs no
 * separate "apply". Shared with the Stays half of the Book tab.
 */
export function CitySheet({
  visible,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: string | null;
  onChange: (city: string | null) => void;
  onClose: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL, language } = useLanguage();

  const choose = (city: string | null) => {
    onChange(city);
    onClose();
  };

  const options: (string | null)[] = [null, ...CITIES.map((c) => c.key)];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      maxHeightRatio={0.8}
      header={
        <View style={[styles.sheetHead, isRTL && styles.rowRTL]}>
          <Text style={styles.sheetTitle}>{t("city")}</Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.sheetClose,
              isRTL ? styles.sheetCloseRTL : styles.sheetCloseLTR,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("close")}
          >
            <Feather name="x" size={22} color={colors.ink} />
          </Pressable>
        </View>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} alwaysBounceVertical={false}>
        <View style={[styles.cityChips, isRTL && styles.rowRTL]}>
          {options.map((key) => {
            const selected = value === key;
            const label = key === null ? t("allCities") : cityLabel(key, language);
            return (
              <Pressable
                key={key ?? "all"}
                onPress={() => choose(key)}
                hitSlop={CITY_CHIP_SLOP}
                style={({ pressed }) => [
                  styles.cityChip,
                  selected && styles.cityChipSelected,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={label}
              >
                <Text style={[styles.cityChipText, selected && styles.cityChipTextSelected]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

/**
 * Stands in for the list while it loads, at ServiceCard's row size — the
 * white card, the 88pt thumb and its three lines — so nothing moves when the
 * rows land.
 */
function ServicesSkeleton({ isRTL }: { isRTL: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.list}>
      {[0, 1, 2, 3].map((index) => {
        const seed = index * 4;
        return (
          <View key={index} style={[styles.skeletonRow, isRTL && styles.rowRTL]}>
            <Skeleton radius={16} phase={sweepPhase(seed)} style={styles.skeletonThumb} />
            <View style={styles.skeletonBody}>
              <SkeletonLine width="72%" box={22} isRTL={isRTL} phase={sweepPhase(seed + 1)} />
              <SkeletonLine width="48%" box={18} isRTL={isRTL} phase={sweepPhase(seed + 2)} />
              <SkeletonLine width="36%" box={19} isRTL={isRTL} phase={sweepPhase(seed + 3)} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    fill: {
      flex: 1,
    },
    rowRTL: {
      flexDirection: "row-reverse",
    },
    pressed: {
      opacity: 0.7,
    },
    searchWrap: {
      paddingHorizontal: LIST_CONTAINER_PADDING,
      paddingTop: 4,
    },
    // Each chip brings CHIP_TARGET_INSET above and below its pill, its 44pt
    // target; the row keeps 12pt to the pills, as the Stay row always had.
    chipList: {
      flexGrow: 0,
    },
    chips: {
      paddingHorizontal: LIST_CONTAINER_PADDING,
      paddingVertical: 12 - CHIP_TARGET_INSET,
      gap: CHIP_GAP,
    },
    list: {
      paddingHorizontal: LIST_CONTAINER_PADDING,
      paddingTop: 8,
    },
    // Centred in either language; the bottom padding keeps the "See all"
    // button's slop inside this view, where it can be hit.
    empty: {
      alignItems: "center",
      paddingTop: 60,
      paddingBottom: 8,
      paddingHorizontal: 16,
    },
    emptyTitle: {
      fontFamily: fonts.semibold,
      fontSize: 18,
      color: colors.ink,
      marginBottom: 8,
      textAlign: "center",
    },
    emptyMessage: {
      fontFamily: fonts.regular,
      fontSize: 14,
      color: colors.onSurface.variant,
      textAlign: "center",
    },
    emptyAction: {
      marginTop: 18,
    },
    // FilterChip's box: the transparent band above and below the pill is the
    // rest of its 44pt target.
    pillTarget: {
      paddingVertical: CHIP_TARGET_INSET,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: CHIP_PADDING_VERTICAL,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.surface.DEFAULT,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    pillActive: {
      backgroundColor: colors.ink,
      borderColor: colors.ink,
    },
    pillText: {
      maxWidth: 140,
      fontFamily: fonts.medium,
      fontSize: CHIP_TEXT.fontSize,
      lineHeight: CHIP_TEXT.lineHeight,
      color: colors.onSurface.variant,
    },
    pillTextActive: {
      fontFamily: fonts.semibold,
      color: "#FFFFFF",
    },
    sheetHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    sheetTitle: {
      fontFamily: fonts.serif,
      fontSize: 24,
      color: colors.ink,
    },
    // A 44pt square round the X, given back by the margins so the header
    // keeps its height and the X its place at the edge.
    sheetClose: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      marginVertical: -11,
    },
    sheetCloseLTR: {
      marginRight: -11,
    },
    sheetCloseRTL: {
      marginLeft: -11,
    },
    // The chips' slop lies inside this view — slop outside a parent is never
    // hit-tested — padded in and pulled back by as much.
    cityChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      paddingVertical: 12 + CITY_CHIP_SLOP.top,
      marginVertical: -CITY_CHIP_SLOP.top,
    },
    // The filter sheet's chip: the track colour on the sheet's white.
    cityChip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: colors.chip,
    },
    // Lime is a light fill, so the selected chip's label is ink.
    cityChipSelected: {
      backgroundColor: colors.primary.DEFAULT,
    },
    cityChipText: {
      fontFamily: fonts.medium,
      fontSize: 14,
      color: colors.onSurface.variant,
    },
    cityChipTextSelected: {
      color: colors.ink,
    },
    // ServiceCard's row, drawn as its placeholder.
    skeletonRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      marginBottom: 12,
      borderRadius: 20,
      backgroundColor: colors.surface.DEFAULT,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    skeletonThumb: {
      width: 88,
      height: 88,
    },
    skeletonBody: {
      flex: 1,
      gap: 4,
    },
  });
