import React from "react";
import {
  Text,
  Pressable,
  StyleSheet,
  type PressableProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  variant = "primary",
  size = "md",
  fullWidth = false,
  style,
  textStyle,
  disabled,
  ...props
}: ButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <AnimatedPressable
      style={[
        styles.base,
        styles[variant],
        styles[`${size}Size`],
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        animatedStyle,
        style,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      {...props}
    >
      <Text
        style={[
          styles.text,
          styles[`${variant}Text`],
          styles[`${size}Text`],
          disabled && styles.disabledText,
          textStyle,
        ]}
      >
        {title}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: "#0D7A5F",
  },
  secondary: {
    backgroundColor: "#F5F1EB",
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#0D7A5F",
  },
  ghost: {
    backgroundColor: "transparent",
  },
  smSize: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  mdSize: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  lgSize: {
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  fullWidth: {
    width: "100%",
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  primaryText: {
    color: "#FFFFFF",
  },
  secondaryText: {
    color: "#1A1A1A",
  },
  outlineText: {
    color: "#0D7A5F",
  },
  ghostText: {
    color: "#0D7A5F",
  },
  smText: {
    fontSize: 14,
  },
  mdText: {
    fontSize: 16,
  },
  lgText: {
    fontSize: 18,
  },
  disabledText: {
    color: "#A3A3A3",
  },
});
