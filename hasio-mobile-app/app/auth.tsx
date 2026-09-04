import { appAlert } from "@/stores/dialogStore";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Linking,
} from "react-native";
import { ThemedTextInput } from "@/components/ui/ThemedTextInput";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLanguage } from "@/hooks/useLanguage";
import { useKeyboardOverlap } from "@/hooks/useKeyboardOverlap";
import { api } from "@/backend";
import {
  getAuthErrorKey,
  sendPhoneOtp,
  signIn,
  signOut,
  verifyPhoneOtp,
} from "@/lib/auth";
import { formatPhoneForDisplay, normalizeKsaPhone } from "@/lib/phone";
import { convex, refreshAuth } from "@/lib/convex";
import { useAppStore } from "@/stores/appStore";
import { type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

// Served from the website's public/ — the same pair Settings links to.
const PRIVACY_POLICY_URL = "https://www.hasio.xyz/privacy-policy.html";
const TERMS_OF_SERVICE_URL = "https://www.hasio.xyz/terms-of-service.html";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

/**
 * Sign-in.
 *
 * Phone first: a Saudi traveller expects a number and a code, not an email and
 * a password, and a verified number is what lets a host call a guest who is
 * late. Email sign-in survives as a secondary path for accounts made before
 * this existed and for staff reaching the admin panel — but it no longer
 * creates accounts, so there is exactly one way to become a user.
 */
export default function AuthScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, isRTL, language } = useLanguage();
  const {
    ref: keyboardRef,
    overlap: keyboardOverlap,
    onLayout: keyboardOnLayout,
  } = useKeyboardOverlap();
  const setOnboardingComplete = useAppStore((state) => state.setOnboardingComplete);

  const passwordRef = useRef<TextInput>(null);

  const [step, setStep] = useState<"phone" | "code" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // The E.164 form, or null while the number is still incomplete. Doubles as
  // the enabled/disabled state for the button.
  const normalizedPhone = normalizeKsaPhone(phone);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const fail = (error: unknown) => appAlert(t("error"), t(getAuthErrorKey(error) as never));

  const finishSignIn = () => {
    setOnboardingComplete(true);
    refreshAuth();
    router.replace("/(tabs)");
  };

  const handleSendCode = async () => {
    if (loading) return;
    if (!normalizedPhone) {
      appAlert(t("error"), t("invalidPhone"));
      return;
    }

    setLoading(true);
    try {
      await sendPhoneOtp(normalizedPhone, language === "ar" ? "ar" : "en");
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
    if (loading || !normalizedPhone) return;
    if (submitted.length !== CODE_LENGTH) return;

    setLoading(true);
    try {
      await verifyPhoneOtp(normalizedPhone, submitted, {
        locale: language === "ar" ? "ar" : "en",
      });
      // The users row already exists: Better-Auth's onCreate trigger writes it
      // inside the same transaction as the account, before this call returns.
      finishSignIn();
    } catch (error) {
      setCode("");
      fail(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    if (loading) return;
    if (!email.trim()) {
      appAlert(t("error"), t("emailRequired"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      appAlert(t("error"), t("invalidEmail"));
      return;
    }
    if (password.length < 8) {
      appAlert(t("error"), t("passwordTooShort"));
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
      refreshAuth();

      // Deleting an account leaves the Better-Auth record behind, so a sign-in
      // can succeed against a login whose app profile is gone. The wait is for
      // the Convex JWT to land before the query runs.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const appUser = await convex.query(api.users.queries.getCurrentUser, {});
      if (!appUser) {
        await signOut();
        refreshAuth();
        const err = Object.assign(new Error("No account found"), { status: 404 });
        throw err;
      }

      // Attach the Better-Auth id to accounts that predate the triggers, so
      // future lookups do not depend on the email still matching.
      convex.mutation(api.users.mutations.ensureAuthLink, {}).catch(() => {});

      finishSignIn();
    } catch (error) {
      fail(error);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === "code") {
      setStep("phone");
      setCode("");
      return;
    }
    if (step === "email") {
      setStep("phone");
      return;
    }
    router.back();
  };

  const heading =
    step === "code"
      ? { title: t("enterCodeTitle"), subtitle: t("enterCodeSubtitle").replace("{phone}", formatPhoneForDisplay(normalizedPhone)) }
      : step === "email"
        ? { title: t("welcomeBack"), subtitle: t("signInToContinue") }
        : { title: t("phoneSignInTitle"), subtitle: t("phoneSignInSubtitle") };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View
        ref={keyboardRef}
        onLayout={keyboardOnLayout}
        style={{ flex: 1, paddingBottom: keyboardOverlap }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={goBack}
            style={[styles.backButton, isRTL && styles.backButtonRTL]}
            accessibilityRole="button"
            accessibilityLabel={isRTL ? "رجوع" : "Go back"}
          >
            <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={24} color="#1A1A1A" />
          </Pressable>

          <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.header}>
            <Text style={[styles.title, isRTL && styles.textRTL]}>{heading.title}</Text>
            <Text style={[styles.subtitle, isRTL && styles.textRTL]}>{heading.subtitle}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.form}>
            {step === "phone" && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, isRTL && styles.textRTL]}>{t("phoneNumber")}</Text>
                  {/* The country code is fixed furniture rather than part of
                      the text, so the guest types the number they know. */}
                  <View style={[styles.phoneRow, isRTL && styles.phoneRowRTL]}>
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
                      // Always LTR: a phone number reads left-to-right even in
                      // Arabic, and mirroring it makes it unreadable.
                      textAlign="left"
                      textContentType="telephoneNumber"
                      autoComplete="tel"
                      returnKeyType="go"
                      onSubmitEditing={handleSendCode}
                      autoFocus
                    />
                  </View>
                </View>

                {/* Consent sits here because this is the step that creates the
                    account. App Review expects UGC apps to take agreement at
                    that moment rather than bury it in settings. */}
                <Text style={[styles.consentText, isRTL && styles.textRTL]}>
                  {t("consentPrefix")}{" "}
                  <Text
                    style={styles.consentLink}
                    onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
                    accessibilityRole="link"
                  >
                    {t("termsOfService")}
                  </Text>{" "}
                  {t("consentAnd")}{" "}
                  <Text
                    style={styles.consentLink}
                    onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
                    accessibilityRole="link"
                  >
                    {t("privacyPolicy")}
                  </Text>
                  {t("consentSuffix")}
                </Text>

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

                <Pressable
                  onPress={() => setStep("email")}
                  style={styles.toggleMode}
                  accessibilityRole="button"
                  accessibilityLabel={t("signInWithEmail")}
                >
                  <Text style={[styles.toggleText, isRTL && styles.textRTL]}>
                    <Text style={styles.toggleLink}>{t("signInWithEmail")}</Text>
                  </Text>
                </Pressable>
              </>
            )}

            {step === "code" && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, isRTL && styles.textRTL]}>
                    {t("verificationCode")}
                  </Text>
                  <ThemedTextInput
                    style={[styles.input, styles.codeInput]}
                    isRTL={false}
                    value={code}
                    onChangeText={(next) => {
                      const digits = next.replace(/\D/g, "").slice(0, CODE_LENGTH);
                      setCode(digits);
                      // Submit as soon as the code is complete. Asking someone
                      // to tap a button after typing the last digit is a step
                      // with nothing behind it.
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
                </View>

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

                <Pressable
                  onPress={handleSendCode}
                  disabled={resendIn > 0 || loading}
                  style={styles.toggleMode}
                  accessibilityRole="button"
                  accessibilityLabel={t("resendCode")}
                  accessibilityState={{ disabled: resendIn > 0 || loading }}
                >
                  <Text style={[styles.toggleText, isRTL && styles.textRTL]}>
                    {resendIn > 0 ? (
                      t("resendIn").replace("{seconds}", String(resendIn))
                    ) : (
                      <Text style={styles.toggleLink}>{t("resendCode")}</Text>
                    )}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setStep("phone");
                    setCode("");
                  }}
                  style={styles.toggleMode}
                  accessibilityRole="button"
                  accessibilityLabel={t("changeNumber")}
                >
                  <Text style={[styles.toggleText, isRTL && styles.textRTL]}>
                    <Text style={styles.toggleLink}>{t("changeNumber")}</Text>
                  </Text>
                </Pressable>
              </>
            )}

            {step === "email" && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, isRTL && styles.textRTL]}>{t("email")}</Text>
                  <ThemedTextInput
                    style={[styles.input]}
                    isRTL={isRTL}
                    placeholder={t("emailPlaceholder")}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textAlign={isRTL ? "right" : "left"}
                    textContentType="emailAddress"
                    autoComplete="email"
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, isRTL && styles.textRTL]}>{t("password")}</Text>
                  <View style={styles.passwordContainer}>
                    <ThemedTextInput
                      ref={passwordRef}
                      style={[styles.input, styles.passwordInput]}
                      isRTL={isRTL}
                      placeholder={t("passwordPlaceholder")}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      textAlign={isRTL ? "right" : "left"}
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="password"
                      autoComplete="current-password"
                      returnKeyType="go"
                      onSubmitEditing={handleEmailSignIn}
                    />
                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      style={[styles.eyeButton, isRTL && styles.eyeButtonRTL]}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword
                          ? isRTL
                            ? "إخفاء كلمة المرور"
                            : "Hide password"
                          : isRTL
                            ? "إظهار كلمة المرور"
                            : "Show password"
                      }
                    >
                      <Feather name={showPassword ? "eye-off" : "eye"} size={20} color="#737373" />
                    </Pressable>
                  </View>
                </View>

                <Text style={[styles.consentText, isRTL && styles.textRTL]}>
                  {t("emailSignInOnlyNote")}
                </Text>

                <Pressable
                  onPress={handleEmailSignIn}
                  disabled={loading}
                  style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel={t("signIn")}
                  accessibilityState={{ disabled: loading, busy: loading }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>{t("signIn")}</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => setStep("phone")}
                  style={styles.toggleMode}
                  accessibilityRole="button"
                  accessibilityLabel={t("backToPhone")}
                >
                  <Text style={[styles.toggleText, isRTL && styles.textRTL]}>
                    <Text style={styles.toggleLink}>{t("backToPhone")}</Text>
                  </Text>
                </Pressable>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// Module scope on purpose: useThemedStyles caches on (factory, language), so a
// factory rebuilt per render would allocate a fresh stylesheet every frame.
const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backButtonRTL: {
    alignSelf: "flex-end",
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: "#1A1A1A",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: "#737373",
    lineHeight: 24,
  },
  textRTL: {
    textAlign: "right",
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
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
  inputRTL: {
    textAlign: "right",
  },
  phoneRow: {
    flexDirection: "row",
    gap: 8,
  },
  phoneRowRTL: {
    // The +966 chip stays on the left of the digits in both languages,
    // because that is where it belongs in the number itself.
    flexDirection: "row",
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
  phoneInput: {
    flex: 1,
  },
  codeInput: {
    fontSize: 24,
    fontFamily: fonts.bold,
    letterSpacing: 8,
    height: 60,
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 52,
  },
  eyeButton: {
    position: "absolute",
    right: 16,
    top: 16,
  },
  eyeButtonRTL: {
    right: undefined,
    left: 16,
  },
  consentText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: "#737373",
    marginTop: 4,
  },
  consentLink: {
    fontFamily: fonts.medium,
    color: "#0D7A5F",
    textDecorationLine: "underline",
  },
  submitButton: {
    height: 52,
    backgroundColor: "#0D7A5F",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#0D7A5F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
  },
  toggleMode: {
    alignSelf: "center",
    paddingVertical: 12,
  },
  toggleText: {
    fontSize: 15,
    color: "#737373",
  },
  toggleLink: {
    color: "#0D7A5F",
    fontFamily: fonts.semibold,
  },
});
