import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";

interface BackButtonProps {
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

// Shared header back button. The negative top margin cancels the vertical
// padding so the visual position matches the old text-only button, while the
// padding + hitSlop bring the tap target above the 44pt iOS minimum.
// No alignSelf here on purpose — the headers that host this apply
// `isRTL && styles.headerRTL` (alignItems: "flex-end"), so it must keep
// inheriting the parent's alignment.
export function BackButton({ style, onPress }: BackButtonProps) {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      style={[styles.button, style]}
      hitSlop={{ top: 8, bottom: 8 }}
      accessibilityRole="button"
      accessibilityLabel={t("back")}
    >
      <Text style={styles.text}>{t("back")}</Text>
    </Pressable>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  button: {
    marginTop: -12,
    marginBottom: 8,
    paddingVertical: 12,
  },
  text: {
    fontSize: 15,
    color: "#0D7A5F",
    fontFamily: fonts.medium,
  },
});
