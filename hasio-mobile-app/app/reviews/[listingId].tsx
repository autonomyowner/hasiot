import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { api } from "@/backend";
import type { Id } from "../../../convex/_generated/dataModel";
import { BackButton } from "@/components/ui/BackButton";
import { RatingSummary, ReviewCard } from "@/components/review";
import { ScreenGradient } from "@/components/ui/Gradients";
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

  return (
    <View style={styles.screen}>
      <ScreenGradient />
      <View style={[styles.header, { paddingTop: insets.top + 8 }, isRTL && styles.rowRTL]}>
        <BackButton />
        <Text style={styles.title}>{t("reviewsTitle")}</Text>
      </View>

      <FlatList
        data={reviews ?? []}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <ReviewCard review={item} />}
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
  });
