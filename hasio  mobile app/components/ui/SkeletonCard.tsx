import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "@/constants/colors";

// Lightweight skeleton loaders — plain RN Animated opacity pulse, no deps.
// Uniform bars, no text, so RTL needs no special handling.

function usePulse() {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return opacity;
}

export function SkeletonBlock({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const opacity = usePulse();
  return <Animated.View style={[styles.block, style, { opacity }]} />;
}

// Matches LodgingCard/FoodCard/EventCard geometry: white card, 180px image,
// badge + two text lines + price line.
export function SkeletonListingCard() {
  return (
    <View style={styles.card}>
      <SkeletonBlock style={styles.image} />
      <View style={styles.content}>
        <SkeletonBlock style={styles.badge} />
        <SkeletonBlock style={styles.title} />
        <SkeletonBlock style={styles.subtitle} />
        <SkeletonBlock style={styles.price} />
      </View>
    </View>
  );
}

export function SkeletonRow({ count = 3 }: { count?: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonListingCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.sand,
    borderRadius: 8,
  },
  row: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 10,
    shadowColor: "#1F1D17",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 16,
  },
  image: {
    height: 180,
    borderRadius: 18,
    width: "100%",
  },
  content: {
    padding: 14,
    paddingBottom: 6,
  },
  badge: {
    width: 72,
    height: 24,
    borderRadius: 11,
    marginBottom: 10,
  },
  title: {
    width: "70%",
    height: 17,
    marginBottom: 6,
  },
  subtitle: {
    width: "45%",
    height: 13,
    marginBottom: 10,
  },
  price: {
    width: "35%",
    height: 16,
    marginBottom: 4,
  },
});
