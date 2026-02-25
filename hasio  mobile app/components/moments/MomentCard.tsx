import React from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { Moment } from "@/types";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const { width } = Dimensions.get("window");
const cardWidth = (width - 48 - 12) / 2; // 24px padding on each side, 12px gap

interface MomentCardProps {
  moment: Moment;
  isRTL: boolean;
  onPress?: () => void;
  onDelete?: () => void;
}

export function MomentCard({ moment, isRTL, onPress, onDelete }: MomentCardProps) {
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

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <AnimatedPressable
      style={[styles.container, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Image
        source={{ uri: moment.image }}
        style={styles.image}
        contentFit="cover"
        transition={300}
      />

      {/* Date Overlay */}
      <View style={styles.dateOverlay}>
        <Text style={styles.dateText}>{formatDate(moment.timestamp)}</Text>
      </View>

      {/* Delete Button */}
      {onDelete && (
        <Pressable style={styles.deleteButton} onPress={onDelete}>
          <Text style={styles.deleteButtonText}>×</Text>
        </Pressable>
      )}

      {/* Note */}
      {moment.note && (
        <View style={[styles.noteContainer, isRTL && styles.noteContainerRTL]}>
          <Text
            style={[styles.noteText, isRTL && styles.textRTL]}
            numberOfLines={2}
          >
            {moment.note}
          </Text>
        </View>
      )}

      {/* Location */}
      {moment.location && (
        <View style={[styles.locationContainer, isRTL && styles.locationContainerRTL]}>
          <Text
            style={[styles.locationText, isRTL && styles.textRTL]}
            numberOfLines={1}
          >
            {moment.location}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: cardWidth,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  image: {
    width: "100%",
    height: cardWidth,
  },
  dateOverlay: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dateText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  deleteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(220, 38, 38, 0.9)",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 20,
  },
  noteContainer: {
    padding: 12,
    paddingBottom: 8,
  },
  noteContainerRTL: {
    alignItems: "flex-end",
  },
  noteText: {
    fontSize: 14,
    color: "#1A1A1A",
    lineHeight: 20,
  },
  locationContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  locationContainerRTL: {
    alignItems: "flex-end",
  },
  locationText: {
    fontSize: 12,
    color: "#737373",
  },
  textRTL: {
    textAlign: "right",
  },
});
