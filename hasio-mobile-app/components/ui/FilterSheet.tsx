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
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";

/**
 * What the home screen filters on. `null` in any slot means "no constraint",
 * which is why the values are nullable rather than carrying an "all" member:
 * "all" would have to be special-cased at every comparison.
 */
export interface HomeFilters {
  type: string | null;
  city: string | null;
  price: string | null;
}

export const EMPTY_FILTERS: HomeFilters = { type: null, city: null, price: null };

export function activeFilterCount(f: HomeFilters): number {
  return [f.type, f.city, f.price].filter(Boolean).length;
}

/**
 * Price is the listing's `priceRange`, which is a free-text tier a host types.
 * Production only ever holds "$", "$$" and "$$$", so the filter offers those
 * and matches exactly — a numeric budget range is impossible until listings
 * carry a numeric nightly rate, which is a field on the unmerged stays branch.
 */
export const PRICE_TIERS = ["$", "$$", "$$$", "$$$$"] as const;

interface FilterSheetProps {
  visible: boolean;
  value: HomeFilters;
  /** `{ city, count }` straight from the backend — only cities that have listings. */
  cities: { city: string; count: number }[];
  /** Listing types present in the data, so the sheet never offers an empty one. */
  types: string[];
  onChange: (next: HomeFilters) => void;
  onClose: () => void;
}

export function FilterSheet({
  visible,
  value,
  cities,
  types,
  onChange,
  onClose,
}: FilterSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();

  // Selecting the option already selected clears it, so every chip is its own
  // on/off control and the sheet needs no separate "any" chip per group.
  const toggle = (key: keyof HomeFilters, option: string) =>
    onChange({ ...value, [key]: value[key] === option ? null : option });

  const count = activeFilterCount(value);

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
                  label={`${city} (${n})`}
                  selected={value.city === city}
                  onPress={() => toggle("city", city)}
                  styles={styles}
                />
              ))}
            </Group>
          )}

          <Group title={t("filterBudget")} isRTL={isRTL} styles={styles}>
            {PRICE_TIERS.map((tier) => (
              <Chip
                key={tier}
                label={tier}
                selected={value.price === tier}
                onPress={() => toggle("price", tier)}
                styles={styles}
              />
            ))}
          </Group>
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
