import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { api } from "@/backend";
import { appAlert } from "@/stores/dialogStore";
import { AppDialogHost } from "@/components/ui/AppDialog";
import { ThemedTextInput } from "@/components/ui/ThemedTextInput";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";

interface EditNameSheetProps {
  visible: boolean;
  /** What the account has today, so the field opens pre-filled. */
  initialName: string;
  onClose: () => void;
}

/**
 * Set or change the display name on the account.
 *
 * Phone sign-ups have no name at all — the server deliberately refuses to use
 * the phone number as one — so until this is filled in, a guest is just a
 * number to the host who has to call them. One field, split on the first
 * space the same way the server does, because "first name" and "last name"
 * boxes are a Western form convention that fits Arabic names badly.
 */
export function EditNameSheet({ visible, initialName, onClose }: EditNameSheetProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const updateProfile = useMutation(api.users.mutations.updateProfile);

  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  // Reopening must show the current name, not whatever was typed last time.
  useEffect(() => {
    if (visible) setName(initialName);
  }, [visible, initialName]);

  const save = async () => {
    if (saving) return;
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      onClose();
      return;
    }
    const [firstName, ...rest] = trimmed.split(" ");
    setSaving(true);
    try {
      await updateProfile({ firstName, lastName: rest.join(" ") || undefined });
      appAlert(t("nameSaved"));
      onClose();
    } catch (error) {
      appAlert(t("error"), error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.head, isRTL && styles.rowRTL]}>
          <Text style={styles.title}>{t("editName")}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Feather name="x" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <Text style={[styles.hint, isRTL && styles.textRTL]}>{t("editNameHint")}</Text>

        <ThemedTextInput
          value={name}
          onChangeText={setName}
          placeholder={t("fullNamePlaceholder")}
          autoFocus
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={save}
          textAlign={isRTL ? "right" : "left"}
        />

        <Pressable
          style={[styles.submit, saving && styles.submitDisabled]}
          onPress={save}
          disabled={saving}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.submitText}>{t("save")}</Text>
          )}
        </Pressable>

        {/* Alerts fired while this native Modal is open must render inside it,
            or they appear behind the sheet on iOS. */}
        <AppDialogHost />
      </View>
    </Modal>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(31, 29, 23, 0.35)" },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.surface.DEFAULT,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 24,
      paddingTop: 20,
      gap: 14,
    },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    rowRTL: { flexDirection: "row-reverse" },
    textRTL: { textAlign: "right" },
    title: { fontFamily: fonts.serif, fontSize: 24, color: colors.ink },
    hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.onSurface.muted, marginTop: -6 },
    // Lime is a fill, so its label is ink: white on it is 1.4:1.
    submit: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 50,
      borderRadius: 14,
      backgroundColor: colors.primary.DEFAULT,
    },
    submitDisabled: { opacity: 0.6 },
    submitText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  });
