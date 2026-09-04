import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import { StarRating } from "./StarRating";

export interface RatingSummaryValue {
  /** null when nobody has rated — never 0, which would read as one star. */
  average: number | null;
  count: number;
  /** Index 0 is one star, index 4 is five. */
  histogram: [number, number, number, number, number];
}

/**
 * Average, count and the distribution behind them.
 *
 * The bars matter more than the average: a 4.2 made of straight fours reads
 * very differently from a 4.2 made of fives and ones, and only the histogram
 * shows which one a place is.
 */
export function RatingSummary({ value }: { value: RatingSummaryValue }) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL } = useLanguage();

  // Both halves of the same condition: the backend returns `average: null`
  // exactly when `count` is 0, and testing both means no reachable path can
  // fall through to a score block and stamp a zero-star badge on a place
  // nobody has rated.
  if (value.count === 0 || value.average === null) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, isRTL && styles.textRTL]}>
          {t("reviewsNone")}
        </Text>
        <Text style={[styles.emptyBody, isRTL && styles.textRTL]}>
          {t("reviewsBeFirst")}
        </Text>
      </View>
    );
  }

  const max = Math.max(...value.histogram, 1);

  return (
    <View style={[styles.wrap, isRTL && styles.rowRTL]}>
      <View style={styles.scoreBlock}>
        <Text style={styles.score}>{value.average.toFixed(1)}</Text>
        <StarRating value={value.average} size={14} />
        <Text style={styles.count}>
          {value.count === 1
            ? t("reviewsCountOne")
            : t("reviewsCountMany").replace("{n}", String(value.count))}
        </Text>
      </View>

      <View style={styles.bars}>
        {[5, 4, 3, 2, 1].map((star) => {
          const n = value.histogram[star - 1];
          return (
            <View key={star} style={[styles.barRow, isRTL && styles.rowRTL]}>
              <Text style={styles.barLabel}>{star}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    // Width from the busiest bucket, not the total: with 40 of
                    // one star and 2 of another, percentages of the total leave
                    // every bar but one invisible.
                    { width: `${(n / max) * 100}%` },
                    isRTL && styles.barFillRTL,
                  ]}
                />
              </View>
              <Text style={styles.barCount}>{n}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    wrap: { flexDirection: "row", alignItems: "center", gap: 20 },
    rowRTL: { flexDirection: "row-reverse" },
    textRTL: { textAlign: "right" },
    scoreBlock: { alignItems: "center", gap: 4 },
    score: { fontFamily: fonts.serif, fontSize: 40, lineHeight: 46, color: colors.ink },
    count: { fontFamily: fonts.regular, fontSize: 12, color: colors.onSurface.muted },
    bars: { flex: 1, gap: 5 },
    barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    barLabel: {
      fontFamily: fonts.medium,
      fontSize: 11,
      color: colors.onSurface.muted,
      width: 10,
      textAlign: "center",
    },
    barTrack: {
      flex: 1,
      height: 6,
      borderRadius: 999,
      backgroundColor: colors.chip,
      overflow: "hidden",
    },
    barFill: { height: "100%", borderRadius: 999, backgroundColor: colors.primary.DEFAULT },
    barFillRTL: { alignSelf: "flex-end" },
    barCount: {
      fontFamily: fonts.regular,
      fontSize: 11,
      color: colors.onSurface.muted,
      width: 20,
      textAlign: "center",
    },
    empty: { paddingVertical: 8, gap: 4 },
    emptyTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
    emptyBody: { fontFamily: fonts.regular, fontSize: 13, color: colors.onSurface.muted },
  });
