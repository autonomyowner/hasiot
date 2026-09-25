import React, { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { api } from "@/backend";
import type { Id } from "../../../../convex/_generated/dataModel";
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
 * Every review of one service — the service sheet shows the first three.
 *
 * The listing page's twin (app/reviews/[listingId].tsx), read from the
 * service's own queries: the same summary, the same cards, the same one report
 * sheet for the page. A static `service/` segment, so `/reviews/service/<id>`
 * can never be taken for a listing id.
 */
export default function ServiceReviewsScreen() {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();

  const id = serviceId ? (serviceId as Id<"services">) : null;
  const summary = useQuery(
    api.reviews.queries.getServiceSummary,
    id ? { serviceId: id } : "skip"
  );
  const reviews = useQuery(
    api.reviews.queries.listForService,
    id ? { serviceId: id, limit: 100 } : "skip"
  );
  const loading = !!id && (summary === undefined || reviews === undefined);
  // Nobody has reviewed it — see the listing page. Reviews hidden only because
  // their authors are blocked still leave a count, so those keep the summary.
  const empty = !loading && (reviews?.length ?? 0) === 0 && (summary?.count ?? 0) === 0;

  // One report sheet for the page; the id outlives the close, so the sheet is
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
                <RatingSummary value={summary} emptyHint={t("reviewsEmptyHint")} />
              </View>
            ) : null
          }
          contentContainerStyle={[
            styles.list,
            // A pushed stack route, not inside the tab pager, so it clears the
            // safe area rather than the tab bar.
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
 * The summary block and three review rows at the sizes of RatingSummary and
 * ReviewCard — the listing page's placeholder, so the two pages load alike.
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
