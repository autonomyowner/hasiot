import React, { useState } from "react";
import { TextInput, StyleSheet, type TextInputProps } from "react-native";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

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
  // Themed, not module-scope: the field's typeface follows the language, so
  // Arabic typed into it is Cairo like the label above it rather than the
  // phone's fallback font. Callers' `style` still overrides any of this.
  const styles = useThemedStyles(makeStyles);
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
      placeholderTextColor={props.placeholderTextColor || colors.onSurface.muted}
    />
  );
}

// The defaults every form in the app inherits. These were the last hardcoded
// greys of the pre-redesign theme, and because this component is shared they
// leaked that theme into any screen that did not override them.
const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    input: {
      backgroundColor: colors.surface.DEFAULT,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      fontSize: 16,
      fontFamily: fonts.regular,
      color: colors.ink,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputRTL: {
      textAlign: "right",
    },
    // The dark lime, not the fill: the fill is 1.4:1 against the white field
    // and a focus ring nobody can see is no focus ring.
    inputFocused: {
      borderColor: colors.primary.deep,
      borderWidth: 1.5,
    },
  });
