import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { colors, type AppFonts } from "@/constants/colors";
import type { TranslationKey } from "@/constants/translations";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";

export type HostingType = "business" | "provider";

// The two ways to host. The icons are the ones each side already wears: the
// profile's hosting card has the house, and the provider's own services
// screen has the briefcase.
const OPTIONS: {
  type: HostingType;
  icon: React.ComponentProps<typeof Feather>["name"];
  title: TranslationKey;
  description: TranslationKey;
}[] = [
  { type: "business", icon: "home", title: "userTypeBusiness", description: "userTypeBusinessDesc" },
  { type: "provider", icon: "briefcase", title: "userTypeProvider", description: "userTypeProviderDesc" },
];

interface UpgradeSheetProps {
  visible: boolean;
  /** The choice whose role change is in flight. Both lock until it lands. */
  upgrading: HostingType | null;
  onChoose: (type: HostingType) => void;
  onClose: () => void;
  /** See BottomSheet: the success alert waits for this, not for `onClose`. */
  onDismissed: () => void;
}

/**
 * Turn a traveller's account into a hosting one: a business that posts
 * places, or a provider that offers services.
 *
 * Only what is drawn lives here. The role change and what follows it (the
 * confirmation, then the verification screen) stay with the profile screen,
 * which has to keep this sheet mounted while the account changes under it.
 */
export function UpgradeSheet({
  visible,
  upgrading,
  onChoose,
  onClose,
  onDismissed,
}: UpgradeSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const { t, isRTL } = useLanguage();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      header={<Text style={[styles.title, isRTL && styles.textRTL]}>{t("upgradeAccount")}</Text>}
    >
      <Text style={[styles.subtitle, isRTL && styles.textRTL]}>{t("upgradeChoose")}</Text>

      {/* Each choice is drawn as one: a lime disc and a chevron. The cards
          used to be the page's cream on the sheet's white (1.04:1) with no
          icon, and tested on an Android phone the popup seemed to offer
          nothing but Cancel. The same sheet drew both options in a browser,
          so the likeliest reading is that they were on screen and read as
          two more lines of text under "This action cannot be undone". */}
      {OPTIONS.map(({ type, icon, title, description }) => {
        const busy = upgrading === type;
        const locked = upgrading !== null;
        return (
          <Pressable
            key={type}
            style={({ pressed }) => [
              styles.option,
              isRTL && styles.rowRTL,
              locked && !busy && styles.optionIdle,
              pressed && !locked && styles.optionPressed,
            ]}
            onPress={() => onChoose(type)}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel={`${t(title)}, ${t(description)}`}
            accessibilityState={{ disabled: locked, busy }}
          >
            <View style={styles.optionIcon}>
              <Feather name={icon} size={20} color={colors.ink} />
            </View>
            <View style={[styles.optionText, isRTL && styles.alignEnd]}>
              <Text style={[styles.optionTitle, isRTL && styles.textRTL]}>{t(title)}</Text>
              <Text style={[styles.optionDesc, isRTL && styles.textRTL]}>{t(description)}</Text>
            </View>
            {busy ? (
              <ActivityIndicator color={colors.primary.deep} />
            ) : (
              <Feather name={isRTL ? "chevron-left" : "chevron-right"} size={20} color={colors.ink} />
            )}
          </Pressable>
        );
      })}

      {/* The warning stays, as a footnote. As the only line under the title
          it said what could not be undone, and nothing about what to pick. */}
      <View style={[styles.note, isRTL && styles.rowRTL]}>
        <Feather name="info" size={14} color={colors.onSurface.muted} />
        <Text style={[styles.noteText, isRTL && styles.textRTL]}>{t("upgradeWarning")}</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t("cancel")}
      >
        <Text style={styles.cancelText}>{t("cancel")}</Text>
      </Pressable>
    </BottomSheet>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    textRTL: { textAlign: "right", writingDirection: "rtl" },
    // Rows mirror with `row-reverse` and space with `gap`, which has no side.
    rowRTL: { flexDirection: "row-reverse" },
    alignEnd: { alignItems: "flex-end" },
    pressed: { opacity: 0.7 },
    // In the sheet's drag zone, so it can be grabbed as well as the handle.
    title: { fontFamily: fonts.serif, fontSize: 24, color: colors.ink },
    subtitle: {
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
      color: colors.onSurface.muted,
      marginTop: 4,
      marginBottom: 20,
    },
    // An outlined card on the white sheet. The disc and the chevron make it
    // read as a choice; the outline groups each one's two lines.
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: colors.surface.DEFAULT,
      borderRadius: 18,
      paddingVertical: 16,
      paddingHorizontal: 16,
      marginBottom: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    // Pressed, it takes the lime family: the soft chip surface, a lime edge.
    optionPressed: {
      backgroundColor: colors.mint,
      borderColor: colors.primary.DEFAULT,
    },
    // The choice not being applied while the other one is.
    optionIdle: { opacity: 0.5 },
    // Lime is a fill, so the icon on it is ink.
    optionIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary.DEFAULT,
      alignItems: "center",
      justifyContent: "center",
    },
    optionText: { flex: 1 },
    optionTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, marginBottom: 2 },
    optionDesc: {
      fontFamily: fonts.regular,
      fontSize: 13,
      lineHeight: 18,
      color: colors.onSurface.variant,
    },
    note: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
    noteText: {
      flexShrink: 1,
      fontFamily: fonts.regular,
      fontSize: 13,
      color: colors.onSurface.muted,
    },
    cancel: { marginTop: 4, minHeight: 48, alignItems: "center", justifyContent: "center" },
    cancelText: { fontFamily: fonts.medium, fontSize: 16, color: colors.onSurface.muted },
  });
