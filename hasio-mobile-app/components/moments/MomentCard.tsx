import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import type { Moment } from "@/types";
import { colors, fonts } from "@/constants/colors";
import { MOMENT_CARD_WIDTH } from "@/constants/layout";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// 24px gutter each side, 12px between the columns. Shared with the skeleton.
const cardWidth = MOMENT_CARD_WIDTH;

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
        source={moment.image ? { uri: moment.image } : undefined}
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
        <Pressable
          style={styles.deleteButton}
          onPress={onDelete}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? "حذف اللحظة" : "Delete moment"}
        >
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
          <View style={[styles.locationRow, isRTL && styles.locationRowRTL]}>
            <Feather name="map-pin" size={11} color={colors.onSurface.muted} />
            <Text
              style={[styles.locationText, isRTL && styles.textRTL]}
              numberOfLines={1}
            >
              {moment.location}
            </Text>
          </View>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: cardWidth,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#1F1D17",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 12,
  },
  image: {
    width: "100%",
    height: cardWidth,
    backgroundColor: colors.sand,
  },
  dateOverlay: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(20, 18, 12, 0.55)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: fonts.medium,
  },
  deleteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(220, 38, 38, 0.9)",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: fonts.semibold,
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
    fontFamily: fonts.medium,
    color: colors.ink,
    lineHeight: 20,
  },
  locationContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  locationContainerRTL: {
    alignItems: "flex-end",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationRowRTL: {
    flexDirection: "row-reverse",
  },
  locationText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
  },
  textRTL: {
    textAlign: "right",
  },
});
