import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedTextInput } from "@/components/ui/ThemedTextInput";
import { useLanguage } from "@/hooks/useLanguage";
import { useKeyboardOverlap } from "@/hooks/useKeyboardOverlap";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

interface DeclineReasonSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void> | void;
}

/**
 * Collect a reason when a host turns a request down.
 *
 * Optional, but asked for: "declined" on its own tells a guest nothing and
 * invites a phone call. "Fully booked those dates" lets them move on.
 */
export function DeclineReasonSheet({ visible, onClose, onSubmit }: DeclineReasonSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL } = useLanguage();
  const insets = useSafeAreaInsets();
  const {
    ref: keyboardRef,
    overlap: keyboardOverlap,
    onLayout: keyboardOnLayout,
  } = useKeyboardOverlap();

  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setReason("");
    setSubmitting(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(reason.trim());
      setReason("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <KeyboardAvoidingView
        style={styles.avoider}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        pointerEvents="box-none"
      >
        <View
          ref={keyboardRef}
          onLayout={keyboardOnLayout}
          style={[
            styles.sheet,
            { paddingBottom: keyboardOverlap > 0 ? keyboardOverlap + 24 : insets.bottom + 24 },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.body}>
            <Text style={[styles.title, isRTL && styles.textRTL]}>{t("declineTitle")}</Text>
            <Text style={[styles.label, isRTL && styles.textRTL]}>{t("declineReasonLabel")}</Text>

            <ThemedTextInput
              style={[styles.input, styles.textArea]}
              isRTL={isRTL}
              value={reason}
              onChangeText={setReason}
              placeholder={t("declineReasonPlaceholder")}
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
              style={[styles.declineButton, submitting && styles.buttonDisabled]}
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

            <Pressable onPress={handleClose} style={styles.cancelButton} accessibilityRole="button">
              <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(31, 29, 23, 0.35)",
  },
  avoider: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  // A sheet is one surface, so the flat fill is right here — with the same
  // 28px top radius every other sheet in the app uses.
  sheet: {
    backgroundColor: colors.surface.DEFAULT,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "85%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 8,
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
});
