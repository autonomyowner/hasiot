import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useAppStore } from "@/stores/appStore";
import { useLanguage } from "@/hooks/useLanguage";
import { Button } from "@/components/ui";

const { width, height } = Dimensions.get("window");

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function OnboardingScreen() {
  const router = useRouter();
  const { t, language, changeLanguage, isRTL } = useLanguage();
  const setOnboardingComplete = useAppStore(
    (state) => state.setOnboardingComplete
  );

  const handleContinue = () => {
    setOnboardingComplete(true);
    router.replace("/(tabs)");
  };

  const handleSkip = () => {
    setOnboardingComplete(true);
    router.replace("/(tabs)");
  };

  return (
    <View style={styles.container}>
      {/* Background Image */}
      <Image
        source={{
          uri: "https://pub-d7fc967a0d9e4e42bba0d712e4f9b96e.r2.dev/lodging/desert-camp-a2dc07bf.jpg",
        }}
        style={styles.backgroundImage}
        contentFit="cover"
      />

      {/* Gradient Overlay */}
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safeArea}>
        {/* Content */}
        <View style={styles.content}>
          {/* Hero Section */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(800)}
            style={[styles.heroSection, isRTL && styles.heroSectionRTL]}
          >
            <Text style={[styles.heroGreeting, isRTL && styles.textRTL]}>
              {t("heroGreeting")}
            </Text>
            <Text style={[styles.heroSubtext, isRTL && styles.textRTL]}>
              {t("heroSubtext")}
            </Text>
          </Animated.View>

          {/* Language Selection */}
          <Animated.View
            entering={FadeInUp.delay(400).duration(800)}
            style={styles.languageSection}
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
            <Button
              title={t("continueWithEmail")}
              variant="secondary"
              fullWidth
              onPress={() => router.push("/auth")}
              style={styles.authButton}
            />
            <Pressable onPress={handleSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>{t("skip")}</Text>
            </Pressable>
          </Animated.View>
        </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1A1A",
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: width,
    height: height,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  heroSection: {
    marginBottom: 40,
  },
  heroSectionRTL: {
    alignItems: "flex-end",
  },
  heroGreeting: {
    fontSize: 36,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
    letterSpacing: -0.5,
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
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
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
    backgroundColor: "rgba(13, 122, 95, 0.3)",
    borderColor: "#0D7A5F",
  },
  languageButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.8)",
  },
  languageButtonTextSelected: {
    color: "#FFFFFF",
  },
  authSection: {
    gap: 12,
  },
  authButton: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
  },
  skipButton: {
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  skipText: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "500",
  },
});
