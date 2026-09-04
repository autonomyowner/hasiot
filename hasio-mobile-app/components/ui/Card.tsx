import React from "react";
import { View, Pressable, StyleSheet, type ViewStyle } from "react-native";
import { colors } from "@/constants/colors";
import { SurfaceGradient } from "./Gradients";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  elevated?: boolean;
  noPadding?: boolean;
}

export function Card({
  children,
  onPress,
  style,
  elevated = false,
  noPadding = false,
}: CardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    }
  };

  if (onPress) {
    return (
      <AnimatedPressable
        style={[
          styles.card,
          elevated && styles.elevated,
          noPadding && styles.noPadding,
          animatedStyle,
          style,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {/* Matches the card radius rather than clipping with overflow:hidden,
            which would drop the shadow on iOS. */}
        <SurfaceGradient style={styles.wash} />
        {children}
      </AnimatedPressable>
    );
  }

  return (
    <View
      style={[
        styles.card,
        elevated && styles.elevated,
        noPadding && styles.noPadding,
        style,
      ]}
    >
      <SurfaceGradient style={styles.wash} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  elevated: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  noPadding: {
    padding: 0,
  },
  wash: {
    borderRadius: 16,
  },
});
