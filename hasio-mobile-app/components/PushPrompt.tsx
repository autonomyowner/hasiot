import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useConvexAuth } from "convex/react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useLanguage } from "@/hooks/useLanguage";
import { isPushAvailable, requestPushPermission, syncPushRegistration } from "@/lib/push";
import { isPromptRequestFresh, shouldOfferPush } from "@/lib/pushDecision";
import { useDialogStore } from "@/stores/dialogStore";
import { usePushStore, type PushContext } from "@/stores/pushStore";

/**
 * How long the screen must stay clear before the sheet comes up.
 *
 * A caller asks as its own sheet starts to close, and a Modal is still being
 * dismissed for a moment after its dialog host unmounts. iOS refuses to present
 * anything from a controller that is presenting or mid-dismissal, and React
 * Native never retries: the sheet would silently never appear (CLAUDE.md, the
 * iOS modal rules). This outlasts a page sheet's dismissal, and reads as a
 * beat between two things rather than one thing landing on another.
 */
const SETTLE_MS = 800;

/**
 * "Get booking updates?" — the app's explanation, shown before the system's
 * own permission prompt (design D14).
 *
 * Rendered once, in the root layout, like AppDialogHost; anything asks for it
 * through `maybeAskForPush` (lib/pushPrompt.ts) or the Settings row. It shows
 * only once nothing else is on screen: only the root's dialog host mounted —
 * every sheet and Modal in the app mounts its own while it is up — and no
 * alert up or leaving. So a guest who books and taps "Done" is asked when
 * they close the listing, not over it; an ask that waits past a few minutes
 * is let go, because by then "your request" means nothing.
 *
 * The seven days start when the sheet is shown, not when it was asked for, so
 * an ask that never reached the screen does not use them up.
 */
export function PushPrompt() {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL } = useLanguage();
  const { isAuthenticated } = useConvexAuth();
  const { userId } = useConvexUser();
  const request = usePushStore((state) => state.request);
  const clearRequest = usePushStore((state) => state.clearRequest);
  const clear = useDialogStore((state) => state.hosts.length <= 1 && state.current === null);

  const [visible, setVisible] = useState(false);
  // The wording it opened with, kept while it slides away.
  const [context, setContext] = useState<PushContext>("guest");
  // Set by "Turn on"; the system prompt follows once the sheet has gone.
  const turnOn = useRef(false);

  // Signed out while it was up: nothing left to register the phone to.
  if (visible && !isAuthenticated) setVisible(false);

  useEffect(() => {
    if (!request || visible) return;
    if (!isAuthenticated) {
      clearRequest();
      return;
    }
    if (!clear) return;

    const timer = setTimeout(() => {
      const { permission, lastAskedAt, request: waiting } = usePushStore.getState();
      if (!waiting) return;
      const now = Date.now();
      const due =
        permission !== null &&
        isPromptRequestFresh(waiting.at, now) &&
        shouldOfferPush({
          available: isPushAvailable(),
          signedIn: true,
          permission,
          lastAskedAt,
          now,
          manual: waiting.manual,
        });
      if (!due) {
        usePushStore.getState().clearRequest();
        return;
      }
      usePushStore.getState().markAsked(now);
      turnOn.current = false;
      setContext(waiting.context);
      setVisible(true);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [request, visible, clear, isAuthenticated, clearRequest]);

  const close = () => setVisible(false);

  const handleTurnOn = () => {
    turnOn.current = true;
    setVisible(false);
  };

  // The system prompt comes after this sheet has left, never over it: two
  // questions stacked on each other read as one, and on iOS nothing is
  // presented while a sheet is still being dismissed.
  const handleDismissed = () => {
    clearRequest();
    if (!turnOn.current) return;
    turnOn.current = false;
    const account = userId;
    void (async () => {
      const permission = await requestPushPermission();
      if (permission?.status === "granted" && account) await syncPushRegistration(account);
    })();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      onDismissed={handleDismissed}
      style={styles.body}
      header={
        <View style={[styles.head, isRTL && styles.rowRTL]}>
          <Text style={[styles.title, isRTL && styles.textRTL]}>{t("pushPromptTitle")}</Text>
          <Pressable
            onPress={close}
            hitSlop={12}
            style={({ pressed }) => pressed && styles.pressed}
            accessibilityRole="button"
            accessibilityLabel={t("close")}
          >
            <Feather name="x" size={22} color={colors.ink} />
          </Pressable>
        </View>
      }
    >
      <View style={[styles.lead, isRTL && styles.rowRTL]}>
        <View style={styles.iconDisc}>
          <Feather name="bell" size={20} color={colors.primary.deep} />
        </View>
        <Text style={[styles.message, isRTL && styles.textRTL]}>
          {context === "host" ? t("pushPromptHostBody") : t("pushPromptGuestBody")}
        </Text>
      </View>

      <Pressable
        onPress={handleTurnOn}
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t("pushTurnOn")}
      >
        <Text style={styles.primaryText}>{t("pushTurnOn")}</Text>
      </Pressable>

      <Pressable
        onPress={close}
        style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t("pushNotNow")}
      >
        <Text style={styles.secondaryText}>{t("pushNotNow")}</Text>
      </Pressable>
    </BottomSheet>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    body: { gap: 14 },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    rowRTL: { flexDirection: "row-reverse" },
    textRTL: { textAlign: "right" },
    title: { flex: 1, fontFamily: fonts.serif, fontSize: 24, color: colors.ink },
    lead: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 6 },
    // The mint surface with the dark lime on it: lime itself is a fill and
    // would read at 1.3:1 as an icon on white.
    iconDisc: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.mint,
      alignItems: "center",
      justifyContent: "center",
    },
    message: {
      flex: 1,
      fontFamily: fonts.regular,
      fontSize: 15,
      lineHeight: 22,
      color: colors.onSurface.variant,
    },
    // Lime is a fill, so its label is ink: white on it is 1.4:1.
    primary: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 50,
      borderRadius: 14,
      backgroundColor: colors.primary.DEFAULT,
    },
    primaryText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
    secondary: { alignItems: "center", justifyContent: "center", minHeight: 48 },
    secondaryText: { fontFamily: fonts.medium, fontSize: 15, color: colors.onSurface.variant },
    pressed: { opacity: 0.7 },
  });
