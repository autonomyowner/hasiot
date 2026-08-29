import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fonts } from "@/constants/colors";
import { useLanguage } from "@/hooks/useLanguage";
import type { VerificationStatus } from "@/hooks/useConvexUser";

interface VerificationBannerProps {
  status: VerificationStatus;
  onPress: () => void;
  isRTL: boolean;
}

/**
 * Shown on the business/provider dashboards while the account still needs
 * admin approval. Renders nothing once approved.
 */
export function VerificationBanner({
  status,
  onPress,
  isRTL,
}: VerificationBannerProps) {
  const { t } = useLanguage();

  if (status === "approved") return null;

  const isPending = status === "pending";

  return (
    <Pressable
      style={[styles.card, isPending ? styles.cardPending : styles.cardUnverified]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        isPending ? t("verificationPendingCta") : t("verificationUnverifiedCta")
      }
    >
      <View style={[styles.row, isRTL && styles.rowRTL]}>
        <Feather
          name={isPending ? "clock" : "alert-circle"}
          size={20}
          color={isPending ? colors.warning : colors.attention}
        />
        <View style={[styles.textWrap, isRTL && styles.alignEnd]}>
          <Text style={[styles.title, isRTL && styles.textRTL]}>
            {isPending
              ? t("verificationPendingTitle")
              : t("verificationUnverifiedTitle")}
          </Text>
          <Text style={[styles.body, isRTL && styles.textRTL]}>
            {isPending
              ? t("verificationPendingBody")
              : t("verificationUnverifiedBody")}
          </Text>
        </View>
      </View>

      <View style={[styles.ctaRow, isRTL && styles.rowRTL]}>
        <View style={styles.ctaPill}>
          <Text style={styles.ctaText}>
            {isPending
              ? t("verificationPendingCta")
              : t("verificationUnverifiedCta")}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 24,
    marginTop: 20,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  cardPending: { backgroundColor: "#FDF6EC", borderColor: "#F0DFC4" },
  cardUnverified: { backgroundColor: "#FCEFEC", borderColor: "#F2D6CF" },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  rowRTL: { flexDirection: "row-reverse" },
  textWrap: { flex: 1 },
  alignEnd: { alignItems: "flex-end" },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.ink,
    marginBottom: 2,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.onSurface.variant,
  },
  textRTL: { textAlign: "right" },
  ctaRow: { flexDirection: "row", marginTop: 12 },
  ctaPill: {
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  ctaText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: "#FFFFFF",
  },
});

export default VerificationBanner;
