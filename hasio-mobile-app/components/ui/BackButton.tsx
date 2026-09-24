import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";

interface BackButtonProps {
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

// Sideways as well as up and down: the label is a single short word, about
// 35pt wide, and the slop used to be vertical only.
const HIT_SLOP = { top: 8, bottom: 8, left: 12, right: 12 };

// Shared header back button, used in two kinds of header: a column (the label
// above the title) and a row (the label beside the title, both centred).
//
// The 12pt of padding above and below makes the label a 44pt-tall target; the
// negative margins stop that padding taking up layout. They used to be -12
// above and +8 below. In a column that put the label where a text-only button
// would sit with a gap under it — but a row centres a child's whole margin box,
// and that lopsided box lifted the label 10pt above the title's centre line on
// every row header (bookings, booking detail, notifications, reviews, the host
// inbox). Equal margins centre it in a row; at -2 each, a column header's title
// stays exactly where it was and only the label moves, 10pt nearer to it.
//
// No alignSelf here on purpose — the column headers apply
// `isRTL && styles.headerRTL` (alignItems: "flex-end"), so it must keep
// inheriting the parent's alignment.
export function BackButton({ style, onPress }: BackButtonProps) {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={t("back")}
    >
      <Text style={styles.text}>{t("back")}</Text>
    </Pressable>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  button: {
    marginVertical: -2,
    paddingVertical: 12,
  },
  pressed: {
    opacity: 0.6,
  },
  // "Lime as text" is the dark lime: the fill itself is 1.3:1 on the cream.
  text: {
    fontSize: 15,
    color: colors.primary.deep,
    fontFamily: fonts.medium,
  },
});
