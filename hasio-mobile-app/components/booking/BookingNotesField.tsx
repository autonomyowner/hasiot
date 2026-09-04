import React, { forwardRef, useImperativeHandle, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ThemedTextInput } from "@/components/ui/ThemedTextInput";
import { fonts } from "@/constants/colors";

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
          placeholderTextColor="#A3A3A3"
          multiline
          numberOfLines={3}
          maxLength={500}
          textAlign={isRTL ? "right" : "left"}
        />
      </View>
    );
  }
);

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 15,
    fontFamily: fonts.semibold,
    color: "#1A1A1A",
    marginTop: 8,
  },
  textRTL: {
    textAlign: "right",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    marginTop: 8,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
});
