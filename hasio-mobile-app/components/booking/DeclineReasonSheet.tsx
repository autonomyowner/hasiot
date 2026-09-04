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
import { fonts } from "@/constants/colors";

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
              placeholderTextColor="#A3A3A3"
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
                <ActivityIndicator color="#FFFFFF" />
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  avoider: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
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
    fontSize: 20,
    fontFamily: fonts.bold,
    color: "#1A1A1A",
  },
  label: {
    fontSize: 14,
    color: "#737373",
  },
  textRTL: {
    textAlign: "right",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  declineButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#B91C1C",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  declineButtonText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
  },
  cancelButton: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: "#737373",
  },
});
