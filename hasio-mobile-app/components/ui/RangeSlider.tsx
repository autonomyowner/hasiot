import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
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
   * Fires when a drag ends or a screen reader nudges a thumb — not while a
   * thumb moves, and not at all for a touch that changed nothing.
   *
   * Dragging is a continuous gesture and the filter it feeds re-runs a whole
   * screen's worth of list building; committing per frame meant every frame
   * waited on that work, which is what made this feel stuck. The labels still
   * count up during the drag — see `dragDisplay` below.
   */
  onChange: (lower: number, upper: number) => void;
  /**
   * True while a finger is on the slider, false once it lets go. A scrolling
   * parent uses it to hold still — see the note on `onPanResponderTerminate`.
   */
  onSlidingChange?: (sliding: boolean) => void;
  /** Renders a value as money, in whichever currency the reader picked. */
  formatValue: (value: number) => string;
  isRTL?: boolean;
  minLabel: string;
  maxLabel: string;
}

const THUMB = 28;
const TRACK_HEIGHT = 4;
// The whole band takes touches, not only the thumbs: the 28pt thumbs were the
// only targets, and at 28pt they were easy to miss.
const BAND = THUMB + 16;
// A touch this close to a thumb's centre takes hold of that thumb. Anywhere
// else on the band, the nearer thumb comes to the touch.
const GRAB_RADIUS = BAND / 2;
/** How long a released thumb takes to settle onto its snapped value. */
const SETTLE_MS = 120;

const ADJUST_ACTIONS = [{ name: "increment" }, { name: "decrement" }];

type Thumb = "lower" | "upper";

/** `value` on the step grid that starts at `min`, and inside the range. */
function snapToStep(value: number, min: number, max: number, step: number) {
  return Math.min(max, Math.max(min, min + Math.round((value - min) / step) * step));
}

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
 * number actually changes, and the filter is told once, when the finger lifts.
 *
 * One responder covers the whole band rather than one per thumb. That is what
 * makes three things possible that two thumb-sized targets could not do: a
 * touch on the bare track moves the nearer thumb there; the band is a 44pt
 * target all the way along; and when the two thumbs overlap — close prices at
 * the top of a wide range — the first move decides which one the finger meant,
 * where before the upper thumb, drawn on top, took every such touch and the
 * lower one could not be pulled back out from under it.
 */
export function RangeSlider({
  min,
  max,
  step,
  lower,
  upper,
  onChange,
  onSlidingChange,
  formatValue,
  isRTL = false,
  minLabel,
  maxLabel,
}: RangeSliderProps) {
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);

  const span = Math.max(max - min, 1);
  const usable = Math.max(width - THUMB, 1);
  // A range the data has since outgrown — a budget set before the dearest stay
  // was delisted — is drawn at the nearest end rather than off the track.
  const low = Math.min(Math.max(lower, min), max);
  const high = Math.min(Math.max(upper, min), max);

  // Where the thumbs are drawn, in value space, on the UI thread.
  const lowerValue = useSharedValue(low);
  const upperValue = useSharedValue(high);

  // What the captions read while a finger is down: the snapped values, so it
  // changes a handful of times across a drag rather than once per frame. Null
  // the rest of the time, when the props are the truth.
  const [dragDisplay, setDragDisplay] = useState<{ lower: number; upper: number } | null>(
    null
  );
  const shown = dragDisplay ?? { lower: low, upper: high };

  // Where the gesture has moved the thumbs to, in value space.
  const live = useRef({ lower: low, upper: high });
  // The drag in progress: which thumb, and where both started. `thumb` is null
  // while it is still undecided — see the overlap case in the grant.
  const gesture = useRef<{ thumb: Thumb | null; lower: number; upper: number } | null>(null);

  // Everything the responder reads. It is built once — a responder rebuilt
  // mid-drag drops the drag — so it cannot close over any one render's values:
  // `onChange` above all, which in the filter sheet spreads the whole filter
  // object, where a stale copy would revert a city picked after this mounted.
  // Refreshed after every render.
  const latest = useRef({
    usable,
    span,
    min,
    max,
    step,
    isRTL,
    lower: low,
    upper: high,
    onChange,
    onSlidingChange,
  });
  useEffect(() => {
    latest.current = {
      usable,
      span,
      min,
      max,
      step,
      isRTL,
      lower: low,
      upper: high,
      onChange,
      onSlidingChange,
    };
  });

  // Someone else moved the range — Clear, a screen-reader nudge, new bounds.
  // Follow it rather than keeping whatever the last drag left behind.
  //
  // The guard is what keeps this from firing on our own release: committing
  // sends these exact numbers up to the parent and straight back down, and
  // syncing on that would cancel the settle animation a frame after it started.
  useEffect(() => {
    if (live.current.lower === low && live.current.upper === high) return;
    live.current = { lower: low, upper: high };
    lowerValue.value = low;
    upperValue.value = high;
  }, [low, high, lowerValue, upperValue]);

  // A slider unmounted mid-drag — the sheet closed under the finger — never
  // hears the release, so it says so here instead of leaving its parent frozen.
  useEffect(
    () => () => {
      if (gesture.current) latest.current.onSlidingChange?.(false);
    },
    []
  );

  const responder = useMemo(() => {
    const snap = (value: number) => {
      const g = latest.current;
      return snapToStep(value, g.min, g.max, g.step);
    };

    // The centre of a thumb holding `value`, in the band's own coordinates.
    const centreOf = (value: number) => {
      const g = latest.current;
      const along = ((value - g.min) / g.span) * g.usable;
      return THUMB / 2 + (g.isRTL ? g.usable - along : along);
    };

    // The value under a point on the band.
    const valueAt = (x: number) => {
      const g = latest.current;
      const along = Math.min(Math.max(x - THUMB / 2, 0), g.usable);
      return g.min + ((g.isRTL ? g.usable - along : along) / g.usable) * g.span;
    };

    // Move one thumb, never past the other, and update the captions only when
    // the snapped number a reader would see has actually changed.
    const place = (thumb: Thumb, value: number) => {
      const g = latest.current;
      if (thumb === "lower") {
        const next = Math.min(Math.max(value, g.min), live.current.upper - g.step);
        live.current.lower = next;
        lowerValue.value = next;
      } else {
        const next = Math.max(Math.min(value, g.max), live.current.lower + g.step);
        live.current.upper = next;
        upperValue.value = next;
      }
      const snapped = { lower: snap(live.current.lower), upper: snap(live.current.upper) };
      setDragDisplay((current) =>
        current && current.lower === snapped.lower && current.upper === snapped.upper
          ? current
          : snapped
      );
    };

    const finish = () => {
      const current = gesture.current;
      gesture.current = null;
      // The grant was ignored (the band had not been laid out yet).
      if (!current) return;
      const g = latest.current;
      const settled = { lower: snap(live.current.lower), upper: snap(live.current.upper) };
      live.current = settled;
      lowerValue.value = withTiming(settled.lower, { duration: SETTLE_MS });
      upperValue.value = withTiming(settled.upper, { duration: SETTLE_MS });
      setDragDisplay(null);
      g.onSlidingChange?.(false);
      // A touch that moved nothing is not a choice. Every release used to be
      // committed, which turned the untouched full range into a set budget —
      // and a set budget drops everything without a nightly rate, so one tap
      // on a thumb emptied Home of every attraction.
      if (settled.lower !== g.lower || settled.upper !== g.upper) {
        g.onChange(settled.lower, settled.upper);
      }
    };

    // Built once, and every handler reads the refs only when a touch arrives,
    // never while rendering — the same shape as BottomSheet's drag handle.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Only a touch that starts on the band: one taken over halfway through
      // would measure its drag from wherever it began.
      onMoveShouldSetPanResponder: () => false,
      // The sheet's scroll view asks for the touch once the finger drifts
      // vertically. The answer is no: the drag belongs to the slider.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const g = latest.current;
        if (g.usable <= 1) return;
        const x = event.nativeEvent.locationX;
        const nearLower = Math.abs(x - centreOf(live.current.lower)) <= GRAB_RADIUS;
        const nearUpper = Math.abs(x - centreOf(live.current.upper)) <= GRAB_RADIUS;

        let thumb: Thumb | null = null;
        if (nearLower !== nearUpper) {
          thumb = nearLower ? "lower" : "upper";
        } else if (!nearLower) {
          // The bare track: the nearer thumb comes to the finger, and a drag
          // carries on from there.
          const target = valueAt(x);
          thumb =
            Math.abs(target - live.current.lower) <= Math.abs(target - live.current.upper)
              ? "lower"
              : "upper";
          place(thumb, target);
        }
        // Near both: the thumbs overlap under the finger. Left undecided
        // until the first move says which one was meant.
        gesture.current = { thumb, lower: live.current.lower, upper: live.current.upper };
        g.onSlidingChange?.(true);
      },
      onPanResponderMove: (_event, state) => {
        const current = gesture.current;
        if (!current) return;
        const g = latest.current;
        // In Arabic the track runs the other way, so dragging right has to
        // lower the value rather than raise it.
        const delta = ((g.isRTL ? -state.dx : state.dx) / g.usable) * g.span;
        if (current.thumb === null) {
          if (delta === 0) return;
          // Heading up the range can only mean the upper thumb, and down the
          // lower: the other one could not move that way past its partner.
          current.thumb = delta > 0 ? "upper" : "lower";
        }
        const start = current.thumb === "lower" ? current.lower : current.upper;
        place(current.thumb, start + delta);
      },
      onPanResponderRelease: finish,
      // Taken away regardless of the answer above: on iOS the sheet's native
      // scroll view can still claim a drag that turns vertical. Keep what the
      // drag had reached. With no handler here the drag was simply lost — the
      // thumb stayed where the finger left it and the filter never heard.
      onPanResponderTerminate: finish,
    });
  }, [lowerValue, upperValue]);

  const onLayout = (event: LayoutChangeEvent) =>
    setWidth(event.nativeEvent.layout.width);

  // VoiceOver and TalkBack: swipe up or down on a thumb to move it one step,
  // committed at once like a released drag.
  const nudge = (thumb: Thumb, direction: 1 | -1) => {
    const next =
      thumb === "lower"
        ? {
            lower: Math.min(snapToStep(low + direction * step, min, max, step), high - step),
            upper: high,
          }
        : {
            lower: low,
            upper: Math.max(snapToStep(high + direction * step, min, max, step), low + step),
          };
    if (next.lower !== low || next.upper !== high) onChange(next.lower, next.upper);
  };
  const actionFor = (thumb: Thumb) => (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === "increment") nudge(thumb, 1);
    else if (event.nativeEvent.actionName === "decrement") nudge(thumb, -1);
  };

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
    const from = ((lowerValue.value - min) / span) * usable;
    const to = ((upperValue.value - min) / span) * usable;
    return {
      transform: [{ translateX: (isRTL ? usable - to : from) + THUMB / 2 }],
      width: Math.max(to - from, 2),
    };
  });

  return (
    <View>
      {/* Each caption hugs its own outer edge, whichever side that is. */}
      <View style={[styles.valueRow, isRTL && styles.rowRTL]}>
        <View style={[styles.valueBlock, isRTL && styles.valueBlockEnd]}>
          <Text style={styles.valueCaption}>{minLabel}</Text>
          <Text style={styles.value}>{formatValue(shown.lower)}</Text>
        </View>
        <View style={[styles.valueBlock, !isRTL && styles.valueBlockEnd]}>
          <Text style={styles.valueCaption}>{maxLabel}</Text>
          <Text style={styles.value}>{formatValue(shown.upper)}</Text>
        </View>
      </View>

      {/* The children take no touches, so every touch lands on the band and
          `locationX` is always measured from its edge. */}
      <View style={styles.band} onLayout={onLayout} {...responder.panHandlers}>
        <View style={styles.track} pointerEvents="none" />
        <Animated.View style={[styles.fill, fillStyle]} pointerEvents="none" />

        <Animated.View
          pointerEvents="none"
          style={[styles.thumb, lowerThumbStyle]}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={minLabel}
          accessibilityValue={{ min, max, now: shown.lower, text: formatValue(shown.lower) }}
          accessibilityActions={ADJUST_ACTIONS}
          onAccessibilityAction={actionFor("lower")}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.thumb, upperThumbStyle]}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={maxLabel}
          accessibilityValue={{ min, max, now: shown.upper, text: formatValue(shown.upper) }}
          accessibilityActions={ADJUST_ACTIONS}
          onAccessibilityAction={actionFor("upper")}
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
    // Taller than the track and as wide as the slider, so the thumbs have
    // somewhere to be grabbed and the track can be tapped.
    band: {
      height: BAND,
      justifyContent: "center",
    },
    track: {
      height: TRACK_HEIGHT,
      borderRadius: TRACK_HEIGHT / 2,
      backgroundColor: colors.chip,
      marginHorizontal: THUMB / 2,
    },
    // The dark lime, not the fill lime: lime on the beige track is 1.16:1, so
    // the selected span barely showed. `primary.deep` is the lime family's
    // colour for anything drawn on a light surface.
    fill: {
      position: "absolute",
      left: 0,
      // Centred by hand: an absolute child with no vertical inset falls back to
      // the parent's alignment, which is a rule worth not depending on.
      top: (BAND - TRACK_HEIGHT) / 2,
      height: TRACK_HEIGHT,
      borderRadius: TRACK_HEIGHT / 2,
      backgroundColor: colors.primary.deep,
    },
    thumb: {
      position: "absolute",
      left: 0,
      top: (BAND - THUMB) / 2,
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB / 2,
      backgroundColor: colors.surface.DEFAULT,
      borderWidth: 2,
      borderColor: colors.primary.deep,
      shadowColor: colors.ink,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.16,
      shadowRadius: 6,
      elevation: 3,
    },
  });
