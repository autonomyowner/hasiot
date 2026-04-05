import React, { useState } from "react";
import { TextInput, StyleSheet, type TextInputProps } from "react-native";

interface ThemedTextInputProps extends TextInputProps {
  isRTL?: boolean;
}

export function ThemedTextInput({ isRTL, style, ...props }: ThemedTextInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <TextInput
      {...props}
      style={[
        styles.input,
        isRTL && styles.inputRTL,
        isFocused && styles.inputFocused,
        style,
      ]}
      onFocus={(e) => {
        setIsFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setIsFocused(false);
        props.onBlur?.(e);
      }}
      placeholderTextColor={props.placeholderTextColor || "#A3A3A3"}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  inputRTL: {
    textAlign: "right",
  },
  inputFocused: {
    borderColor: "#0D7A5F",
    borderWidth: 1.5,
  },
});
