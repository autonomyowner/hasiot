import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "convex/react";
import { api } from "@/backend";
import { appAlert } from "@/stores/dialogStore";
import { getSubmitErrorKey } from "@/lib/submitError";
import { BottomSheet } from "@/components/ui/BottomSheet";
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
  const { t, isRTL } = useLanguage();
  const updateProfile = useMutation(api.users.mutations.updateProfile);

  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  // Shown once the sheet has gone, not while it is leaving: an alert raised
  // inside the sheet is carried off with it and then reappears underneath.
  const savedNotice = useRef(false);
  // From opening until `onDismissed`. A save can land after the sheet was
  // closed mid-request; its notice then has no dismissal left to wait for,
  // and used to sit in `savedNotice` until the next time the sheet closed.
  const shown = useRef(visible);
  useEffect(() => {
    if (!visible) return;
    shown.current = true;
    savedNotice.current = false;
  }, [visible]);

  // Reopening must show the current name, not whatever was typed last time.
  // Only on opening: resyncing whenever `initialName` changed would overwrite
  // what is being typed the moment the server echoed anything back.
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setName(initialName);
  }

  const tidy = (value: string) => value.trim().replace(/\s+/g, " ");
  const trimmed = tidy(name);
  // Save with nothing in the field used to close the sheet as if it had
  // worked, leaving the name as it was without a word. Now the button waits
  // for a name.
  const canSave = trimmed.length > 0 && !saving;
  // `saving` is a render late; this stops a double tap sending twice.
  const busy = useRef(false);

  const save = async () => {
    if (!canSave || busy.current) return;
    // Nothing changed: closing is all Save has to do, and "Name saved" would
    // claim a change that did not happen.
    if (trimmed === tidy(initialName)) {
      onClose();
      return;
    }
    const [firstName, ...rest] = trimmed.split(" ");
    busy.current = true;
    setSaving(true);
    try {
      await updateProfile({ firstName, lastName: rest.join(" ") || undefined });
      if (shown.current) {
        savedNotice.current = true;
        onClose();
      } else {
        appAlert(t("nameSaved"));
      }
    } catch (error) {
      // Not the raw message: production redacts a plain server Error to
      // "Server Error", and in development it is a stack-prefixed English
      // string. Either way the guest could do nothing with it.
      appAlert(t("error"), t(getSubmitErrorKey(error)));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const handleDismissed = () => {
    shown.current = false;
    if (!savedNotice.current) return;
    savedNotice.current = false;
    appAlert(t("nameSaved"));
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onDismissed={handleDismissed}
      style={styles.body}
      header={
        <View style={[styles.head, isRTL && styles.rowRTL]}>
          <Text style={styles.title}>{t("editName")}</Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => pressed && styles.pressed}
            accessibilityRole="button"
            accessibilityLabel={t("close")}
          >
            <Feather name="x" size={22} color={colors.ink} />
          </Pressable>
        </View>
      }
    >
      <Text style={[styles.hint, isRTL && styles.textRTL]}>{t("editNameHint")}</Text>

      <ThemedTextInput
        value={name}
        onChangeText={setName}
        placeholder={t("fullNamePlaceholder")}
        autoFocus
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="done"
        onSubmitEditing={save}
        textAlign={isRTL ? "right" : "left"}
      />

      <Pressable
        style={({ pressed }) => [
          styles.submit,
          !canSave && styles.submitDisabled,
          pressed && canSave && styles.pressed,
        ]}
        onPress={save}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityLabel={t("save")}
        accessibilityState={{ disabled: !canSave, busy: saving }}
      >
        {saving ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <Text style={styles.submitText}>{t("save")}</Text>
        )}
      </Pressable>
    </BottomSheet>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    body: { gap: 14 },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    rowRTL: { flexDirection: "row-reverse" },
    textRTL: { textAlign: "right" },
    title: { fontFamily: fonts.serif, fontSize: 24, color: colors.ink },
    // Tucked under the title: the body's gap is for the controls below it.
    hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.onSurface.muted, marginTop: -12 },
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
    pressed: { opacity: 0.7 },
  });
