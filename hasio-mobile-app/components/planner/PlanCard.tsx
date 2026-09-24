import React, { memo, useCallback } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import type { TranslationKey } from "@/constants/translations";
import type { ChatPlan } from "@/types";

/** A place the plan names that the app has a page for. */
export interface PlanPlace {
  /** The listing's id. */
  id: string;
  /** Its name in the reader's language. */
  label: string;
}

interface PlanCardProps {
  plan: ChatPlan;
  isRTL: boolean;
  t: (key: TranslationKey) => string;
  places: PlanPlace[];
  onOpenPlace?: (listingId: string) => void;
}

/**
 * The finished itinerary, as a card rather than one long bubble. The plan is
 * the thing the whole conversation exists to produce, so it gets a surface of
 * its own instead of being concatenated into the chat text.
 *
 * It used to be a dead end: the places it was built around could not be
 * opened, it could not leave the app, and the "check opening hours before you
 * go" the server attaches to every plan was dropped before it got here.
 */
export const PlanCard = memo(function PlanCard({
  plan,
  isRTL,
  t,
  places,
  onOpenPlace,
}: PlanCardProps) {
  const styles = useThemedStyles(makeStyles);

  // Plain text, in the card's order, so it reads the same in a message, a
  // note or an email.
  const share = useCallback(() => {
    const message = [
      t("yourPlan"),
      plan.itinerary,
      plan.tips ? `${t("travelTips")}\n${plan.tips}` : "",
      plan.budget ? `${t("estimatedBudget")}\n${plan.budget}` : "",
      plan.disclaimer ?? "",
    ]
      .filter(Boolean)
      .join("\n\n");
    // Dismissing the share sheet resolves, it does not reject; a failure to
    // open it at all leaves nothing the guest can do about it.
    Share.share({ message }, { dialogTitle: t("sharePlan") }).catch(() => {});
  }, [plan, t]);

  // Sections present on this plan, so a divider only ever sits between two.
  const sections: { key: string; eyebrow?: string; body: string }[] = [];
  if (plan.itinerary) sections.push({ key: "itinerary", body: plan.itinerary });
  if (plan.tips) sections.push({ key: "tips", eyebrow: t("travelTips"), body: plan.tips });
  if (plan.budget) {
    sections.push({ key: "budget", eyebrow: t("estimatedBudget"), body: plan.budget });
  }

  return (
    <View style={styles.card}>
      <View style={[styles.band, isRTL && styles.rowRTL]}>
        <View style={styles.bandText}>
          <View style={[styles.eyebrowRow, isRTL && styles.rowRTL]}>
            <Feather name="map" size={15} color={colors.ink} />
            <Text style={[styles.eyebrow, isRTL && styles.textRTL]}>{t("itinerary")}</Text>
          </View>
          <Text style={[styles.title, isRTL && styles.textRTL]}>{t("yourPlan")}</Text>
        </View>
        <Pressable
          onPress={share}
          hitSlop={4}
          style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={t("sharePlan")}
        >
          <Feather name="share-2" size={17} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.body}>
        {sections.map((section, index) => (
          <View key={section.key}>
            {index > 0 && <View style={styles.divider} />}
            {section.eyebrow ? (
              <Text style={[styles.sectionEyebrow, isRTL && styles.textRTL]}>
                {section.eyebrow}
              </Text>
            ) : null}
            <Text
              style={[
                section.eyebrow ? styles.sectionText : styles.itinerary,
                isRTL && styles.textRTL,
              ]}
            >
              {section.body}
            </Text>
          </View>
        ))}

        {/* The places the plan was built around, each opening its own page.
            Only the ones the app has a listing for: a chip that opens nothing
            is worse than no chip, and the itinerary still names the rest. */}
        {places.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={[styles.sectionEyebrow, isRTL && styles.textRTL]}>
              {t("plannerPlacesTitle")}
            </Text>
            <View style={[styles.chips, isRTL && styles.rowRTL]}>
              {places.map((place) => (
                <Pressable
                  key={place.id}
                  onPress={() => onOpenPlace?.(place.id)}
                  disabled={!onOpenPlace}
                  hitSlop={{ top: 4, bottom: 4 }}
                  style={({ pressed }) => [
                    styles.chip,
                    isRTL && styles.rowRTL,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={place.label}
                >
                  <Feather name="map-pin" size={13} color={colors.primary.deep} />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {place.label}
                  </Text>
                  <Feather
                    name={isRTL ? "chevron-left" : "chevron-right"}
                    size={14}
                    color={colors.onSurface.muted}
                  />
                </Pressable>
              ))}
            </View>
          </>
        )}

        {plan.disclaimer ? (
          <View style={[styles.disclaimerRow, isRTL && styles.rowRTL]}>
            <Feather name="info" size={13} color={colors.onSurface.muted} />
            <Text style={[styles.disclaimer, isRTL && styles.textRTL]}>{plan.disclaimer}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});

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
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.primary.DEFAULT,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    bandText: {
      flex: 1,
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
    // 40pt plus the slop: a target a thumb finds without aiming.
    shareButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(31, 29, 23, 0.08)",
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
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    // Mint takes the dark lime or ink, never lime itself.
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      maxWidth: "100%",
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: colors.mint,
    },
    chipText: {
      flexShrink: 1,
      fontSize: 13,
      fontFamily: fonts.medium,
      color: colors.ink,
    },
    disclaimerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      marginTop: 16,
    },
    disclaimer: {
      flex: 1,
      fontSize: 12,
      lineHeight: 17,
      fontFamily: fonts.regular,
      color: colors.onSurface.muted,
    },
    textRTL: {
      textAlign: "right",
    },
    pressed: {
      opacity: 0.7,
    },
  });
