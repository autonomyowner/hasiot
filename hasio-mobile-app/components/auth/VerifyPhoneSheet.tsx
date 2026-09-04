import { appAlert } from "@/stores/dialogStore";
import { AppDialogHost } from "@/components/ui/AppDialog";
import React, { useEffect, useState } from "react";
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
import { getAuthErrorKey, sendPhoneOtp, verifyPhoneOtp } from "@/lib/auth";
import { formatPhoneForDisplay, normalizeKsaPhone } from "@/lib/phone";
import { fonts } from "@/constants/colors";
import type { TranslationKey } from "@/constants/translations";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

interface VerifyPhoneSheetProps {
  visible: boolean;
  onClose: () => void;
  onVerified?: () => void;
}

/**
 * Attach a verified phone number to an account that already exists.
 *
 * Accounts created with an email have no number, and booking requires one so
 * the host can reach the guest. This is the same OTP exchange the sign-in
 * screen runs, but against the signed-in session — the server links the number
 * to the current account rather than creating a new one, and refuses a number
 * that already belongs to somebody else.
 *
 * `users.phoneVerified` follows automatically through Better-Auth's onUpdate
 * trigger, so any screen watching the current user updates without a refetch.
 */
export function VerifyPhoneSheet({ visible, onClose, onVerified }: VerifyPhoneSheetProps) {
  const { t, isRTL, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const {
    ref: keyboardRef,
    overlap: keyboardOverlap,
    onLayout: keyboardOnLayout,
  } = useKeyboardOverlap();

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const normalizedPhone = normalizeKsaPhone(phone);
  const locale = language === "ar" ? "ar" : "en";

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const reset = () => {
    setStep("phone");
    setPhone("");
    setCode("");
    setLoading(false);
    setResendIn(0);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const fail = (error: unknown) => appAlert(t("error"), t(getAuthErrorKey(error) as TranslationKey));

  const handleSendCode = async () => {
    if (loading) return;
    if (!normalizedPhone) {
      appAlert(t("error"), t("invalidPhone"));
      return;
    }

    setLoading(true);
    try {
      await sendPhoneOtp(normalizedPhone, locale);
      setCode("");
      setStep("code");
      setResendIn(RESEND_SECONDS);
    } catch (error) {
      fail(error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (submitted: string) => {
    if (loading || !normalizedPhone || submitted.length !== CODE_LENGTH) return;

    setLoading(true);
    try {
      await verifyPhoneOtp(normalizedPhone, submitted, {
        updatePhoneNumber: true,
        locale,
      });
      reset();
      onVerified?.();
      onClose();
    } catch (error) {
      setCode("");
      fail(error);
    } finally {
      setLoading(false);
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
            {
              paddingBottom: keyboardOverlap > 0 ? keyboardOverlap + 24 : insets.bottom + 24,
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.body}>
            <Text style={[styles.title, isRTL && styles.textRTL]}>
              {step === "phone" ? t("verifyPhoneTitle") : t("enterCodeTitle")}
            </Text>
            <Text style={[styles.subtitle, isRTL && styles.textRTL]}>
              {step === "phone"
                ? t("verifyPhoneSubtitle")
                : t("enterCodeSubtitle").replace(
                    "{phone}",
                    formatPhoneForDisplay(normalizedPhone)
                  )}
            </Text>

            {step === "phone" ? (
              <>
                {/* A phone number reads left-to-right in both languages, so the
                    +966 chip and the digits keep their order in Arabic too. */}
                <View style={styles.phoneRow}>
                  <View style={styles.countryChip}>
                    <Text style={styles.countryChipText}>+966</Text>
                  </View>
                  <ThemedTextInput
                    style={[styles.input, styles.phoneInput]}
                    isRTL={false}
                    placeholder={t("phonePlaceholder")}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textAlign="left"
                    textContentType="telephoneNumber"
                    autoComplete="tel"
                    returnKeyType="go"
                    onSubmitEditing={handleSendCode}
                    autoFocus
                  />
                </View>

                <Pressable
                  onPress={handleSendCode}
                  disabled={loading || !normalizedPhone}
                  style={[
                    styles.submitButton,
                    (loading || !normalizedPhone) && styles.submitButtonDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("sendCode")}
                  accessibilityState={{ disabled: loading || !normalizedPhone, busy: loading }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>{t("sendCode")}</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <ThemedTextInput
                  style={[styles.input, styles.codeInput]}
                  isRTL={false}
                  value={code}
                  onChangeText={(next) => {
                    const digits = next.replace(/\D/g, "").slice(0, CODE_LENGTH);
                    setCode(digits);
                    if (digits.length === CODE_LENGTH) handleVerify(digits);
                  }}
                  keyboardType="number-pad"
                  maxLength={CODE_LENGTH}
                  textAlign="center"
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  autoFocus
                  editable={!loading}
                />

                <Pressable
                  onPress={() => handleVerify(code)}
                  disabled={loading || code.length !== CODE_LENGTH}
                  style={[
                    styles.submitButton,
                    (loading || code.length !== CODE_LENGTH) && styles.submitButtonDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("verifyCode")}
                  accessibilityState={{ disabled: loading, busy: loading }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>{t("verifyCode")}</Text>
                  )}
                </Pressable>

                <View style={styles.linkRow}>
                  <Pressable
                    onPress={handleSendCode}
                    disabled={resendIn > 0 || loading}
                    accessibilityRole="button"
                    accessibilityLabel={t("resendCode")}
                    accessibilityState={{ disabled: resendIn > 0 || loading }}
                  >
                    <Text style={styles.linkMuted}>
                      {resendIn > 0 ? (
                        t("resendIn").replace("{seconds}", String(resendIn))
                      ) : (
                        <Text style={styles.link}>{t("resendCode")}</Text>
                      )}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setStep("phone");
                      setCode("");
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t("changeNumber")}
                  >
                    <Text style={styles.link}>{t("changeNumber")}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* This sheet is a native Modal, so an alert fired from inside it needs
          its own host or it renders behind. */}
      <AppDialogHost />
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
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: "#1A1A1A",
  },
  subtitle: {
    fontSize: 15,
    color: "#737373",
    lineHeight: 22,
  },
  textRTL: {
    textAlign: "right",
  },
  phoneRow: {
    flexDirection: "row",
    gap: 8,
  },
  countryChip: {
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#F1EDE6",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    justifyContent: "center",
    alignItems: "center",
  },
  countryChipText: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: "#404040",
  },
  input: {
    height: 52,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  phoneInput: {
    flex: 1,
  },
  codeInput: {
    fontSize: 24,
    fontFamily: fonts.bold,
    letterSpacing: 8,
    height: 60,
  },
  submitButton: {
    height: 52,
    backgroundColor: "#0D7A5F",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  link: {
    fontSize: 15,
    color: "#0D7A5F",
    fontFamily: fonts.semibold,
  },
  linkMuted: {
    fontSize: 15,
    color: "#737373",
  },
});
