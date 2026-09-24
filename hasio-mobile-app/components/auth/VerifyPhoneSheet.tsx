import { appAlert } from "@/stores/dialogStore";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "@/backend";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ThemedTextInput } from "@/components/ui/ThemedTextInput";
import { useLanguage } from "@/hooks/useLanguage";
import { sendPhoneOtp, verifyPhoneOtp } from "@/lib/auth";
import {
  describeAuthError,
  isCodeStepError,
  type AuthErrorDescription,
} from "@/lib/authErrors";
import { convex } from "@/lib/convex";
import { toLatinDigits } from "@/lib/digits";
import { formatPhoneForDisplay, ltr, normalizeKsaPhone } from "@/lib/phone";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;
const DEMO_FILL_DELAY_MS = 900;

/**
 * The code's tracking, outside the themed stylesheet on purpose: Arabic zeroes
 * letter-spacing there (it pulls joined letters apart), but these are six
 * Latin digits in either language.
 */
const CODE_TRACKING = { letterSpacing: 8 } as const;

interface VerifyPhoneSheetProps {
  visible: boolean;
  onClose: () => void;
  onVerified?: () => void;
  /**
   * The sheet has fully left the screen. Anything that should open next — the
   * booking sheet, after a verification made on the way to booking — waits
   * for this: iOS silently refuses to present a sheet while another is still
   * being dismissed.
   */
  onDismissed?: () => void;
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
 *
 * The code step works as app/auth.tsx's does, for the same reasons — read the
 * comments there: the field is never read-only, has no maxLength, takes Arabic
 * digits, and a wrong or expired code is said under it with the keyboard up.
 */
export function VerifyPhoneSheet({
  visible,
  onClose,
  onVerified,
  onDismissed,
}: VerifyPhoneSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL, language } = useLanguage();
  const locale = language === "ar" ? "ar" : "en";

  const phoneRef = useRef<TextInput>(null);
  const codeRef = useRef<TextInput>(null);

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // The guard against a second request in flight; `loading` is only for
  // drawing and trails a tap by a render.
  const busy = useRef(false);
  const demoFill = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Moves on whenever a code is sent, the number is changed or the sheet
  // closes, so a demo fill armed for one code never lands on another.
  const codeRound = useRef(0);

  // Start clean on opening — not on closing, which is what it used to do: the
  // sheet flipped back to an empty phone step while it was still sliding away.
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setStep("phone");
      setPhone("");
      setCode("");
      setLoading(false);
      setResendIn(0);
      setFieldError(null);
    }
  }

  // Every opening and every closing starts a new session. A guest may close
  // the sheet mid-request (and even open it again before the answer comes);
  // an answer that belongs to an earlier session is dropped rather than acted
  // on — above all, a verification that lands after the sheet was closed must
  // not carry on into the booking it was on the way to.
  const session = useRef(0);
  useEffect(() => {
    session.current += 1;
    // A request left behind by the last session no longer holds this one up.
    busy.current = false;
    if (visible) return;
    codeRound.current += 1;
    if (demoFill.current) {
      clearTimeout(demoFill.current);
      demoFill.current = null;
    }
  }, [visible]);
  useEffect(() => () => { if (demoFill.current) clearTimeout(demoFill.current); }, []);

  const normalizedPhone = normalizeKsaPhone(phone);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const showFieldError = (message: string) => {
    setFieldError(message);
    AccessibilityInfo.announceForAccessibility(message);
  };

  // Drawn by the sheet's own dialog host, above it. OK hands the keyboard back
  // to the field; the dialog only calls it once it has itself gone.
  const alertFailure = (failure: AuthErrorDescription, refocus: () => void) => {
    appAlert(t(failure.title), failure.serverText ?? t(failure.message), [
      { text: t("authOk"), onPress: refocus },
    ]);
  };

  const stopDemoFill = () => {
    codeRound.current += 1;
    if (demoFill.current) {
      clearTimeout(demoFill.current);
      demoFill.current = null;
    }
  };

  const toPhoneStep = () => {
    stopDemoFill();
    setStep("phone");
    setCode("");
    setFieldError(null);
  };

  const verifyLatest = useRef<(submitted: string, target: string) => void>(() => {});

  // Demo mode sends no SMS at all, so without this the guest waits for a text
  // that never comes — the sign-in screen has always filled the code itself,
  // and this sheet, on the way to a booking, did not.
  const armDemoFill = (target: string) => {
    const round = codeRound.current;
    convex.query(api.config.queries.getPublicConfig).then(
      (config) => {
        if (!config?.demoAuth || round !== codeRound.current) return;
        const fake = String(Math.floor(100000 + Math.random() * 900000));
        demoFill.current = setTimeout(() => {
          demoFill.current = null;
          if (round !== codeRound.current) return;
          setCode(fake);
          verifyLatest.current(fake, target);
        }, DEMO_FILL_DELAY_MS);
      },
      () => {}
    );
  };

  const handleSendCode = async () => {
    if (busy.current) return;
    const target = normalizedPhone;
    if (!target) {
      showFieldError(t("invalidPhone"));
      return;
    }

    const mine = session.current;
    busy.current = true;
    setLoading(true);
    setFieldError(null);
    stopDemoFill();
    try {
      await sendPhoneOtp(target, locale);
    } catch (error) {
      if (mine !== session.current) return;
      busy.current = false;
      setLoading(false);
      const failure = describeAuthError(error, locale);
      if (failure.kind === "invalidPhone" && step === "phone") {
        showFieldError(t(failure.message));
      } else {
        const field = step === "code" ? codeRef : phoneRef;
        alertFailure(failure, () => field.current?.focus());
      }
      return;
    }
    if (mine !== session.current) return;

    busy.current = false;
    setLoading(false);
    setCode("");
    setStep("code");
    setResendIn(RESEND_SECONDS);
    armDemoFill(target);
  };

  const verify = async (submitted: string, target: string | null = normalizedPhone) => {
    if (busy.current || !target || submitted.length !== CODE_LENGTH) return;

    const mine = session.current;
    busy.current = true;
    setLoading(true);
    setFieldError(null);
    try {
      await verifyPhoneOtp(target, submitted, {
        updatePhoneNumber: true,
        locale,
      });
    } catch (error) {
      if (mine !== session.current) return;
      busy.current = false;
      setLoading(false);
      setCode("");
      const failure = describeAuthError(error, locale);
      if (isCodeStepError(failure.kind)) {
        showFieldError(t(failure.message));
        if (failure.kind !== "codeWrong") setResendIn(0);
      } else if (failure.kind === "phoneTaken") {
        // The code was right — and is spent — but the number belongs to
        // another account. The only fix is a different number, so the guest
        // is taken back to it, with the reason under the field.
        stopDemoFill();
        setStep("phone");
        showFieldError(t(failure.message));
      } else {
        alertFailure(failure, () => codeRef.current?.focus());
      }
      return;
    }
    // Closed while the code was being checked: the number is verified all the
    // same (the server has already recorded it), but the guest walked away,
    // so nothing opens on their behalf.
    if (mine !== session.current) return;
    busy.current = false;
    // The spinner stays while the sheet slides away; it is reset on the next
    // opening.
    onVerified?.();
    onClose();
  };

  useEffect(() => {
    verifyLatest.current = (submitted, target) => {
      void verify(submitted, target);
    };
  });

  const fieldErrorText = fieldError ? (
    <Text
      style={[styles.fieldError, isRTL && styles.textRTL]}
      accessibilityLiveRegion="polite"
    >
      {fieldError}
    </Text>
  ) : null;

  const sendDisabled = loading || !normalizedPhone;
  const verifyDisabled = loading || code.length !== CODE_LENGTH;
  const resendDisabled = resendIn > 0 || loading;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      bottomPadding={24}
      header={
        <Text style={[styles.title, isRTL && styles.textRTL]}>
          {step === "phone" ? t("verifyPhoneTitle") : t("enterCodeTitle")}
        </Text>
      }
    >
      <View style={styles.body}>
        <Text style={[styles.subtitle, isRTL && styles.textRTL]}>
          {step === "phone"
            ? t("verifyPhoneSubtitle")
            : t("enterCodeSubtitle").replace(
                "{phone}",
                // One left-to-right unit, or Arabic lays the groups out
                // backwards: "4567 123 50 966+".
                ltr(formatPhoneForDisplay(normalizedPhone))
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
                ref={phoneRef}
                style={[styles.input, styles.phoneInput]}
                isRTL={false}
                placeholder={t("phonePlaceholder")}
                value={phone}
                onChangeText={(next) => {
                  setPhone(toLatinDigits(next));
                  if (fieldError) setFieldError(null);
                }}
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
            {fieldErrorText}

            <Pressable
              onPress={handleSendCode}
              disabled={sendDisabled}
              style={({ pressed }) => [
                styles.submitButton,
                sendDisabled && styles.submitButtonDisabled,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("sendCode")}
              accessibilityState={{ disabled: sendDisabled, busy: loading }}
            >
              {loading ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Text style={styles.submitButtonText}>{t("sendCode")}</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <ThemedTextInput
              ref={codeRef}
              style={[styles.input, styles.codeInput, CODE_TRACKING]}
              isRTL={false}
              value={code}
              onChangeText={(next) => {
                const digits = toLatinDigits(next).replace(/\D/g, "").slice(0, CODE_LENGTH);
                setCode(digits);
                if (fieldError) setFieldError(null);
                if (digits.length === CODE_LENGTH) void verify(digits);
              }}
              keyboardType="number-pad"
              textAlign="center"
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              autoFocus
            />
            {fieldErrorText}

            <Pressable
              onPress={() => void verify(code)}
              disabled={verifyDisabled}
              style={({ pressed }) => [
                styles.submitButton,
                verifyDisabled && styles.submitButtonDisabled,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("verifyCode")}
              accessibilityState={{ disabled: verifyDisabled, busy: loading }}
            >
              {loading ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Text style={styles.submitButtonText}>{t("verifyCode")}</Text>
              )}
            </Pressable>

            <View style={[styles.linkRow, isRTL && styles.rowRTL]}>
              <Pressable
                onPress={handleSendCode}
                disabled={resendDisabled}
                hitSlop={12}
                style={({ pressed }) => pressed && styles.pressed}
                accessibilityRole="button"
                accessibilityLabel={t("resendCode")}
                accessibilityState={{ disabled: resendDisabled }}
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
                onPress={toPhoneStep}
                hitSlop={12}
                style={({ pressed }) => pressed && styles.pressed}
                accessibilityRole="button"
                accessibilityLabel={t("changeNumber")}
              >
                <Text style={styles.link}>{t("changeNumber")}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  // The title lives in the sheet's drag zone; this keeps the subtitle the
  // same 16pt below it that separates everything else.
  body: {
    gap: 16,
    paddingTop: 10,
  },
  rowRTL: {
    flexDirection: "row-reverse",
  },
  pressed: {
    opacity: 0.7,
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.serif,
    color: colors.ink,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
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
    borderRadius: 14,
    backgroundColor: colors.chip,
    justifyContent: "center",
    alignItems: "center",
  },
  countryChipText: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.onSurface.variant,
  },
  input: {
    height: 52,
    backgroundColor: colors.surface.variant,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.border,
  },
  phoneInput: {
    flex: 1,
  },
  // The code is the one display-scale thing on the sheet, so it is set in
  // the serif like every other headline number in the app.
  codeInput: {
    fontSize: 28,
    fontFamily: fonts.serif,
    height: 62,
  },
  // Pulled up into the body's 16pt gap so it reads as belonging to the field
  // above it rather than to the button below.
  fieldError: {
    marginTop: -8,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.medium,
    color: colors.signOut,
  },
  // Lime is a fill; its label is ink. White on it is 1.4:1.
  submitButton: {
    minHeight: 50,
    height: 52,
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  // "Lime as text" is the dark lime tone: the fill itself is 1.3:1 on paper.
  link: {
    fontSize: 15,
    color: colors.primary.deep,
    fontFamily: fonts.semibold,
  },
  linkMuted: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
  },
});
