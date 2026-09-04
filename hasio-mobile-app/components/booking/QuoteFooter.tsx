import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLanguage } from "@/hooks/useLanguage";
import { getBookingErrorKey } from "@/lib/bookingError";
import type { QuoteFooterState } from "@/lib/bookingDisplay";
import { fonts } from "@/constants/colors";

const GREEN = "#0D7A5F";
// Tall enough for the two-line total row; every other state is laid out
// inside the same box so the button below never moves.
const SLOT_HEIGHT = 30;

interface QuoteFooterProps {
  state: QuoteFooterState;
  submitting: boolean;
  onSubmit: () => void;
}

/**
 * The pinned summary + action.
 *
 * One fixed-height slot for whatever the quote is doing. A stale total (a
 * refetch is in flight) stays on screen at reduced opacity with a small
 * "updating" hint rather than blinking out — the guest is looking at *that
 * number* while they bump the guest count, and it should change in place.
 */
export function QuoteFooter({ state, submitting, onSubmit }: QuoteFooterProps) {
  const { t, isRTL } = useLanguage();
  const insets = useSafeAreaInsets();

  const canSubmit = state.kind === "total" && !state.stale && !submitting;

  return (
    <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.slot} accessibilityLiveRegion="polite">
        {state.kind === "idle" && <Text style={styles.hint}>{t("selectDatesHint")}</Text>}

        {state.kind === "loading" && (
          <View style={[styles.totalRow, isRTL && styles.totalRowRTL]}>
            <Text style={styles.hint}>{t("calculatingTotal")}</Text>
            <Skeleton radius={6} style={styles.totalSkeleton} />
          </View>
        )}

        {state.kind === "error" && (
          <Text style={styles.errorText} numberOfLines={2}>
            {t(getBookingErrorKey(new Error(state.message)))}
          </Text>
        )}

        {state.kind === "unavailable" && (
          <Text style={styles.errorText}>{t("noAvailability")}</Text>
        )}

        {state.kind === "total" && (
          <View style={[styles.totalRow, isRTL && styles.totalRowRTL, state.stale && styles.stale]}>
            <Text style={styles.totalBreakdown}>
              {state.stale
                ? t("updatingTotal")
                : `${state.nights} × ${t("sar")} ${state.pricePerNight}`}
            </Text>
            <Text style={styles.totalAmount}>
              {`${t("sar")} ${state.totalAmount.toLocaleString("en-US")}`}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.pendingNote}>{t("bookingPendingNote")}</Text>

      <Pressable
        onPress={onSubmit}
        disabled={!canSubmit}
        style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
        accessibilityRole="button"
        accessibilityLabel={t("requestBooking")}
        accessibilityState={{ disabled: !canSubmit, busy: submitting }}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>{t("requestBooking")}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E9E5DE",
    gap: 10,
  },
  slot: {
    minHeight: SLOT_HEIGHT,
    justifyContent: "center",
  },
  hint: {
    fontSize: 14,
    color: "#737373",
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  totalRowRTL: {
    flexDirection: "row-reverse",
  },
  stale: {
    opacity: 0.55,
  },
  totalBreakdown: {
    fontSize: 14,
    color: "#737373",
  },
  totalAmount: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: "#1A1A1A",
    fontVariant: ["tabular-nums"],
  },
  // Same box the SAR total will occupy, so loading → total is a swap in place.
  totalSkeleton: {
    width: 88,
    height: 22,
  },
  pendingNote: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8A8178",
  },
  errorText: {
    fontSize: 14,
    color: "#B91C1C",
  },
  primaryButton: {
    height: 52,
    backgroundColor: GREEN,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
  },
});
