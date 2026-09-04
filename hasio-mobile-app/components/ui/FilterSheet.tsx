import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
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
 * so a guest can say what they will actually pay. Both ends are null until a
 * thumb is moved, so "the whole range" and "no filter" stay the same thing.
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

export interface PriceBounds {
  min: number;
  max: number;
}

interface FilterSheetProps {
  visible: boolean;
  value: HomeFilters;
  /** `{ city, count }` straight from the backend — only cities that have listings. */
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
  const insets = useSafeAreaInsets();
  const { t, isRTL, language } = useLanguage();
  const { format } = useCurrency();

  // Selecting the option already selected clears it, so every chip is its own
  // on/off control and the sheet needs no separate "any" chip per group.
  const toggle = (key: "type" | "city", option: string) =>
    onChange({ ...value, [key]: value[key] === option ? null : option });

  const count = activeFilterCount(value);
  const hasBudget = priceBounds && priceBounds.max > priceBounds.min;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.head, isRTL && styles.rowRTL]}>
          <Text style={styles.title}>{t("filters")}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("close")}
          >
            <Feather name="x" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {types.length > 1 && (
            <Group title={t("filterType")} isRTL={isRTL} styles={styles}>
              {types.map((type) => (
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

          {cities.length > 1 && (
            <Group title={t("filterPlace")} isRTL={isRTL} styles={styles}>
              {cities.map(({ city, count: n }) => (
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
                min={priceBounds.min}
                max={priceBounds.max}
                step={PRICE_STEP}
                lower={value.priceMin ?? priceBounds.min}
                upper={value.priceMax ?? priceBounds.max}
                onChange={(lower, upper) =>
                  onChange({ ...value, priceMin: lower, priceMax: upper })
                }
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
            style={[styles.clear, count === 0 && styles.clearDisabled]}
            accessibilityRole="button"
            accessibilityLabel={t("filterClear")}
          >
            <Text style={styles.clearText}>{t("filterClear")}</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            style={styles.apply}
            accessibilityRole="button"
            accessibilityLabel={t("filterApply")}
          >
            <Text style={styles.applyText}>{t("filterApply")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
      style={[styles.chip, selected && styles.chipSelected]}
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
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(31, 29, 23, 0.35)",
    },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: "80%",
      backgroundColor: colors.surface.DEFAULT,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 24,
      paddingTop: 20,
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    rowRTL: { flexDirection: "row-reverse" },
    textRTL: { textAlign: "right" },
    title: { fontFamily: fonts.serif, fontSize: 24, color: colors.ink },
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
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
  });
