import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BottomSheet } from "./BottomSheet";
import { colors, type AppFonts } from "@/constants/colors";
import { cityLabel } from "@/constants/cities";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useCurrency } from "@/hooks/useCurrency";
import { useLanguage } from "@/hooks/useLanguage";
import { RangeSlider } from "./RangeSlider";

/**
 * What the home screen filters on. `null` in any slot means "no constraint",
 * which is why the values are nullable rather than carrying an "all" member:
 * "all" would have to be special-cased at every comparison.
 *
 * The budget is a real nightly rate in SAR, not a "$$" tier. It used to be the
 * latter because nothing carried a number; every stay now has `pricePerNight`,
 * so a guest can say what they will actually pay. Each end is null while its
 * thumb sits at the end of the track, so "the whole range" and "no filter"
 * stay the same thing — see the slider's `onChange` below.
 */
export interface HomeFilters {
  type: string | null;
  city: string | null;
  priceMin: number | null;
  priceMax: number | null;
}

export const EMPTY_FILTERS: HomeFilters = {
  type: null,
  city: null,
  priceMin: null,
  priceMax: null,
};

export function activeFilterCount(f: HomeFilters): number {
  const budget = f.priceMin !== null || f.priceMax !== null ? 1 : 0;
  return [f.type, f.city].filter(Boolean).length + budget;
}

/** Nightly rates snap to this, in SAR. */
const PRICE_STEP = 50;

// Chips are 36pt tall and their rows sit 8pt apart: 4pt above and below makes
// each a 44pt target without its slop reaching into the next row's.
const CHIP_HIT_SLOP = { top: 4, bottom: 4 } as const;

export interface PriceBounds {
  min: number;
  max: number;
}

interface FilterSheetProps {
  visible: boolean;
  value: HomeFilters;
  /**
   * `{ city, count }` for the cities that have something the screen shows —
   * counted by the caller from the same rows it filters, so a city on offer
   * can never come back empty.
   */
  cities: { city: string; count: number }[];
  /** Listing types present in the data, so the sheet never offers an empty one. */
  types: string[];
  /**
   * The cheapest and dearest nightly rate on offer, already snapped outwards to
   * `PRICE_STEP`. Omitted when nothing is priced, and then the budget group is
   * not shown at all — a slider over one value is a decoration.
   */
  priceBounds?: PriceBounds;
  onChange: (next: HomeFilters) => void;
  onClose: () => void;
}

export function FilterSheet({
  visible,
  value,
  cities,
  types,
  priceBounds,
  onChange,
  onClose,
}: FilterSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL, language } = useLanguage();
  const { format } = useCurrency();
  // True while a finger is on the budget slider. The list holds still for it:
  // on iOS a drag that drifts vertically could otherwise be taken over by this
  // ScrollView halfway through, whatever the slider says.
  const [sliding, setSliding] = useState(false);

  // Selecting the option already selected clears it, so every chip is its own
  // on/off control and the sheet needs no separate "any" chip per group.
  const toggle = (key: "type" | "city", option: string) =>
    onChange({ ...value, [key]: value[key] === option ? null : option });

  // An option that is still selected stays on offer even if the data has
  // since lost it (the only camp was delisted while "Camp" was set), so the
  // filter can be seen, and switched off, where it was switched on.
  const typeOptions =
    value.type && !types.includes(value.type) ? [...types, value.type] : types;
  const cityOptions =
    value.city && !cities.some((c) => c.city === value.city)
      ? [...cities, { city: value.city, count: 0 }]
      : cities;

  // A group with a single option is a decoration: choosing it changes nothing.
  const showTypes = typeOptions.length > 1 || value.type !== null;
  const showCities = cityOptions.length > 1 || value.city !== null;
  const count = activeFilterCount(value);
  // Zero and zero when nothing is priced, which hides the group.
  const budgetMin = priceBounds?.min ?? 0;
  const budgetMax = priceBounds?.max ?? 0;
  const hasBudget = budgetMax > budgetMin;
  const nothingToOffer = !showTypes && !showCities && !hasBudget;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      maxHeightRatio={0.8}
      header={
        <View style={[styles.head, isRTL && styles.rowRTL]}>
          <Text style={styles.title}>{t("filters")}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => pressed && styles.pressed}
            accessibilityRole="button"
            accessibilityLabel={t("close")}
          >
            <Feather name="x" size={22} color={colors.ink} />
          </Pressable>
        </View>
      }
    >
      {/* `alwaysBounceVertical={false}`: when the groups fit, which is the
          usual case, the list has nothing to scroll, so a drag on the slider
          that wanders vertically has nothing to hand itself to on iOS. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
        scrollEnabled={!sliding}
      >
        {nothingToOffer && (
          <Text style={[styles.nothing, isRTL && styles.textRTL]}>
            {t("filterNothingYet")}
          </Text>
        )}

        {showTypes && (
          <Group title={t("filterType")} isRTL={isRTL} styles={styles}>
            {typeOptions.map((type) => (
              <Chip
                key={type}
                label={t(`cat_${type}` as never) || type}
                selected={value.type === type}
                onPress={() => toggle("type", type)}
                styles={styles}
              />
            ))}
          </Group>
        )}

        {showCities && (
          <Group title={t("filterPlace")} isRTL={isRTL} styles={styles}>
            {cityOptions.map(({ city, count: n }) => (
              <Chip
                key={city}
                label={`${cityLabel(city, language)} (${n})`}
                selected={value.city === city}
                onPress={() => toggle("city", city)}
                styles={styles}
              />
            ))}
          </Group>
        )}

        {hasBudget && (
          <View style={styles.group}>
            <Text style={[styles.groupTitle, isRTL && styles.textRTL]}>
              {t("filterBudget")}
            </Text>
            <Text style={[styles.groupNote, isRTL && styles.textRTL]}>
              {t("filterBudgetNote")}
            </Text>
            <RangeSlider
              min={budgetMin}
              max={budgetMax}
              step={PRICE_STEP}
              lower={value.priceMin ?? budgetMin}
              upper={value.priceMax ?? budgetMax}
              // A thumb at the end of the track is "no limit on this side",
              // stored as null. Home counts any non-null end as a budget, and a
              // budget drops every place without a nightly rate — so the full
              // range stored as numbers used to hide every attraction.
              onChange={(lower, upper) =>
                onChange({
                  ...value,
                  priceMin: lower <= budgetMin ? null : lower,
                  priceMax: upper >= budgetMax ? null : upper,
                })
              }
              onSlidingChange={setSliding}
              formatValue={format}
              isRTL={isRTL}
              minLabel={t("filterBudgetMin")}
              maxLabel={t("filterBudgetMax")}
            />
          </View>
        )}
      </ScrollView>

      <View style={[styles.foot, isRTL && styles.rowRTL]}>
        <Pressable
          onPress={() => onChange(EMPTY_FILTERS)}
          disabled={count === 0}
          style={({ pressed }) => [
            styles.clear,
            count === 0 && styles.clearDisabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("filterClear")}
          accessibilityState={{ disabled: count === 0 }}
        >
          <Text style={styles.clearText}>{t("filterClear")}</Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.apply, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t("filterApply")}
        >
          <Text style={styles.applyText}>{t("filterApply")}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

function Group({
  title,
  isRTL,
  styles,
  children,
}: {
  title: string;
  isRTL: boolean;
  styles: ReturnType<typeof makeStyles>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, isRTL && styles.textRTL]}>{title}</Text>
      <View style={[styles.chips, isRTL && styles.rowRTL]}>{children}</View>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
  styles,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={CHIP_HIT_SLOP}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    head: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    rowRTL: { flexDirection: "row-reverse" },
    textRTL: { textAlign: "right" },
    title: { fontFamily: fonts.serif, fontSize: 24, color: colors.ink },
    nothing: {
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
      color: colors.onSurface.variant,
      paddingVertical: 12,
    },
    group: { paddingVertical: 12 },
    groupTitle: {
      fontFamily: fonts.semibold,
      fontSize: 13,
      color: colors.onSurface.muted,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 12,
    },
    groupNote: {
      fontFamily: fonts.regular,
      fontSize: 12.5,
      color: colors.onSurface.muted,
      marginTop: -6,
      marginBottom: 14,
    },
    // Padded by the chips' slop and pulled back by as much, so nothing moves
    // but the first and last rows' slop lies inside this view: slop outside
    // a parent's bounds is never hit-tested.
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      paddingVertical: CHIP_HIT_SLOP.top,
      marginVertical: -CHIP_HIT_SLOP.top,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: colors.chip,
    },
    // Lime is a light fill, so a selected chip takes ink text, never white.
    chipSelected: { backgroundColor: colors.primary.DEFAULT },
    chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface.variant },
    chipTextSelected: { color: colors.ink },
    foot: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    clear: { paddingVertical: 14, paddingHorizontal: 20 },
    clearDisabled: { opacity: 0.4 },
    clearText: { fontFamily: fonts.medium, fontSize: 15, color: colors.onSurface.variant },
    apply: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: colors.primary.DEFAULT,
    },
    applyText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
    pressed: { opacity: 0.7 },
  });
