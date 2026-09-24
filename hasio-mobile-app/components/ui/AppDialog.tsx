import React, { useCallback, useEffect, useId, useRef } from "react";
import {
  View,
  Text,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import { useDialogStore, type AppAlertButton } from "@/stores/dialogStore";

/**
 * How long to wait for iOS to report the dialog gone before assuming it.
 * The fade itself is ~300ms; this only matters when `onDismiss` never comes —
 * a Modal that never actually presented is never dismissed either — and
 * without it the queue would wait forever.
 */
const SETTLE_FALLBACK_MS = 700;

/**
 * Renders the branded alert dialog fired via `appAlert()`.
 *
 * Mount one at the root layout, and one inside any native Modal that fires
 * alerts while open — the dialog shows in the topmost mounted host, which is
 * what lets it appear above an open modal (a single root host would render
 * behind it on iOS).
 *
 * The Modal stays mounted for as long as there is a dialog to show or to fade
 * out, and a pressed button's action runs from the Modal's `onDismiss` — once
 * the dialog has really gone. It used to unmount on the tap and run the action
 * at once, so an action that opened, closed or presented anything raced the
 * fade-out on iOS, where presenting during a dismissal is refused: "Booking
 * cancelled" never showed and took every later alert with it, "Account
 * upgraded → Done" closed the dialog instead of the sheet under it and left an
 * empty screen swallowing every touch, and "Block" left the report sheet
 * stranded on screen.
 */
export function AppDialogHost() {
  const styles = useThemedStyles(makeStyles);
  const hostId = useId();
  const { isRTL } = useLanguage();
  const { height: windowHeight } = useWindowDimensions();
  const current = useDialogStore((s) => s.current);
  const visible = useDialogStore((s) => s.visible);
  const hosts = useDialogStore((s) => s.hosts);
  const hide = useDialogStore((s) => s.hide);
  const settled = useDialogStore((s) => s.settled);
  const registerHost = useDialogStore((s) => s.registerHost);
  const unregisterHost = useDialogStore((s) => s.unregisterHost);

  useEffect(() => {
    registerHost(hostId);
    return () => unregisterHost(hostId);
  }, [hostId, registerHost, unregisterHost]);

  // The action of the button that closed the dialog, run once it has gone.
  const pendingAction = useRef<(() => void) | undefined>(undefined);
  const closing = useRef(false);
  const fallback = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const finish = useCallback(() => {
    // onDismiss and the fallback timer can both arrive; only the first counts,
    // or the second would pop a queued dialog nobody has seen.
    if (!closing.current) return;
    closing.current = false;
    clearTimeout(fallback.current);
    const action = pendingAction.current;
    pendingAction.current = undefined;
    settled();
    action?.();
  }, [settled]);

  const isTopHost = hosts[hosts.length - 1] === hostId;
  if (!current || !isTopHost) return null;

  const { title, message, buttons } = current;
  const destructive = buttons.some((b) => b.style === "destructive");
  const cancelButton = buttons.find((b) => b.style === "cancel");

  const close = (action?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    pendingAction.current = action;
    hide();
    if (Platform.OS === "ios") {
      fallback.current = setTimeout(finish, SETTLE_FALLBACK_MS);
    } else {
      // Android dialogs are separate windows: nothing to wait for, beyond
      // letting this one's `visible={false}` commit first.
      requestAnimationFrame(finish);
    }
  };

  // Back button / backdrop behave like Alert: dismiss via the cancel action
  // when there is one, or plainly when there is only a single button.
  const dismiss = () => {
    if (cancelButton) {
      close(cancelButton.onPress);
    } else if (buttons.length <= 1) {
      close(buttons[0]?.onPress);
    }
  };

  const orderedButtons = [...buttons].sort(
    (a, b) => (a.style === "cancel" ? 1 : 0) - (b.style === "cancel" ? 1 : 0)
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismiss}
      onDismiss={finish}
    >
      {/* `accessible={false}` on both pressables: an accessible view hides
          everything inside it from VoiceOver, so the whole alert used to be
          one element whose double-tap was "dismiss" — Confirm, Delete and
          Sign out could not be reached with a screen reader at all. */}
      <Pressable style={styles.backdrop} onPress={dismiss} accessible={false}>
        <Animated.View entering={FadeInDown.duration(220)} style={styles.cardWrap}>
          {/* Stops backdrop presses from falling through the card. */}
          <Pressable style={styles.card} accessible={false} accessibilityViewIsModal>
            <View style={[styles.iconCircle, destructive && styles.iconCircleDestructive]}>
              <Feather
                name={destructive ? "alert-triangle" : "info"}
                size={22}
                color={destructive ? colors.signOut : colors.primary.deep}
              />
            </View>
            <Text
              style={[styles.title, isRTL && styles.textRTL]}
              accessibilityRole="header"
            >
              {title}
            </Text>
            {message ? (
              // A long message scrolls inside the card rather than pushing the
              // buttons off the bottom of the screen.
              <ScrollView
                style={{ maxHeight: windowHeight * 0.4 }}
                contentContainerStyle={styles.messageContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <Text style={[styles.message, isRTL && styles.textRTL]}>{message}</Text>
              </ScrollView>
            ) : null}

            <View style={styles.buttonColumn}>
              {orderedButtons.map((button, i) => {
                const isCancel = button.style === "cancel";
                const isDestructive = button.style === "destructive";
                return (
                  <Pressable
                    key={`${button.text}-${i}`}
                    style={({ pressed }) => [
                      styles.button,
                      isDestructive && styles.buttonDestructive,
                      isCancel && styles.buttonCancel,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => close(button.onPress)}
                    accessibilityRole="button"
                    accessibilityLabel={button.text}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isDestructive && styles.buttonTextDestructive,
                        isCancel && styles.buttonTextCancel,
                      ]}
                    >
                      {button.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// Kept for the call sites that type their buttons explicitly.
export type { AppAlertButton };

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(31, 29, 23, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  cardWrap: {
    width: "100%",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.mint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  iconCircleDestructive: {
    backgroundColor: "#F9E8E4",
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 22,
    color: colors.ink,
    textAlign: "center",
    marginBottom: 6,
  },
  messageContent: {
    flexGrow: 0,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.onSurface.variant,
    textAlign: "center",
  },
  textRTL: {
    writingDirection: "rtl",
  },
  buttonColumn: {
    alignSelf: "stretch",
    marginTop: 20,
    gap: 8,
  },
  button: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.primary.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  buttonDestructive: {
    backgroundColor: colors.signOut,
  },
  buttonCancel: {
    backgroundColor: "transparent",
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.ink,
  },
  // The destructive button keeps a dark red fill, so its label stays white.
  buttonTextDestructive: {
    color: "#FFFFFF",
  },
  buttonTextCancel: {
    color: colors.onSurface.variant,
  },
});
