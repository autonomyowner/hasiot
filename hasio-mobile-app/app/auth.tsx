import { appAlert } from "@/stores/dialogStore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ThemedTextInput } from "@/components/ui/ThemedTextInput";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as AppleAuthentication from "expo-apple-authentication";
import { useLanguage } from "@/hooks/useLanguage";
import { useKeyboardOverlap } from "@/hooks/useKeyboardOverlap";
import { useNudge } from "@/hooks/useNudge";
import { useQuery } from "convex/react";
import { api } from "@/backend";
import {
  sendPhoneOtp,
  signIn,
  signInWithApple,
  signInWithGoogle,
  signOut,
  verifyPhoneOtp,
} from "@/lib/auth";
import {
  AUTH_ERROR_COPY,
  describeAuthError,
  isCodeStepError,
  type AuthErrorDescription,
} from "@/lib/authErrors";
import { toLatinDigits } from "@/lib/digits";
import { formatPhoneForDisplay, ltr, normalizeKsaPhone } from "@/lib/phone";
import { googleSignInAvailable, saudiSmsBlocked, smsBlockedFor } from "@/lib/phoneRules";
import { GoogleMark } from "@/components/auth/GoogleMark";
import { appleSignInAvailable } from "@/lib/appleSignIn";
import { convex, refreshAuth } from "@/lib/convex";
import { useAppStore } from "@/stores/appStore";
import { colors, type AppFonts } from "@/constants/colors";
import type { TranslationKey } from "@/constants/translations";
import { useThemedStyles } from "@/hooks/useAppFonts";

// The same pair Settings links to, on hasio.net, the live site (design D2).
// Binaries already in the stores open the hasio.xyz copies, which stay up
// until those binaries have aged out.
const PRIVACY_POLICY_URL = "https://hasio.net/privacy-policy.html";
const TERMS_OF_SERVICE_URL = "https://hasio.net/terms-of-service.html";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;
const DEMO_FILL_DELAY_MS = 900;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * How long, and how often, a fresh email sign-in asks for its app profile.
 * About four seconds in all — see `waitForAppUser`.
 */
const USER_POLL_DELAYS_MS = [250, 350, 500, 750, 1000, 1250];

/**
 * The code's tracking, kept out of the themed stylesheet on purpose. Arabic
 * zeroes letter-spacing there, because tracking pulls joined Arabic letters
 * apart — but these are six Latin digits in either language, and without the
 * spacing they read as one long number.
 */
const CODE_TRACKING = { letterSpacing: 8 } as const;

type Step = "phone" | "code" | "email";

/**
 * The app profile behind a fresh email sign-in, or null when there is none.
 *
 * It used to sleep a fixed 1.5 s — a guess at how long the Convex client takes
 * to pick up the new token — and then ask once. On a slow connection the guess
 * was short, the query ran signed out, and a real account was told it did not
 * exist and signed straight out again; on a fast one it was a second and a half
 * of spinner for nothing. Asking early and backing off answers as soon as the
 * token has landed, and only gives up after about four seconds.
 */
async function waitForAppUser() {
  for (const delay of USER_POLL_DELAYS_MS) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      const user = await convex.query(api.users.queries.getCurrentUser, {});
      if (user) return user;
    } catch {
      // Not authenticated yet, or a blip on the connection: ask again.
    }
  }
  return null;
}

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
  const locale = language === "ar" ? "ar" : "en";
  const {
    ref: keyboardRef,
    overlap: keyboardOverlap,
    onLayout: keyboardOnLayout,
  } = useKeyboardOverlap();
  const setOnboardingComplete = useAppStore((state) => state.setOnboardingComplete);
  const hasCompletedOnboarding = useAppStore((state) => state.hasCompletedOnboarding);

  const phoneRef = useRef<TextInput>(null);
  const codeRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  // A failure that belongs to the field on screen — a wrong or expired code, a
  // number that is not one — shown under that field instead of in a dialog.
  const [fieldError, setFieldError] = useState<string | null>(null);

  // `loading` is for drawing; it trails a tap by a render. This is what stops
  // a second request while one is in flight: a double tap, or the demo fill
  // landing on a code that is already being checked.
  const busy = useRef(false);
  // Demo-mode autofill timer. Held in a ref so an unmount mid-wait clears it
  // rather than firing setState on a screen that is gone.
  const demoFill = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Moves on whenever a code is sent or the code step is left, so a demo fill
  // armed for one code can never land on the next.
  const codeRound = useRef(0);
  useEffect(() => () => { if (demoFill.current) clearTimeout(demoFill.current); }, []);

  // The E.164 form, or null while the number is still incomplete.
  const normalizedPhone = normalizeKsaPhone(phone);

  // Send code and Verify stay solid lime whatever has been typed. They used to
  // fade out until the number or the code was complete, and at that opacity a
  // lime button reads as text on an Android screen (see hooks/useNudge.ts).
  // Pressed too early, they shake the field that is missing something.
  const { style: phoneNudgeStyle, nudge: nudgePhone } = useNudge();
  const { style: codeNudgeStyle, nudge: nudgeCode } = useNudge();
  const { style: smsNoticeNudgeStyle, nudge: nudgeSmsNotice } = useNudge();

  // Held as a subscription (the demo fill asks once per code instead) because
  // two things on this screen are drawn from it: whether Google is offered,
  // and whether a code can reach a Saudi number at all.
  const config = useQuery(api.config.queries.getPublicConfig);
  const showGoogle = googleSignInAvailable(config, Platform.OS);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Sign in with Apple: iOS only, when the backend verifies Apple's tokens and
  // this build carries the entitlement (lib/appleSignIn.ts). Apple's own
  // isAvailableAsync is asked once as well — it is false on an iPhone that
  // cannot present the sheet (no Apple ID signed in on an old iOS).
  const [appleDeviceReady, setAppleDeviceReady] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let alive = true;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => alive && setAppleDeviceReady(ok))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const showApple =
    appleDeviceReady &&
    appleSignInAvailable(config, Platform.OS, Constants.expoConfig?.extra?.appleSignIn);
  const [appleLoading, setAppleLoading] = useState(false);
  const socialLoading = googleLoading || appleLoading;

  // While SMS cannot reach +966 numbers the field stays (the owner wants SMS
  // kept for when it can), but Send code does not send: it would only start a
  // wait for a text that never comes. The notice under the field says so. It
  // appears once the config has answered — not while it loads, or every
  // sign-in after Saudi SMS comes back would flash a warning that is no longer
  // true — unless Send code is pressed first, which counts loading as "off"
  // (the contract's rule) and shows it then.
  const smsOff = saudiSmsBlocked(config);
  const [smsNoticeForced, setSmsNoticeForced] = useState(false);
  const showSmsNotice = smsOff && (config !== undefined || smsNoticeForced);
  const smsNoticeText = t(showGoogle ? "saudiSmsUnavailableGoogle" : "saudiSmsUnavailableEmail");

  // The phone field used to take the keyboard as the screen opened. With
  // Google on offer that puts the keyboard over the button that works, asking
  // for a number that — while Saudi SMS is down — cannot be used. autoFocus is
  // read only on mount, before the config has answered, so the choice is made
  // here instead, once: focus the number when there is no Google button above
  // it, leave the keyboard down when there is.
  const configAnswered = config !== undefined;
  useEffect(() => {
    if (configAnswered && !showGoogle && !showApple) phoneRef.current?.focus();
    // Once, when the config first answers — not every time Google flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configAnswered]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const showFieldError = (message: string) => {
    setFieldError(message);
    AccessibilityInfo.announceForAccessibility(message);
  };

  // A failure that is not about the field: a dialog whose title names it and
  // whose message says what to do — never the same line twice. OK hands the
  // keyboard back to the field the dialog took it from; the dialog calls it
  // only once it has gone.
  const alertFailure = (failure: AuthErrorDescription, refocus?: () => void) => {
    appAlert(t(failure.title), failure.serverText ?? t(failure.message), [
      { text: t("authOk"), onPress: refocus },
    ]);
  };

  const finishSignIn = () => {
    setOnboardingComplete(true);
    refreshAuth();
    // Back to whatever asked for sign-in. `replace("/(tabs)")` put a second
    // copy of the tab shell — five screens and their subscriptions — on top
    // of the first when sign-in came from the Profile tab. Onboarding replaces
    // itself with this screen, so there it is the only route and the tabs are
    // put in its place instead.
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  // Leaving without signing in: back where the guest came from, or — when
  // this screen replaced onboarding — to onboarding, whose choices are still
  // unmade. (A guest who already finished onboarding goes to the app.)
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace(hasCompletedOnboarding ? "/(tabs)" : "/onboarding");
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

  // Read by the demo fill's timer, which outlives the render that armed it.
  const verifyLatest = useRef<(submitted: string, target: string) => void>(() => {});

  /**
   * Demo mode: the backend verifies any code, so fill one in ourselves after a
   * beat. The pause is what sells it — an instant fill reads as a glitch, a
   * short one reads as the phone picking the code out of an incoming SMS.
   *
   * Asked once per code rather than held as a subscription — this screen has
   * no other reason to watch config — and deliberately not awaited: the
   * sending spinner used to stay up for this extra round trip, so the code
   * field mounted disabled, its autoFocus did nothing, and there was no
   * keyboard and no SMS autofill until the guest tapped the field.
   */
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
      // No config means no demo: the guest types the code from the SMS.
      () => {}
    );
  };

  const handleSendCode = async () => {
    if (busy.current) return;
    const target = normalizedPhone;
    if (!target) {
      // Nothing typed yet: point at the field. Something typed that is not a
      // Saudi mobile number: say what one looks like, under the field.
      if (phone.trim() === "") {
        nudgePhone(t("enterPhoneNudge"));
      } else {
        showFieldError(t("invalidPhone"));
        nudgePhone();
      }
      phoneRef.current?.focus();
      return;
    }
    // Only from the phone step: the code step is reached only when a code
    // could be sent, and its Resend has no notice to point at.
    if (step === "phone" && smsBlockedFor(target, config)) {
      setFieldError(null);
      setSmsNoticeForced(true);
      nudgeSmsNotice(smsNoticeText);
      return;
    }

    busy.current = true;
    setLoading(true);
    setFieldError(null);
    stopDemoFill();
    let sent = false;
    try {
      await sendPhoneOtp(target, locale);
      sent = true;
    } catch (error) {
      const failure = describeAuthError(error, locale);
      if (failure.kind === "invalidPhone" && step === "phone") {
        showFieldError(t(failure.message));
      } else {
        const field = step === "code" ? codeRef : phoneRef;
        alertFailure(failure, () => field.current?.focus());
      }
    } finally {
      busy.current = false;
      setLoading(false);
    }
    if (!sent) return;

    // In the same render as the spinner going away, so the code field mounts
    // ready: focused, with the keyboard up and SMS autofill listening.
    setCode("");
    setStep("code");
    setResendIn(RESEND_SECONDS);
    armDemoFill(target);
  };

  const verify = async (submitted: string, target: string | null = normalizedPhone) => {
    if (busy.current || !target || submitted.length !== CODE_LENGTH) return;

    busy.current = true;
    setLoading(true);
    setFieldError(null);
    try {
      await verifyPhoneOtp(target, submitted, { locale });
    } catch (error) {
      busy.current = false;
      setLoading(false);
      setCode("");
      const failure = describeAuthError(error, locale);
      if (isCodeStepError(failure.kind)) {
        // Under the field, with the keyboard still up: the guest just types
        // the code again. (The field used to be made read-only while a code
        // was checked, which took the keyboard away after every wrong code.)
        showFieldError(t(failure.message));
        // An expired or used-up code cannot be retried, so a new one is
        // offered now rather than when the countdown ends.
        if (failure.kind !== "codeWrong") setResendIn(0);
      } else {
        alertFailure(failure, () => codeRef.current?.focus());
      }
      return;
    }
    // The users row already exists: Better-Auth's onCreate trigger writes it
    // inside the same transaction as the account, before this call returns.
    // Still busy on purpose: the screen is leaving, and a button re-enabled
    // under the transition would take a second tap.
    finishSignIn();
  };

  useEffect(() => {
    verifyLatest.current = (submitted, target) => {
      void verify(submitted, target);
    };
  });

  // Verify before all six digits are in: the code submits itself on the
  // sixth, so a press now means something is missing.
  const handleVerifyPress = () => {
    if (loading) return;
    if (code.length !== CODE_LENGTH) {
      nudgeCode(t("enterCodeNudge"));
      codeRef.current?.focus();
      return;
    }
    void verify(code);
  };

  /**
   * Google, in the system browser (lib/auth.ts signInWithGoogle). Finishes as
   * a phone sign-in does: the users row already exists — Better Auth's
   * onCreate trigger writes it in the same transaction as the account, before
   * the browser is sent back — so there is no profile to wait for.
   */
  const handleGoogle = async () => {
    if (busy.current) return;
    busy.current = true;
    setGoogleLoading(true);
    setFieldError(null);
    let signedIn = false;
    try {
      signedIn = (await signInWithGoogle()) !== null;
    } catch (error) {
      const failure = describeAuthError(error, locale);
      // A dropped connection or the server's limiter keep their own words;
      // anything else — a refused state, no session on the way back, Google
      // itself refusing — reads as the one thing the person can act on.
      alertFailure(
        failure.kind === "network" || failure.kind === "rateLimited"
          ? failure
          : { kind: "googleFailed", ...AUTH_ERROR_COPY.googleFailed, serverText: null }
      );
    }
    if (!signedIn) {
      // A cancel lands here too, and says nothing: backing out is a choice.
      busy.current = false;
      setGoogleLoading(false);
      return;
    }
    // Still busy on purpose, as after a phone sign-in: the screen is leaving.
    finishSignIn();
  };

  /**
   * Apple's native sheet (lib/auth.ts signInWithApple): no browser, and it
   * finishes like the others — the users row exists before the answer.
   */
  const handleApple = async () => {
    if (busy.current) return;
    busy.current = true;
    setAppleLoading(true);
    setFieldError(null);
    let signedIn = false;
    try {
      signedIn = (await signInWithApple()) !== null;
    } catch (error) {
      const failure = describeAuthError(error, locale);
      alertFailure(
        failure.kind === "network" || failure.kind === "rateLimited"
          ? failure
          : { kind: "appleFailed", ...AUTH_ERROR_COPY.appleFailed, serverText: null }
      );
    }
    if (!signedIn) {
      // Closing Apple's sheet lands here too, and says nothing.
      busy.current = false;
      setAppleLoading(false);
      return;
    }
    finishSignIn();
  };

  const handleEmailSignIn = async () => {
    if (busy.current) return;
    const trimmed = email.trim();
    const problem: TranslationKey | null = !trimmed
      ? "emailRequired"
      : !EMAIL_PATTERN.test(trimmed)
        ? "invalidEmail"
        : password.length < 8
          ? "passwordTooShort"
          : null;
    if (problem) {
      const field = problem === "passwordTooShort" ? passwordRef : emailRef;
      appAlert(t("authCheckDetailsTitle"), t(problem), [
        { text: t("authOk"), onPress: () => field.current?.focus() },
      ]);
      return;
    }

    busy.current = true;
    setLoading(true);
    try {
      await signIn(trimmed, password);
      refreshAuth();

      // Deleting an account leaves the Better-Auth record behind, so a sign-in
      // can succeed against a login whose app profile is gone.
      const appUser = await waitForAppUser();
      if (!appUser) {
        await signOut();
        refreshAuth();
        throw Object.assign(new Error("No account found"), { status: 404 });
      }

      // Attach the Better-Auth id to accounts that predate the triggers, so
      // future lookups do not depend on the email still matching.
      convex.mutation(api.users.mutations.ensureAuthLink, {}).catch(() => {});
    } catch (error) {
      busy.current = false;
      setLoading(false);
      alertFailure(describeAuthError(error, locale));
      return;
    }
    finishSignIn();
  };

  const goBack = () => {
    if (step !== "phone") {
      toPhoneStep();
      return;
    }
    leave();
  };

  // Android's back button does what the arrow on screen does. It used to
  // leave the whole screen from the code and email steps, throwing away the
  // number that had just been typed; and on the phone step, with onboarding
  // replaced by this screen, it closed the app.
  const onHardwareBack = useRef<() => boolean>(() => false);
  useEffect(() => {
    onHardwareBack.current = () => {
      if (step !== "phone") {
        toPhoneStep();
        return true;
      }
      if (!router.canGoBack()) {
        leave();
        return true;
      }
      return false;
    };
  });
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () =>
        onHardwareBack.current()
      );
      return () => subscription.remove();
    }, [])
  );

  const openLegal = (url: string) => {
    Linking.openURL(url).catch(() => appAlert(t("error"), t("couldNotOpenLink")));
  };

  const heading =
    step === "code"
      ? {
          title: t("enterCodeTitle"),
          // Wrapped so the number reads "+966 50 123 4567" inside Arabic too.
          subtitle: t("enterCodeSubtitle").replace(
            "{phone}",
            ltr(formatPhoneForDisplay(normalizedPhone))
          ),
        }
      : step === "email"
        ? { title: t("welcomeBack"), subtitle: t("signInToContinue") }
        : {
            title: t("phoneSignInTitle"),
            // "We'll text you a code" is not true while the notice below says
            // texts cannot reach Saudi numbers.
            subtitle: t(showSmsNotice ? "phoneSignInSubtitleNoSms" : "phoneSignInSubtitle"),
          };

  const fieldErrorText = fieldError ? (
    <Text
      style={[styles.fieldError, isRTL && styles.textRTL]}
      accessibilityLiveRegion="polite"
    >
      {fieldError}
    </Text>
  ) : null;

  const resendDisabled = resendIn > 0 || loading;

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
            style={({ pressed }) => [
              styles.backButton,
              isRTL && styles.backButtonRTL,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("back")}
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
                {/* First, while SMS cannot reach Saudi numbers: for most
                    people this is the way in that works. Outlined, so the
                    lime Send code stays the one filled button on the page. */}
                {/* Apple first when it is offered: its guidelines ask for the
                    Apple button to be at least as prominent as any other. */}
                {showApple ? (
                  <Pressable
                    onPress={handleApple}
                    disabled={loading || socialLoading}
                    style={({ pressed }) => [
                      styles.appleButton,
                      isRTL && styles.rowRTL,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t("continueWithApple")}
                    accessibilityState={{ disabled: loading || socialLoading, busy: appleLoading }}
                  >
                    {appleLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                        <Text style={styles.appleButtonText}>{t("continueWithApple")}</Text>
                      </>
                    )}
                  </Pressable>
                ) : null}

                {showGoogle ? (
                  <Pressable
                    onPress={handleGoogle}
                    disabled={loading || socialLoading}
                    style={({ pressed }) => [
                      styles.googleButton,
                      isRTL && styles.rowRTL,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t("continueWithGoogle")}
                    accessibilityState={{ disabled: loading || socialLoading, busy: googleLoading }}
                  >
                    {googleLoading ? (
                      <ActivityIndicator color={colors.ink} />
                    ) : (
                      <>
                        <GoogleMark size={18} color={colors.ink} />
                        <Text style={styles.googleButtonText}>{t("continueWithGoogle")}</Text>
                      </>
                    )}
                  </Pressable>
                ) : null}

                {showApple || showGoogle ? (
                  <View style={styles.orRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <View style={styles.orLine} />
                    <Text style={styles.orText}>{t("authOr")}</Text>
                    <View style={styles.orLine} />
                  </View>
                ) : null}

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, isRTL && styles.textRTL]}>{t("phoneNumber")}</Text>
                  {/* The country code is fixed furniture rather than part of
                      the text, so the guest types the number they know. It
                      stays on the left of the digits in both languages,
                      because that is where it belongs in the number itself. */}
                  <Animated.View style={[styles.phoneRow, phoneNudgeStyle]}>
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
                        // An Arabic keypad types ٠٥٠…; shown as typed, the
                        // number mixed two digit sets in one LTR field.
                        setPhone(toLatinDigits(next));
                        if (fieldError) setFieldError(null);
                      }}
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
                      // On first opening the config has not answered yet, and
                      // the effect at configAnswered focuses it; coming back
                      // from the code or email step it has, and this does.
                      autoFocus={configAnswered && !showGoogle}
                    />
                  </Animated.View>
                  {fieldErrorText}
                  {showSmsNotice ? (
                    <Animated.View
                      style={[styles.smsNotice, isRTL && styles.rowRTL, smsNoticeNudgeStyle]}
                      accessibilityLiveRegion="polite"
                    >
                      <Feather name="info" size={16} color={colors.onSurface.muted} />
                      <Text style={[styles.smsNoticeText, isRTL && styles.textRTL]}>
                        {smsNoticeText}
                      </Text>
                    </Animated.View>
                  ) : null}
                </View>

                {/* Consent sits here because this is the step that creates the
                    account. App Review expects UGC apps to take agreement at
                    that moment rather than bury it in settings. */}
                <Text style={[styles.consentText, isRTL && styles.textRTL]}>
                  {t("consentPrefix")}{" "}
                  <Text
                    style={styles.consentLink}
                    onPress={() => openLegal(TERMS_OF_SERVICE_URL)}
                    accessibilityRole="link"
                  >
                    {t("termsOfService")}
                  </Text>{" "}
                  {t("consentAnd")}{" "}
                  <Text
                    style={styles.consentLink}
                    onPress={() => openLegal(PRIVACY_POLICY_URL)}
                    accessibilityRole="link"
                  >
                    {t("privacyPolicy")}
                  </Text>
                  {t("consentSuffix")}
                </Text>

                <Pressable
                  onPress={handleSendCode}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.submitButton,
                    loading && styles.submitButtonDisabled,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("sendCode")}
                  accessibilityHint={normalizedPhone ? undefined : t("enterPhoneNudge")}
                  accessibilityState={{ disabled: loading, busy: loading }}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.ink} />
                  ) : (
                    <Text style={styles.submitButtonText}>{t("sendCode")}</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => {
                    setFieldError(null);
                    setStep("email");
                  }}
                  style={({ pressed }) => [styles.toggleMode, pressed && styles.pressed]}
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
                  {/* Never read-only while a code is checked, and no maxLength:
                      making it read-only took the keyboard away after every
                      wrong code, and maxLength cut a pasted "Your Hasio code
                      is 123456" to "Your H" before the digits could be found. */}
                  <Animated.View style={codeNudgeStyle}>
                    <ThemedTextInput
                      ref={codeRef}
                      style={[styles.input, styles.codeInput, CODE_TRACKING]}
                      isRTL={false}
                      value={code}
                      onChangeText={(next) => {
                        // Latin digits, then only digits, then the first six: an
                        // Arabic keypad, a pasted message and iOS pasting the
                        // autofilled code twice all come out as the code.
                        const digits = toLatinDigits(next).replace(/\D/g, "").slice(0, CODE_LENGTH);
                        setCode(digits);
                        if (fieldError) setFieldError(null);
                        // Submit as soon as the code is complete. Asking someone
                        // to tap a button after typing the last digit is a step
                        // with nothing behind it.
                        if (digits.length === CODE_LENGTH) void verify(digits);
                      }}
                      keyboardType="number-pad"
                      textAlign="center"
                      textContentType="oneTimeCode"
                      autoComplete="sms-otp"
                      autoFocus
                    />
                  </Animated.View>
                  {fieldErrorText}
                </View>

                <Pressable
                  onPress={handleVerifyPress}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.submitButton,
                    loading && styles.submitButtonDisabled,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("verifyCode")}
                  accessibilityHint={code.length === CODE_LENGTH ? undefined : t("enterCodeNudge")}
                  accessibilityState={{ disabled: loading, busy: loading }}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.ink} />
                  ) : (
                    <Text style={styles.submitButtonText}>{t("verifyCode")}</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={handleSendCode}
                  disabled={resendDisabled}
                  style={({ pressed }) => [styles.toggleMode, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={t("resendCode")}
                  accessibilityState={{ disabled: resendDisabled }}
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
                  onPress={toPhoneStep}
                  style={({ pressed }) => [styles.toggleMode, pressed && styles.pressed]}
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
                    ref={emailRef}
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
                      // The room kept clear for the eye follows the eye: it
                      // moves to the left in Arabic, and the padding stayed
                      // on the right, so the dots ran under the button.
                      style={[
                        styles.input,
                        isRTL ? styles.passwordInputRTL : styles.passwordInput,
                      ]}
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
                      style={({ pressed }) => [
                        styles.eyeButton,
                        isRTL && styles.eyeButtonRTL,
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword ? t("authHidePassword") : t("authShowPassword")
                      }
                    >
                      <Feather name={showPassword ? "eye-off" : "eye"} size={20} color={colors.onSurface.muted} />
                    </Pressable>
                  </View>
                </View>

                <Text style={[styles.consentText, isRTL && styles.textRTL]}>
                  {t("emailSignInOnlyNote")}
                </Text>

                <Pressable
                  onPress={handleEmailSignIn}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.submitButton,
                    loading && styles.submitButtonDisabled,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("signIn")}
                  accessibilityState={{ disabled: loading, busy: loading }}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.ink} />
                  ) : (
                    <Text style={styles.submitButtonText}>{t("signIn")}</Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={toPhoneStep}
                  style={({ pressed }) => [styles.toggleMode, pressed && styles.pressed]}
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
  pressed: {
    opacity: 0.7,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface.DEFAULT,
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
  rowRTL: {
    flexDirection: "row-reverse",
  },
  // The secondary way in: white with a hairline, the same 52pt and radius as
  // the fields, so it reads as a button without competing with the lime one.
  googleButton: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D4D4D4",
    backgroundColor: colors.surface.DEFAULT,
  },
  googleButtonText: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  // Apple's black style, as its guidelines draw it: a solid fill with the
  // logo and the title in white. Same size and radius as the Google button,
  // with a gap between the two.
  appleButton: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#000000",
    marginBottom: 12,
  },
  appleButtonText: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: "#FFFFFF",
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#D4D4D4",
  },
  orText: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.onSurface.muted,
  },
  // Information, not an error: muted ink on a white card with an info mark,
  // where the field error below the field is the destructive red.
  smsNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    backgroundColor: colors.surface.DEFAULT,
  },
  smsNoticeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
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
    color: colors.onSurface.muted,
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
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#E5E5E5",
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
  phoneInput: {
    flex: 1,
  },
  codeInput: {
    fontSize: 24,
    fontFamily: fonts.bold,
    height: 60,
  },
  // The destructive text colour: 5.0:1 on this cream, where the coral error
  // token would be 3.1:1.
  fieldError: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.signOut,
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 52,
  },
  passwordInputRTL: {
    paddingLeft: 52,
    paddingRight: 16,
  },
  // The whole height of the field and 44pt wide: the eye used to be a 20pt
  // target floating in its corner.
  eyeButton: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 4,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  eyeButtonRTL: {
    right: undefined,
    left: 4,
  },
  consentText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.onSurface.muted,
    marginTop: 4,
  },
  consentLink: {
    fontFamily: fonts.medium,
    color: colors.primary.deep,
    textDecorationLine: "underline",
  },
  submitButton: {
    height: 52,
    backgroundColor: colors.primary.DEFAULT,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: colors.ink,
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
    color: colors.ink,
  },
  // 12 + a 20pt line + 12: a 44pt target for what reads as a text link.
  toggleMode: {
    alignSelf: "center",
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  toggleText: {
    fontSize: 15,
    color: colors.onSurface.muted,
  },
  toggleLink: {
    color: colors.primary.deep,
    fontFamily: fonts.semibold,
  },
});
