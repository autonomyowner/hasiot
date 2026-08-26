import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { colors, fonts } from "@/constants/colors";

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
        source={imageUrl ? { uri: imageUrl } : undefined}
        style={styles.image}
        contentFit="cover"
        transition={300}
      />
      <View style={styles.overlay} />
      <View style={[styles.content, isRTL && styles.contentRTL]}>
        <Text style={[styles.title, isRTL && styles.textRTL]}>{title}</Text>
        <View style={[styles.captionChip, isRTL && styles.captionChipRTL]}>
          <Feather name="map-pin" size={11} color="#FFFFFF" />
          <Text style={[styles.subtitle, isRTL && styles.textRTL]}>
            {subtitle}
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    height: 160,
    borderRadius: 18,
    overflow: "hidden",
    marginRight: 16,
    backgroundColor: colors.sand,
  },
  image: {
    width: "100%",
    height: "100%",
    position: "absolute",
    backgroundColor: colors.sand,
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
    fontFamily: fonts.semibold,
    color: "#FFFFFF",
    marginBottom: 6,
  },
  captionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "rgba(20, 18, 12, 0.55)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  captionChipRTL: {
    flexDirection: "row-reverse",
    alignSelf: "flex-end",
  },
  subtitle: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: "#FFFFFF",
  },
  textRTL: {
    textAlign: "right",
  },
});
