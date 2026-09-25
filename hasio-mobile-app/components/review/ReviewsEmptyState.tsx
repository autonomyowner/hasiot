import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";

/**
 * The reviews page of a place or a service that nobody has reviewed.
 *
 * The page used to open onto a lone summary saying the same thing in small
 * type, over a list with nothing in it. Centred in either language, so its
 * text is centred too, like the app's other empty states.
 */
export function ReviewsEmptyState() {
  const styles = useThemedStyles(makeStyles);
  const { t } = useLanguage();

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={styles.icon}>
        <Feather name="star" size={24} color={colors.primary.deep} />
      </View>
      <Text style={styles.title}>{t("reviewsNone")}</Text>
      <Text style={styles.body}>{t("reviewsEmptyHint")}</Text>
    </View>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    wrap: {
      alignItems: "center",
      paddingHorizontal: 32,
      paddingTop: 72,
      paddingBottom: 24,
      gap: 8,
    },
    // The mint chip surface with the dark lime on it: lime itself is a fill.
    icon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.mint,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    title: {
      fontFamily: fonts.serif,
      fontSize: 22,
      color: colors.ink,
      textAlign: "center",
    },
    body: {
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
      color: colors.onSurface.variant,
      textAlign: "center",
    },
  });
