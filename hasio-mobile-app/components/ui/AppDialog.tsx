import React, { useEffect, useId } from "react";
import { View, Text, Modal, Pressable, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import { useDialogStore, type AppAlertButton } from "@/stores/dialogStore";

/**
 * Renders the branded alert dialog fired via `appAlert()`.
 *
 * Mount one at the root layout, and one inside any native Modal that fires
 * alerts while open — the dialog shows in the topmost mounted host, which is
 * what lets it appear above an open modal (a single root host would render
 * behind it on iOS).
 */
export function AppDialogHost() {
  const styles = useThemedStyles(makeStyles);
  const hostId = useId();
  const { isRTL } = useLanguage();
  const visible = useDialogStore((s) => s.visible);
  const title = useDialogStore((s) => s.title);
  const message = useDialogStore((s) => s.message);
  const buttons = useDialogStore((s) => s.buttons);
  const hosts = useDialogStore((s) => s.hosts);
  const hide = useDialogStore((s) => s.hide);
  const registerHost = useDialogStore((s) => s.registerHost);
  const unregisterHost = useDialogStore((s) => s.unregisterHost);

  useEffect(() => {
    registerHost(hostId);
    return () => unregisterHost(hostId);
  }, [hostId, registerHost, unregisterHost]);

  const isTopHost = hosts[hosts.length - 1] === hostId;
  if (!visible || !isTopHost) return null;

  const destructive = buttons.some((b) => b.style === "destructive");
  const cancelButton = buttons.find((b) => b.style === "cancel");

  const press = (button: AppAlertButton) => {
    hide();
    button.onPress?.();
  };

  // Back button / backdrop behave like Alert: dismiss via the cancel action
  // when there is one, or plainly when there is only a single button.
  const dismiss = () => {
    if (cancelButton) {
      press(cancelButton);
    } else if (buttons.length <= 1) {
      hide();
      buttons[0]?.onPress?.();
    }
  };

  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Animated.View entering={FadeInDown.duration(220)}>
          {/* Stops backdrop presses from falling through the card. */}
          <Pressable style={styles.card}>
            <View style={[styles.iconCircle, destructive && styles.iconCircleDestructive]}>
              <Feather
                name={destructive ? "alert-triangle" : "info"}
                size={22}
                color={destructive ? colors.signOut : colors.primary.DEFAULT}
              />
            </View>
            <Text style={[styles.title, isRTL && styles.textRTL]}>{title}</Text>
            {message ? (
              <Text style={[styles.message, isRTL && styles.textRTL]}>{message}</Text>
            ) : null}

            <View style={styles.buttonColumn}>
              {[...buttons]
                .sort((a, b) => (a.style === "cancel" ? 1 : 0) - (b.style === "cancel" ? 1 : 0))
                .map((button, i) => {
                  const isCancel = button.style === "cancel";
                  const isDestructive = button.style === "destructive";
                  return (
                    <Pressable
                      key={`${button.text}-${i}`}
                      style={[
                        styles.button,
                        isDestructive && styles.buttonDestructive,
                        isCancel && styles.buttonCancel,
                      ]}
                      onPress={() => press(button)}
                      accessibilityRole="button"
                      accessibilityLabel={button.text}
                    >
                      <Text
                        style={[
                          styles.buttonText,
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

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(31, 29, 23, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
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
  buttonText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: "#FFFFFF",
  },
  buttonTextCancel: {
    color: colors.onSurface.variant,
  },
});
