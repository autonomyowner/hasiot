import { appAlert } from "@/stores/dialogStore";
import React, { useRef, useState } from "react";
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
  Alert,
  Linking,
} from "react-native";
import { ThemedTextInput } from "@/components/ui/ThemedTextInput";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLanguage } from "@/hooks/useLanguage";
import { useKeyboardOverlap } from "@/hooks/useKeyboardOverlap";
import { useMutation } from "convex/react";
import { api } from "@/backend";
import { signIn, signUp, signOut, getAuthErrorKey } from "@/lib/auth";
import { convex, refreshAuth } from "@/lib/convex";
import { useAppStore } from "@/stores/appStore";
import { type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

// Served from the website's public/ — the same pair Settings links to.
const PRIVACY_POLICY_URL = "https://www.hasio.xyz/privacy-policy.html";
const TERMS_OF_SERVICE_URL = "https://www.hasio.xyz/terms-of-service.html";

export default function AuthScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const {
    ref: keyboardRef,
    overlap: keyboardOverlap,
    onLayout: keyboardOnLayout,
  } = useKeyboardOverlap();
  const setOnboardingComplete = useAppStore((state) => state.setOnboardingComplete);

  // Focus chaining, so return moves down the form instead of dismissing it.
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const createUser = useMutation(api.users.mutations.createUser);

  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    if (loading) return;

    if (!email.trim()) {
      appAlert(t("error"), t("emailRequired"));
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      appAlert(t("error"), t("invalidEmail"));
      return;
    }
    if (!password.trim() || password.length < 8) {
      appAlert(t("error"), t("passwordTooShort"));
      return;
    }

    setLoading(true);
    try {
      if (mode === "signIn") {
        await signIn(email.trim(), password);
        // Verify the user exists in app users table (deleted accounts leave ghost Better-Auth records)
        refreshAuth();
        await new Promise((r) => setTimeout(r, 1500));
        const appUser = await convex.query(api.users.queries.getCurrentUser, {});
        if (!appUser) {
          await signOut();
          refreshAuth();
          const err: any = new Error("No account found");
          err.status = 404;
          throw err;
        }
      } else {
        let signedUp = false;
        try {
          await signUp(email.trim(), password, name.trim());
          signedUp = true;
        } catch (signUpErr: any) {
          // If email exists in Better-Auth (ghost from deleted account), try signing in
          if (signUpErr?.status === 422 || /already exists/i.test(signUpErr?.message)) {
            await signIn(email.trim(), password);
          } else {
            throw signUpErr;
          }
        }
        // Create/ensure app user record exists
        const nameParts = name.trim().split(/\s+/);
        await createUser({
          email: email.trim(),
          firstName: nameParts[0] || undefined,
          lastName: nameParts.slice(1).join(" ") || undefined,
          role: "tourist",
        });
      }
      setOnboardingComplete(true);
      refreshAuth();
      router.replace("/(tabs)");
    } catch (err: any) {

      appAlert(t("error"), t(getAuthErrorKey(err) as any));
    } finally {
      setLoading(false);
    }
  };

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
        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          style={[styles.backButton, isRTL && styles.backButtonRTL]}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? "رجوع" : "Go back"}
        >
          <Feather
            name={isRTL ? "arrow-right" : "arrow-left"}
            size={24}
            color="#1A1A1A"
          />
        </Pressable>

        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(600)}
          style={styles.header}
        >
          <Text style={[styles.title, isRTL && styles.textRTL]}>
            {mode === "signIn" ? t("welcomeBack") : t("createAccount")}
          </Text>
          <Text style={[styles.subtitle, isRTL && styles.textRTL]}>
            {mode === "signIn" ? t("signInToContinue") : t("signUpToContinue")}
          </Text>
        </Animated.View>

        {/* Form */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(600)}
          style={styles.form}
        >
          {mode === "signUp" && (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, isRTL && styles.textRTL]}>
                {t("fullName")}
              </Text>
              <ThemedTextInput
                style={[styles.input]}
                isRTL={isRTL}
                placeholder={t("fullNamePlaceholder")}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                textAlign={isRTL ? "right" : "left"}
                textContentType="name"
                autoComplete="name"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={[styles.label, isRTL && styles.textRTL]}>
              {t("email")}
            </Text>
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
            <Text style={[styles.label, isRTL && styles.textRTL]}>
              {t("password")}
            </Text>
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
                // "newPassword" is what triggers iOS's strong-password
                // suggestion; on sign-in the saved-credential fill is what we
                // want instead.
                textContentType={mode === "signUp" ? "newPassword" : "password"}
                autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={[styles.eyeButton, isRTL && styles.eyeButtonRTL]}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword
                    ? (isRTL ? "إخفاء كلمة المرور" : "Hide password")
                    : (isRTL ? "إظهار كلمة المرور" : "Show password")
                }
              >
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color="#737373"
                />
              </Pressable>
            </View>
          </View>

          {/* Terms consent. Sign-up only — this is the moment the account is
              created, and App Review expects UGC apps to take agreement here
              rather than bury it in settings. */}
          {mode === "signUp" && (
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
          )}

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel={mode === "signIn" ? t("signIn") : t("signUp")}
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {mode === "signIn" ? t("signIn") : t("signUp")}
              </Text>
            )}
          </Pressable>

          {/* Toggle mode */}
          <Pressable
            onPress={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
            style={styles.toggleMode}
            accessibilityRole="button"
            accessibilityLabel={
              mode === "signIn"
                ? (isRTL ? "الانتقال إلى إنشاء حساب" : "Switch to sign up")
                : (isRTL ? "الانتقال إلى تسجيل الدخول" : "Switch to sign in")
            }
          >
            <Text style={[styles.toggleText, isRTL && styles.textRTL]}>
              {mode === "signIn" ? t("noAccount") : t("haveAccount")}{" "}
              <Text style={styles.toggleLink}>
                {mode === "signIn" ? t("signUp") : t("signIn")}
              </Text>
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

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
    color: "#CCE745",
    textDecorationLine: "underline",
  },
  submitButton: {
    height: 52,
    backgroundColor: "#CCE745",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#CCE745",
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
    color: "#CCE745",
    fontFamily: fonts.semibold,
  },
});
