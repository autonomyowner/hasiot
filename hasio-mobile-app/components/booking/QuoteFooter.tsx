import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrency } from "@/hooks/useCurrency";
import { useNudge } from "@/hooks/useNudge";
import { getBookingErrorKey } from "@/lib/bookingError";
import { displayTotalSar, type QuoteFooterState } from "@/lib/bookingDisplay";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

// Tall enough for the two-line total row; every other state is laid out
// inside the same box so the button below never moves.
const SLOT_HEIGHT = 30;

interface QuoteFooterProps {
  state: QuoteFooterState;
  submitting: boolean;
  onSubmit: () => void;
  /**
   * The button was pressed with nothing it can send yet: no dates, or dates
   * the place cannot take. The footer shakes its reason; the sheet brings the
   * calendar back into view, which is where every such reason is fixed.
   */
  onNotReady?: () => void;
  /**
   * The Android keyboard is up and the form has been lifted above it. The
   * keyboard covers the navigation bar then, so its inset is not added again.
   */
  keyboardOpen?: boolean;
}

/**
 * The pinned summary + action.
 *
 * One fixed-height slot for whatever the quote is doing. A stale total (a
 * refetch is in flight) stays on screen at reduced opacity with a small
 * "updating" hint rather than blinking out — the guest is looking at *that
 * number* while they bump the guest count, and it should change in place.
 */
export function QuoteFooter({
  state,
  submitting,
  onSubmit,
  onNotReady,
  keyboardOpen = false,
}: QuoteFooterProps) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL } = useLanguage();
  const { format, currency } = useCurrency();
  const insets = useSafeAreaInsets();
  const { style: nudgeStyle, nudge } = useNudge();

  const canSubmit = state.kind === "total" && !state.stale && !submitting;
  // A total on its way. It is a moment off, and there is nothing to point
  // the guest at meanwhile, so a press then does nothing.
  const waiting = state.kind === "loading" || (state.kind === "total" && state.stale);
  const errorText =
    state.kind === "error" ? t(getBookingErrorKey(new Error(state.message))) : null;
  // What stands between the guest and sending, in the words the slot shows.
  const blocker =
    state.kind === "idle"
      ? t("quoteIdleHint")
      : state.kind === "unavailable"
        ? t("noAvailability")
        : errorText;
  // The rows mirror as rows; single lines of text have to be told. They sat
  // at the left edge under a right-to-left page.
  const alignText = isRTL && styles.textRTL;

  // The button is never faded out. At 45% opacity until the dates were in, it
  // read on an Android phone as a caption, not a button (see useNudge). So it
  // is always the lime fill, and pressed too early it says what is missing.
  const handlePress = () => {
    if (canSubmit) {
      onSubmit();
      return;
    }
    if (submitting || waiting) return;
    nudge(blocker ?? undefined);
    onNotReady?.();
  };

  return (
    <View style={[styles.footer, { paddingBottom: keyboardOpen ? 16 : insets.bottom + 16 }]}>
      <Animated.View style={[styles.slot, nudgeStyle]} accessibilityLiveRegion="polite">
        {/* Not "tap your arrival, then your departure" again — that already
            sits under "Select your dates" at the top of the page, and the
            footer repeated it word for word. Here: what the total waits on. */}
        {state.kind === "idle" && (
          <Text style={[styles.hint, alignText]}>{t("quoteIdleHint")}</Text>
        )}

        {state.kind === "loading" && (
          <View style={[styles.totalRow, isRTL && styles.totalRowRTL]}>
            <Text style={styles.hint}>{t("calculatingTotal")}</Text>
            <Skeleton radius={6} style={styles.totalSkeleton} />
          </View>
        )}

        {state.kind === "error" && (
          <Text style={[styles.errorText, alignText]} numberOfLines={2}>
            {errorText}
          </Text>
        )}

        {state.kind === "unavailable" && (
          <Text style={[styles.errorText, alignText]}>{t("noAvailability")}</Text>
        )}

        {state.kind === "total" && (
          <View style={[styles.totalRow, isRTL && styles.totalRowRTL, state.stale && styles.stale]}>
            <Text style={styles.totalBreakdown}>
              {state.stale
                ? t("updatingTotal")
                : `${state.nights} × ${format(state.pricePerNight)}`}
            </Text>
            {/* The total the breakdown beside it adds up to — in dollars the
                two used to round apart ("3 × $127" beside "$380"). */}
            <Text style={styles.totalAmount}>
              {format(displayTotalSar(state, currency))}
            </Text>
          </View>
        )}
      </Animated.View>

      <Text style={[styles.pendingNote, alignText]}>{t("bookingPendingNote")}</Text>

      <Pressable
        onPress={handlePress}
        disabled={submitting}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t("requestBooking")}
        accessibilityHint={canSubmit ? undefined : (blocker ?? undefined)}
        accessibilityState={{ disabled: submitting, busy: submitting || waiting }}
      >
        {submitting ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <Text style={styles.primaryButtonText}>{t("requestBooking")}</Text>
        )}
      </Pressable>
    </View>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  // The same pinned bar as the listing sheet's price-and-Book row: one
  // surface, a hairline above it, nothing else drawing a box.
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: colors.surface.DEFAULT,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 10,
  },
  slot: {
    minHeight: SLOT_HEIGHT,
    justifyContent: "center",
  },
  hint: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
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
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
  },
  // The number the whole screen is about, so it is set in the display face.
  totalAmount: {
    fontSize: 24,
    fontFamily: fonts.serif,
    color: colors.ink,
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
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
  },
  errorText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.signOut,
  },
  // Lime is a fill; its label is ink. White on it is 1.4:1.
  primaryButton: {
    minHeight: 50,
    height: 52,
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  textRTL: {
    textAlign: "right",
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
});
