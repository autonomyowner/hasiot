import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { generatedImages } from "@/assets/images/generated";
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useAppStore } from "@/stores/appStore";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui/Button";
import { type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * How far the poster is raised, as a share of the window height.
 *
 * The poster's wordmark runs from about 27% to 47% of its height, and with
 * `cover` on a phone-shaped screen that maps straight onto the window — while
 * the copy and buttons, anchored to the bottom, climb to about 45% on a
 * standard iPhone and higher on a short one. The copy sat on "TRAVEL" and the
 * foot of the wordmark. Drawing the poster this much taller than the screen,
 * from above its top edge, lifts the wordmark to about 21–43% and crops only
 * the dark ornament over the arch.
 */
const POSTER_LIFT = 0.08;

/** Below this the copy tightens as well — an iPhone SE is 667pt tall. */
const SHORT_WINDOW = 720;

export default function OnboardingScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const isFocused = useIsFocused();
  const { height } = useWindowDimensions();
  const short = height < SHORT_WINDOW;
  const { t, language, changeLanguage, isRTL } = useLanguage();
  const setOnboardingComplete = useAppStore(
    (state) => state.setOnboardingComplete
  );

  const handleSkip = () => {
    setOnboardingComplete(true);
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.container}>
      {/* White status-bar text over the dark poster; the app's default is dark
          text, which here was black on near-black. Only while this screen is
          focused: the status bar keeps a stack of these, and one left mounted
          under the next screen would put white text on its cream. */}
      {isFocused && <StatusBar style="light" />}

      {/* Background Image */}
      <Image
        source={generatedImages.posterArch}
        style={[styles.backgroundImage, { top: -Math.round(height * POSTER_LIFT) }]}
        contentFit="cover"
      />

      {/* Darkens only the lower part, where the copy and buttons sit. The
          wordmark lives in the upper half and must stay untouched — a flat
          wash over the whole poster would bury it. The poster's own floor is
          already dark, so the fade reads as part of the artwork. */}
      <LinearGradient
        colors={["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0.45)", "rgba(0, 0, 0, 0.88)"]}
        locations={[0.38, 0.68, 1]}
        style={styles.scrim}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safeArea}>
        {/* The layout is bottom-anchored with fixed vertical margins, which
            overflows on short devices (iPhone SE) — scrolling is the fallback,
            and flexGrow keeps the anchored look everywhere else. */}
        <ScrollView
          style={styles.safeArea}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
        {/* Content */}
        <View style={[styles.content, short && styles.contentShort]}>
          {/* Hero Section */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(800)}
            style={[styles.heroSection, short && styles.heroSectionShort, isRTL && styles.heroSectionRTL]}
          >
            <Text
              style={[styles.heroGreeting, short && styles.heroGreetingShort, isRTL && styles.textRTL]}
              maxFontSizeMultiplier={1.3}
            >
              {t("heroGreeting")}
            </Text>
            <Text style={[styles.heroSubtext, isRTL && styles.textRTL]} maxFontSizeMultiplier={1.3}>
              {t("heroSubtext")}
            </Text>
          </Animated.View>

          {/* Language Selection */}
          <Animated.View
            entering={FadeInUp.delay(400).duration(800)}
            style={[styles.languageSection, short && styles.languageSectionShort]}
          >
            <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
              {t("selectLanguage")}
            </Text>
            <View style={styles.languageButtons}>
              <LanguageButton
                label="English"
                selected={language === "en"}
                onPress={() => changeLanguage("en")}
              />
              <LanguageButton
                label="العربية"
                selected={language === "ar"}
                onPress={() => changeLanguage("ar")}
              />
            </View>
          </Animated.View>

          {/* Auth Buttons */}
          <Animated.View
            entering={FadeInUp.delay(600).duration(800)}
            style={styles.authSection}
          >
            {/* Replace, not push: signing in goes back to whatever asked for
                it, and with onboarding still underneath that was onboarding
                again. With this screen gone, sign-in finds nothing to go back
                to and opens the app; its back arrow returns here. */}
            <Button
              title={t("continueWithPhone")}
              variant="secondary"
              fullWidth
              onPress={() => router.replace("/auth")}
              style={styles.authButton}
            />
            <Pressable
              onPress={handleSkip}
              style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t("skip")}
            >
              <Text style={styles.skipText}>{t("skip")}</Text>
            </Pressable>
          </Animated.View>
        </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

interface LanguageButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function LanguageButton({ label, selected, onPress }: LanguageButtonProps) {
  const styles = useThemedStyles(makeStyles);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <AnimatedPressable
      style={[
        styles.languageButton,
        selected && styles.languageButtonSelected,
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <Text
        style={[
          styles.languageButtonText,
          selected && styles.languageButtonTextSelected,
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#14100C",
  },
  // The top is set per render: raised by POSTER_LIFT of the window height.
  backgroundImage: {
    ...StyleSheet.absoluteFill,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  contentShort: {
    paddingBottom: 16,
  },
  heroSection: {
    marginBottom: 32,
  },
  heroSectionShort: {
    marginBottom: 20,
  },
  heroSectionRTL: {
    alignItems: "flex-end",
  },
  heroGreeting: {
    fontSize: 36,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  heroGreetingShort: {
    fontSize: 30,
    marginBottom: 8,
  },
  heroSubtext: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    lineHeight: 24,
    maxWidth: 300,
  },
  textRTL: {
    textAlign: "right",
  },
  languageSection: {
    marginBottom: 28,
  },
  languageSectionShort: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: "rgba(255, 255, 255, 0.7)",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  languageButtons: {
    flexDirection: "row",
    gap: 12,
  },
  languageButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  languageButtonSelected: {
    backgroundColor: "rgba(204, 231, 69, 0.35)",
    borderColor: "#4F5E10",
  },
  languageButtonText: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: "rgba(255, 255, 255, 0.8)",
  },
  languageButtonTextSelected: {
    color: "#FFFFFF",
  },
  authSection: {
    gap: 8,
  },
  authButton: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
  },
  skipButton: {
    alignSelf: "center",
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipText: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.7)",
    fontFamily: fonts.medium,
  },
  pressed: {
    opacity: 0.6,
  },
});
