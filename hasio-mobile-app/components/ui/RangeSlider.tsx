import React, { useMemo, useRef, useState } from "react";
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { colors, type AppFonts } from "@/constants/colors";
import { useThemedStyles } from "@/hooks/useAppFonts";

interface RangeSliderProps {
  min: number;
  max: number;
  /** Values snap to this. Also the smallest gap the two thumbs may keep. */
  step: number;
  lower: number;
  upper: number;
  onChange: (lower: number, upper: number) => void;
  /** Renders a value as money, in whichever currency the reader picked. */
  formatValue: (value: number) => string;
  isRTL?: boolean;
  minLabel: string;
  maxLabel: string;
}

const THUMB = 28;
const TRACK_HEIGHT = 4;

/**
 * Two-thumb budget slider.
 *
 * `PanResponder` rather than react-native-gesture-handler: the app never
 * mounted a `GestureHandlerRootView`, so its gestures would be dead on Android,
 * and adding one to the root layout to get a slider is a lot of blast radius
 * for one control. PanResponder is core React Native and needs no provider.
 *
 * Values live in React state rather than on the UI thread. A step-snapped
 * slider only emits a handful of updates across a full drag, so the extra
 * smoothness of a shared value would buy nothing and would have to be copied
 * back to JS anyway for the filter to read it.
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

  // The thumb being dragged reads its start value from here: state inside a
  // PanResponder closure would be the value from the render that created it.
  const dragStart = useRef({ lower, upper });
  const latest = useRef({ lower, upper });
  latest.current = { lower, upper };

  // Same reason, and it bites harder: the responders are memoised, so a handler
  // that closed over `onChange` would keep calling the first one it ever saw.
  // In the filter sheet that callback spreads the whole filter object, so a
  // city picked after the slider mounted would be reverted by the next drag.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const span = Math.max(max - min, 1);
  const usable = Math.max(width - THUMB, 1);

  const toPosition = (value: number) => ((value - min) / span) * usable;
  const snap = (value: number) =>
    Math.min(max, Math.max(min, Math.round(value / step) * step));

  const makeResponder = (thumb: "lower" | "upper") =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStart.current = latest.current;
      },
      onPanResponderMove: (_event, gesture) => {
        if (usable <= 0) return;
        // In Arabic the track runs the other way, so a drag to the right has
        // to lower the value rather than raise it.
        const delta = ((isRTL ? -gesture.dx : gesture.dx) / usable) * span;
        const start = dragStart.current;

        if (thumb === "lower") {
          const next = snap(Math.min(start.lower + delta, latest.current.upper - step));
          if (next !== latest.current.lower) onChangeRef.current(next, latest.current.upper);
        } else {
          const next = snap(Math.max(start.upper + delta, latest.current.lower + step));
          if (next !== latest.current.upper) onChangeRef.current(latest.current.lower, next);
        }
      },
    });

  // Rebuilding a responder every render would drop an in-flight drag.
  const lowerResponder = useMemo(
    () => makeResponder("lower"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [usable, span, step, isRTL]
  );
  const upperResponder = useMemo(
    () => makeResponder("upper"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [usable, span, step, isRTL]
  );

  const onLayout = (event: LayoutChangeEvent) =>
    setWidth(event.nativeEvent.layout.width);

  const lowerPosition = toPosition(lower);
  const upperPosition = toPosition(upper);
  // The filled segment is drawn from whichever edge the track starts at.
  const fillStart = isRTL ? usable - upperPosition : lowerPosition;
  const fillWidth = Math.max(upperPosition - lowerPosition, 2);

  return (
    <View>
      <View style={[styles.valueRow, isRTL && styles.rowRTL]}>
        <View style={styles.valueBlock}>
          <Text style={styles.valueCaption}>{minLabel}</Text>
          <Text style={styles.value}>{formatValue(lower)}</Text>
        </View>
        <View style={[styles.valueBlock, styles.valueBlockEnd]}>
          <Text style={styles.valueCaption}>{maxLabel}</Text>
          <Text style={styles.value}>{formatValue(upper)}</Text>
        </View>
      </View>

      <View style={styles.trackArea} onLayout={onLayout}>
        <View style={styles.track} />
        <View
          style={[
            styles.fill,
            { left: fillStart + THUMB / 2, width: fillWidth },
          ]}
        />

        <View
          {...lowerResponder.panHandlers}
          style={[
            styles.thumb,
            { left: isRTL ? usable - lowerPosition : lowerPosition },
          ]}
          accessibilityRole="adjustable"
          accessibilityLabel={`${minLabel}: ${formatValue(lower)}`}
        />
        <View
          {...upperResponder.panHandlers}
          style={[
            styles.thumb,
            { left: isRTL ? usable - upperPosition : upperPosition },
          ]}
          accessibilityRole="adjustable"
          accessibilityLabel={`${maxLabel}: ${formatValue(upper)}`}
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
    trackArea: {
      height: THUMB,
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
      height: TRACK_HEIGHT,
      borderRadius: TRACK_HEIGHT / 2,
      backgroundColor: colors.primary.DEFAULT,
    },
    thumb: {
      position: "absolute",
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
