import React, { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { api } from "@/backend";
import type { Id } from "../../../convex/_generated/dataModel";
import { BackButton } from "@/components/ui/BackButton";
import { ReportSheet } from "@/components/ReportSheet";
import {
  RatingSummary,
  ReviewCard,
  ReviewsEmptyState,
  type ReviewItem,
} from "@/components/review";
import { ScreenGradient } from "@/components/ui/Gradients";
import { Skeleton, SkeletonGroup, SkeletonLine, sweepPhase } from "@/components/ui/Skeleton";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import { LIST_CONTAINER_PADDING } from "@/constants/layout";

/**
 * Every review on one listing.
 *
 * Reached from the listing sheet, which shows the first three. The summary
 * rides in the list header rather than a fixed block so the whole page scrolls
 * as one — on a place with forty reviews the average is not what the reader
 * came for.
 */
export default function ReviewsScreen() {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const { listingId } = useLocalSearchParams<{ listingId: string }>();

  const id = listingId ? (listingId as Id<"listings">) : null;
  const summary = useQuery(
    api.reviews.queries.getSummary,
    id ? { listingId: id } : "skip"
  );
  const reviews = useQuery(
    api.reviews.queries.listForListing,
    id ? { listingId: id, limit: 100 } : "skip"
  );
  // The page used to be blank until both arrived: a header over nothing.
  const loading = !!id && (summary === undefined || reviews === undefined);
  // Nobody has reviewed it: said once, plainly, where it used to be a summary
  // saying so in small type over an empty list. Reviews hidden only because
  // their authors are blocked still leave a count, so those keep the summary.
  const empty = !loading && (reviews?.length ?? 0) === 0 && (summary?.count ?? 0) === 0;

  // One report sheet for the page. Each card used to hold its own — a Modal
  // per review, mounted and idle. The id outlives the close, so the sheet is
  // not re-pointed while it slides away.
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const openReport = useCallback((reviewId: string) => {
    setReportId(reviewId);
    setReportOpen(true);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ReviewItem }) => <ReviewCard review={item} onReport={openReport} />,
    [openReport]
  );

  return (
    <View style={styles.screen}>
      <ScreenGradient />
      <View style={[styles.header, { paddingTop: insets.top + 8 }, isRTL && styles.rowRTL]}>
        <BackButton />
        <Text style={styles.title}>{t("reviewsTitle")}</Text>
      </View>

      {loading ? (
        <SkeletonGroup>
          <ReviewsSkeleton isRTL={isRTL} />
        </SkeletonGroup>
      ) : empty ? (
        <ReviewsEmptyState />
      ) : (
        <FlatList
          data={reviews ?? []}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          ListHeaderComponent={
            summary ? (
              <View style={styles.summaryWrap}>
                <RatingSummary value={summary} />
              </View>
            ) : null
          }
          contentContainerStyle={[
            styles.list,
            // A pushed stack route, not inside the tab pager, so it clears the
            // safe area rather than the floating tab bar.
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {reportId && (
        <ReportSheet
          visible={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="review"
          targetId={reportId}
        />
      )}
    </View>
  );
}

/**
 * The summary block (score and five bars) and three review rows, at the
 * sizes of RatingSummary and ReviewCard, so the page does not shift when
 * they land.
 */
function ReviewsSkeleton({ isRTL }: { isRTL: boolean }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.list}>
      <View style={[styles.skeletonSummary, isRTL && styles.rowRTL]}>
        <View style={styles.skeletonScore}>
          <Skeleton radius={8} phase={sweepPhase(0)} style={styles.skeletonScoreNumber} />
          <Skeleton radius={4} phase={sweepPhase(1)} style={styles.skeletonScoreStars} />
        </View>
        <View style={styles.skeletonBars}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} radius={999} phase={sweepPhase(2 + i)} style={styles.skeletonBar} />
          ))}
        </View>
      </View>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <View style={[styles.skeletonHead, isRTL && styles.rowRTL]}>
            <Skeleton radius={18} phase={sweepPhase(i * 3)} style={styles.skeletonAvatar} />
            <View style={styles.skeletonWho}>
              <SkeletonLine width="45%" box={18} isRTL={isRTL} phase={sweepPhase(i * 3 + 1)} />
              <SkeletonLine width="30%" box={15} isRTL={isRTL} phase={sweepPhase(i * 3 + 2)} />
            </View>
          </View>
          <SkeletonLine width="92%" box={21} isRTL={isRTL} phase={sweepPhase(i * 3 + 3)} />
          <SkeletonLine width="70%" box={21} isRTL={isRTL} phase={sweepPhase(i * 3 + 4)} />
        </View>
      ))}
    </View>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: LIST_CONTAINER_PADDING,
      paddingBottom: 12,
    },
    rowRTL: { flexDirection: "row-reverse" },
    title: { fontFamily: fonts.serif, fontSize: 26, color: colors.ink },
    list: { paddingHorizontal: LIST_CONTAINER_PADDING },
    summaryWrap: { paddingVertical: 16 },
    // RatingSummary: score block beside five bars, 20 apart.
    skeletonSummary: {
      flexDirection: "row",
      alignItems: "center",
      gap: 20,
      paddingVertical: 16,
    },
    skeletonScore: { alignItems: "center", gap: 8 },
    skeletonScoreNumber: { width: 56, height: 40 },
    skeletonScoreStars: { width: 78, height: 14 },
    skeletonBars: { flex: 1, gap: 11 },
    skeletonBar: { height: 6 },
    // ReviewCard: a hairline row, a 36pt avatar beside name and stars.
    skeletonCard: {
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      gap: 8,
    },
    skeletonHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    skeletonAvatar: { width: 36, height: 36 },
    skeletonWho: { flex: 1, gap: 3 },
  });
