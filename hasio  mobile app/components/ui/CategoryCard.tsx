import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CategoryCardProps {
  title: string;
  subtitle: string;
  imageUrl: string;
  onPress: () => void;
  isRTL?: boolean;
}

export function CategoryCard({
  title,
  subtitle,
  imageUrl,
  onPress,
  isRTL = false,
}: CategoryCardProps) {
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
      style={[styles.container, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Image
        source={{ uri: imageUrl }}
        style={styles.image}
        contentFit="cover"
        transition={300}
      />
      <View style={styles.overlay} />
      <View style={[styles.content, isRTL && styles.contentRTL]}>
        <Text style={[styles.title, isRTL && styles.textRTL]}>{title}</Text>
        <Text style={[styles.subtitle, isRTL && styles.textRTL]}>
          {subtitle}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    height: 160,
    borderRadius: 16,
    overflow: "hidden",
    marginRight: 16,
  },
  image: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 16,
  },
  contentRTL: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.85)",
  },
  textRTL: {
    textAlign: "right",
  },
});
