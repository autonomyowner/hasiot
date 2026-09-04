import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import { ReportSheet } from "@/components/ReportSheet";
import { StarRating } from "./StarRating";

export interface ReviewItem {
  _id: string;
  rating: number;
  content?: string;
  isAnonymous?: boolean;
  /** Set by the server when the review cites the author's own completed stay. */
  isVerified?: boolean;
  createdAt: number;
  user?: { firstName?: string; lastName?: string } | null;
}

function authorName(review: ReviewItem, anonymousLabel: string): string {
  if (review.isAnonymous || !review.user) return anonymousLabel;
  const name = [review.user.firstName, review.user.lastName].filter(Boolean).join(" ").trim();
  return name || anonymousLabel;
}

export function ReviewCard({ review }: { review: ReviewItem }) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL, language } = useLanguage();
  const [reportOpen, setReportOpen] = useState(false);

  const name = authorName(review, t("reviewAnonymousAuthor"));
  const date = new Date(review.createdAt).toLocaleDateString(
    language === "ar" ? "ar-SA" : "en-GB",
    { year: "numeric", month: "short" }
  );

  return (
    <View style={styles.card}>
      <View style={[styles.head, isRTL && styles.rowRTL]}>
        <View style={[styles.who, isRTL && styles.rowRTL]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.whoText}>
            <Text style={[styles.name, isRTL && styles.textRTL]} numberOfLines={1}>
              {name}
            </Text>
            <View style={[styles.metaRow, isRTL && styles.rowRTL]}>
              <StarRating value={review.rating} size={12} />
              <Text style={styles.date}>{date}</Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => setReportOpen(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("reportTitle")}
        >
          <Feather name="more-horizontal" size={18} color={colors.onSurface.muted} />
        </Pressable>
      </View>

      {/* The badge is rendered from the server's own flag. Never recompute it
          here — "this guest actually stayed" is the one claim the app cannot
          be trusted to make about itself. */}
      {review.isVerified && (
        <View style={[styles.verified, isRTL && styles.verifiedRTL]}>
          <Feather name="check-circle" size={11} color={colors.primary.deep} />
          <Text style={styles.verifiedText}>{t("reviewVerifiedStay")}</Text>
        </View>
      )}

      {!!review.content && (
        <Text style={[styles.body, isRTL && styles.textRTL]}>{review.content}</Text>
      )}

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="review"
        targetId={review._id}
      />
    </View>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    card: {
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      gap: 8,
    },
    head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
    rowRTL: { flexDirection: "row-reverse" },
    textRTL: { textAlign: "right" },
    who: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.sand,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInitial: { fontFamily: fonts.serif, fontSize: 16, color: colors.ink },
    whoText: { flex: 1, gap: 3 },
    name: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    date: { fontFamily: fonts.regular, fontSize: 11, color: colors.onSurface.muted },
    verified: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.mint,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    verifiedRTL: { alignSelf: "flex-end", flexDirection: "row-reverse" },
    verifiedText: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.primary.deep },
    body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.onSurface.variant },
  });
