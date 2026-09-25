import React, { useState } from "react";
import { Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ThemedTextInput } from "@/components/ui/ThemedTextInput";
import { useLanguage } from "@/hooks/useLanguage";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

interface DeclineReasonSheetProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Send the decline; resolve true once it has gone through. The caller
   * closes the sheet then — not before sending, as it used to, which took the
   * spinner away with the sheet and threw out the reason when the send
   * failed. On false the sheet stays up with the reason as typed.
   */
  onSubmit: (reason: string) => Promise<boolean>;
  /** A service request gets an example reason about the day, not about rooms. */
  kind?: string;
}

/**
 * Collect a reason when a host or provider turns a request down.
 *
 * Optional, but asked for: "declined" on its own tells a guest nothing and
 * invites a phone call. "Fully booked those dates" lets them move on.
 */
export function DeclineReasonSheet({ visible, onClose, onSubmit, kind }: DeclineReasonSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL } = useLanguage();

  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Cleared as the sheet opens rather than as it closes, which blanked the
  // reason while the sheet was still sliding away with it.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setReason("");
      setSubmitting(false);
    }
  }

  // The backdrop, the drag and Android's back button all come here: none of
  // them closes the sheet while the decline is on its way.
  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    let sent = false;
    try {
      sent = await onSubmit(reason.trim());
    } finally {
      // Sent, the sheet is on its way out: keep the spinner rather than flash
      // the label back while it leaves. The next opening starts clean.
      if (!sent) setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      style={styles.body}
      header={
        <Text style={[styles.title, isRTL && styles.textRTL]}>{t("declineTitle")}</Text>
      }
    >
      <Text style={[styles.label, isRTL && styles.textRTL]}>{t("declineReasonLabel")}</Text>

      <ThemedTextInput
        style={[styles.input, styles.textArea]}
        isRTL={isRTL}
        value={reason}
        onChangeText={setReason}
        placeholder={t(kind === "service" ? "declineReasonPlaceholderService" : "declineReasonPlaceholder")}
        placeholderTextColor={colors.onSurface.muted}
        multiline
        numberOfLines={3}
        maxLength={500}
        textAlign={isRTL ? "right" : "left"}
        autoFocus
      />

      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        style={({ pressed }) => [
          styles.declineButton,
          submitting && styles.buttonDisabled,
          pressed && !submitting && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t("declineBooking")}
        accessibilityState={{ disabled: submitting, busy: submitting }}
      >
        {submitting ? (
          <ActivityIndicator color={colors.surface.DEFAULT} />
        ) : (
          <Text style={styles.declineButtonText}>{t("declineBooking")}</Text>
        )}
      </Pressable>

      <Pressable
        onPress={handleClose}
        disabled={submitting}
        style={({ pressed }) => [
          styles.cancelButton,
          submitting && styles.buttonDisabled,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: submitting }}
      >
        <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
      </Pressable>
    </BottomSheet>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  body: {
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.serif,
    color: colors.ink,
  },
  label: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
  },
  textRTL: {
    textAlign: "right",
  },
  input: {
    backgroundColor: colors.surface.variant,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  // The one place a filled destructive button is right: it is the sheet's
  // whole purpose. The destructive token is dark enough to carry the white
  // label at 7:1 — unlike lime, which never can.
  declineButton: {
    minHeight: 50,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.signOut,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  declineButtonText: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.surface.DEFAULT,
  },
  cancelButton: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.onSurface.variant,
  },
  pressed: {
    opacity: 0.7,
  },
});
