import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

interface RangeSliderProps {
  min: number;
  max: number;
  /** The values reported snap to this. Also the smallest gap between thumbs. */
  step: number;
  lower: number;
  upper: number;
  /**
   * Fires when a thumb is released, not while it moves.
   *
   * Dragging is a continuous gesture and the filter it feeds re-runs a whole
   * screen's worth of list building; committing per frame meant every frame
   * waited on that work, which is what made this feel stuck. The labels still
   * count up during the drag — see `display` below.
   */
  onChange: (lower: number, upper: number) => void;
  /** Renders a value as money, in whichever currency the reader picked. */
  formatValue: (value: number) => string;
  isRTL?: boolean;
  minLabel: string;
  maxLabel: string;
}

const THUMB = 28;
const TRACK_HEIGHT = 4;
/** How long a released thumb takes to settle onto its snapped value. */
const SETTLE_MS = 120;

/**
 * Two-thumb budget slider.
 *
 * `PanResponder` rather than react-native-gesture-handler: the app never
 * mounted a `GestureHandlerRootView`, so its gestures would be dead on Android,
 * and adding one to the root layout to get a slider is a lot of blast radius
 * for one control. PanResponder is core React Native and needs no provider.
 *
 * The thumbs move on the UI thread through shared values, so following a finger
 * costs no React render at all. Three things used to happen on every single
 * move event — a snap to the step, a `setState`, and the parent's whole filter
 * pipeline — and the thumb could only ever land on one of thirteen positions.
 * Now the motion is continuous, the labels re-render only when the snapped
 * number actually changes, and the filter is told once, on release.
 */
export function RangeSlider({
  min,
  max,
  step,
  lower,
  upper,
  onChange,
  formatValue,
  isRTL = false,
  minLabel,
  maxLabel,
}: RangeSliderProps) {
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);

  const span = Math.max(max - min, 1);
  const usable = Math.max(width - THUMB, 1);

  // Where the thumbs actually are, in value space, on the UI thread.
  const lowerValue = useSharedValue(lower);
  const upperValue = useSharedValue(upper);

  // What the two captions read. Snapped, so this changes a handful of times
  // across a drag rather than once per frame.
  const [display, setDisplay] = useState({ lower, upper });

  // Everything a memoised PanResponder must not close over: it would keep
  // whichever copy existed when the responder was built. `onChange` matters
  // most — in the filter sheet it spreads the whole filter object, so a stale
  // one would revert a city picked after this mounted.
  const live = useRef({ lower, upper });
  const dragStart = useRef({ lower, upper });
  const geometry = useRef({ usable, span, min, max, step, isRTL });
  geometry.current = { usable, span, min, max, step, isRTL };
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const snap = useCallback((value: number) => {
    const g = geometry.current;
    return Math.min(g.max, Math.max(g.min, Math.round(value / g.step) * g.step));
  }, []);

  // Someone else changed the range — Clear, or a fresh set of bounds. Follow it
  // rather than keeping whatever the last drag left behind.
  //
  // The guard is what keeps this from firing on our own release: committing
  // sends these exact numbers up to the parent and straight back down, and
  // syncing on that would cancel the settle animation a frame after it started.
  useEffect(() => {
    if (live.current.lower === lower && live.current.upper === upper) return;
    live.current = { lower, upper };
    lowerValue.value = lower;
    upperValue.value = upper;
    setDisplay({ lower, upper });
  }, [lower, upper, lowerValue, upperValue]);

  const responders = useMemo(() => {
    const build = (thumb: "lower" | "upper") =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStart.current = { ...live.current };
        },
        onPanResponderMove: (_event, gesture) => {
          const g = geometry.current;
          if (g.usable <= 0) return;

          // In Arabic the track runs the other way, so dragging right has to
          // lower the value rather than raise it.
          const delta = ((g.isRTL ? -gesture.dx : gesture.dx) / g.usable) * g.span;

          if (thumb === "lower") {
            const next = Math.min(
              Math.max(dragStart.current.lower + delta, g.min),
              live.current.upper - g.step
            );
            live.current.lower = next;
            lowerValue.value = next;
          } else {
            const next = Math.max(
              Math.min(dragStart.current.upper + delta, g.max),
              live.current.lower + g.step
            );
            live.current.upper = next;
            upperValue.value = next;
          }

          // Only when the number a reader would see has actually changed.
          const shown = { lower: snap(live.current.lower), upper: snap(live.current.upper) };
          setDisplay((current) =>
            current.lower === shown.lower && current.upper === shown.upper
              ? current
              : shown
          );
        },
        onPanResponderRelease: () => {
          const settled = {
            lower: snap(live.current.lower),
            upper: snap(live.current.upper),
          };
          live.current = settled;
          lowerValue.value = withTiming(settled.lower, { duration: SETTLE_MS });
          upperValue.value = withTiming(settled.upper, { duration: SETTLE_MS });
          setDisplay(settled);
          onChangeRef.current(settled.lower, settled.upper);
        },
      });

    return { lower: build("lower"), upper: build("upper") };
    // Built once: every moving part is read through a ref, and rebuilding
    // mid-gesture would drop the drag.
  }, [lowerValue, upperValue, snap]);

  const onLayout = (event: LayoutChangeEvent) =>
    setWidth(event.nativeEvent.layout.width);

  // Transforms, not `left`: a transform is composited on the UI thread without
  // asking the layout system for anything.
  const lowerThumbStyle = useAnimatedStyle(() => {
    const position = ((lowerValue.value - min) / span) * usable;
    return { transform: [{ translateX: isRTL ? usable - position : position }] };
  });

  const upperThumbStyle = useAnimatedStyle(() => {
    const position = ((upperValue.value - min) / span) * usable;
    return { transform: [{ translateX: isRTL ? usable - position : position }] };
  });

  const fillStyle = useAnimatedStyle(() => {
    const low = ((lowerValue.value - min) / span) * usable;
    const high = ((upperValue.value - min) / span) * usable;
    return {
      transform: [{ translateX: (isRTL ? usable - high : low) + THUMB / 2 }],
      width: Math.max(high - low, 2),
    };
  });

  return (
    <View>
      <View style={[styles.valueRow, isRTL && styles.rowRTL]}>
        <View style={styles.valueBlock}>
          <Text style={styles.valueCaption}>{minLabel}</Text>
          <Text style={styles.value}>{formatValue(display.lower)}</Text>
        </View>
        <View style={[styles.valueBlock, styles.valueBlockEnd]}>
          <Text style={styles.valueCaption}>{maxLabel}</Text>
          <Text style={styles.value}>{formatValue(display.upper)}</Text>
        </View>
      </View>

      <View style={styles.trackArea} onLayout={onLayout}>
        <View style={styles.track} />
        <Animated.View style={[styles.fill, fillStyle]} />

        <Animated.View
          {...responders.lower.panHandlers}
          style={[styles.thumb, lowerThumbStyle]}
          accessibilityRole="adjustable"
          accessibilityLabel={`${minLabel}: ${formatValue(display.lower)}`}
        />
        <Animated.View
          {...responders.upper.panHandlers}
          style={[styles.thumb, upperThumbStyle]}
          accessibilityRole="adjustable"
          accessibilityLabel={`${maxLabel}: ${formatValue(display.upper)}`}
        />
      </View>
    </View>
  );
}

const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    rowRTL: { flexDirection: "row-reverse" },
    valueRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    valueBlock: { alignItems: "flex-start" },
    valueBlockEnd: { alignItems: "flex-end" },
    valueCaption: {
      fontFamily: fonts.semibold,
      fontSize: 10.5,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      color: colors.onSurface.muted,
    },
    value: {
      fontFamily: fonts.semibold,
      fontSize: 17,
      color: colors.ink,
      marginTop: 2,
    },
    // Taller than the track so the thumbs have somewhere to be grabbed.
    trackArea: {
      height: THUMB + 16,
      justifyContent: "center",
    },
    track: {
      height: TRACK_HEIGHT,
      borderRadius: TRACK_HEIGHT / 2,
      backgroundColor: colors.chip,
      marginHorizontal: THUMB / 2,
    },
    // Lime is a fill, which is exactly what this is.
    fill: {
      position: "absolute",
      left: 0,
      // Centred by hand: an absolute child with no vertical inset falls back to
      // the parent's alignment, which is a rule worth not depending on.
      top: (THUMB + 16 - TRACK_HEIGHT) / 2,
      height: TRACK_HEIGHT,
      borderRadius: TRACK_HEIGHT / 2,
      backgroundColor: colors.primary.DEFAULT,
    },
    thumb: {
      position: "absolute",
      left: 0,
      top: 8,
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB / 2,
      backgroundColor: colors.surface.DEFAULT,
      borderWidth: 2,
      borderColor: colors.primary.DEFAULT,
      shadowColor: colors.ink,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.16,
      shadowRadius: 6,
      elevation: 3,
    },
  });
