import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import type { TranslationKey } from "@/constants/translations";
import type { ChatMessage } from "@/types";

interface PlanCardProps {
  plan: NonNullable<ChatMessage["plan"]>;
  isRTL: boolean;
  t: (key: TranslationKey) => string;
}

/**
 * The finished itinerary, as a card rather than one long bubble. The plan is
 * the thing the whole conversation exists to produce, so it gets a surface of
 * its own instead of being concatenated into the chat text.
 */
export function PlanCard({ plan, isRTL, t }: PlanCardProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.card}>
      <View style={styles.band}>
        <View style={[styles.eyebrowRow, isRTL && styles.rowRTL]}>
          <Feather name="map" size={15} color={colors.ink} />
          <Text style={[styles.eyebrow, isRTL && styles.textRTL]}>{t("itinerary")}</Text>
        </View>
        <Text style={[styles.title, isRTL && styles.textRTL]}>{t("yourPlan")}</Text>
      </View>

      <View style={styles.body}>
        <Text style={[styles.itinerary, isRTL && styles.textRTL]}>{plan.itinerary}</Text>

        {plan.tips ? (
          <>
            <View style={styles.divider} />
            <Text style={[styles.sectionEyebrow, isRTL && styles.textRTL]}>
              {t("travelTips")}
            </Text>
            <Text style={[styles.sectionText, isRTL && styles.textRTL]}>{plan.tips}</Text>
          </>
        ) : null}

        {plan.budget ? (
          <>
            <View style={styles.divider} />
            <Text style={[styles.sectionEyebrow, isRTL && styles.textRTL]}>
              {t("estimatedBudget")}
            </Text>
            <Text style={[styles.sectionText, isRTL && styles.textRTL]}>{plan.budget}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    card: {
      borderRadius: 24,
      // The lime band bleeds to the card's edge, so the radius has to clip it.
      overflow: "hidden",
      backgroundColor: colors.surface.DEFAULT,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    // Lime is a fill only; everything drawn on it is ink.
    band: {
      backgroundColor: colors.primary.DEFAULT,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    eyebrowRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    rowRTL: {
      flexDirection: "row-reverse",
    },
    eyebrow: {
      fontSize: 10.5,
      fontFamily: fonts.semibold,
      color: colors.ink,
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
    title: {
      fontSize: 22,
      fontFamily: fonts.serif,
      color: colors.ink,
      marginTop: 4,
    },
    body: {
      padding: 16,
    },
    itinerary: {
      fontSize: 14,
      lineHeight: 22,
      fontFamily: fonts.regular,
      color: colors.ink,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.divider,
      marginVertical: 14,
    },
    sectionEyebrow: {
      fontSize: 11,
      fontFamily: fonts.semibold,
      color: colors.onSurface.muted,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      marginBottom: 6,
    },
    sectionText: {
      fontSize: 13.5,
      lineHeight: 20,
      fontFamily: fonts.regular,
      color: colors.onSurface.variant,
    },
    textRTL: {
      textAlign: "right",
    },
  });
