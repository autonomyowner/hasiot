import React, { forwardRef, useImperativeHandle, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ThemedTextInput } from "@/components/ui/ThemedTextInput";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

export interface BookingNotesFieldHandle {
  /** The trimmed draft, or undefined when empty. Read at submit time. */
  read: () => string | undefined;
  reset: () => void;
}

interface BookingNotesFieldProps {
  label: string;
  placeholder: string;
  isRTL: boolean;
}

/**
 * The notes box owns its draft.
 *
 * If this state lived in BookingSheet, every keystroke would re-render the
 * calendar above it — sixty-odd day cells — for a value the calendar never
 * reads. The parent only needs the text once, when the request is sent, so
 * it reads it through a ref at that moment instead of subscribing to it.
 */
export const BookingNotesField = forwardRef<BookingNotesFieldHandle, BookingNotesFieldProps>(
  function BookingNotesField({ label, placeholder, isRTL }, ref) {
    const styles = useThemedStyles(makeStyles);
    const [notes, setNotes] = useState("");

    useImperativeHandle(ref, () => ({
      read: () => notes.trim() || undefined,
      reset: () => setNotes(""),
    }));

    return (
      <View>
        <Text style={[styles.sectionLabel, isRTL && styles.textRTL]}>{label}</Text>
        <ThemedTextInput
          style={[styles.input, styles.textArea]}
          isRTL={isRTL}
          value={notes}
          onChangeText={setNotes}
          placeholder={placeholder}
          placeholderTextColor={colors.onSurface.muted}
          multiline
          numberOfLines={3}
          maxLength={500}
          textAlign={isRTL ? "right" : "left"}
        />
      </View>
    );
  }
);

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  sectionLabel: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: colors.ink,
    marginTop: 8,
  },
  textRTL: {
    textAlign: "right",
  },
  // A field, not a panel: the warm variant surface with a hairline, so it
  // reads as a place to type rather than as a white box on the cream page.
  input: {
    backgroundColor: colors.surface.variant,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
});
