import React, { useState } from "react";
import { TextInput, StyleSheet, type TextInputProps } from "react-native";

interface ThemedTextInputProps extends TextInputProps {
  isRTL?: boolean;
  /**
   * Declared explicitly rather than relying on React 19 treating `ref` as an
   * ordinary prop: callers need `.focus()` for return-key chaining, and the
   * type has to say so.
   */
  ref?: React.Ref<TextInput>;
}

export function ThemedTextInput({ isRTL, style, ref, ...props }: ThemedTextInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <TextInput
      {...props}
      ref={ref}
      style={[
        styles.input,
        isRTL && styles.inputRTL,
        style,
        // After the caller's style, not before it. Every form screen passes its
        // own `input` style that re-declares this component's default border —
        // ahead of the caller that silently cancelled the focus ring, so the
        // green border never appeared anywhere in the app. Focus is this
        // component's own state, so it wins over the caller's static styling.
        isFocused && styles.inputFocused,
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
    borderColor: "#4F5E10",
    borderWidth: 1.5,
  },
});
