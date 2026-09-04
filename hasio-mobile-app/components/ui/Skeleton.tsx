import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  StyleSheet,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { colors } from "@/constants/colors";

/**
 * Skeleton primitives.
 *
 * A skeleton is a static block of the app's own placeholder sand with a soft
 * highlight sweeping across it. Nothing about the block moves: the only animated
 * property in this file is the `translateX` of a gradient clipped inside each
 * block, which the compositor can handle on its own. No layout, no colour
 * interpolation per frame, and no JS timer driving frames — one Reanimated clock
 * on the UI thread drives every placeholder on screen.
 */

// One pass of the highlight. The brief moment the band spends off the element at
// each end is what separates one sweep from the next.
const SWEEP_DURATION = 1700;

// Skeleton -> content cross-fade.
const FADE_DURATION = 260;

/**
 * Derived from the palette rather than written here, so the skeletons follow the
 * app's theme wherever it goes — including a future dark palette — without a
 * second set of colours to keep in sync. The base is the same sand the cards
 * already show behind an image that has not loaded; the highlight is the surface
 * colour washed over it.
 *
 * The band fades to a *transparent version of the highlight* rather than to the
 * `transparent` keyword: on Android that keyword is rgba(0,0,0,0), and
 * interpolating towards it drags a grey shadow through the middle of the sweep.
 */
function withAlpha(token: string, alpha: number): string {
  const value = token.replace("#", "");
  const hex =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const SWEEP_COLORS = [
  withAlpha(colors.surface.DEFAULT, 0),
  withAlpha(colors.surface.DEFAULT, 0.6),
  withAlpha(colors.surface.DEFAULT, 0),
] as const;

const SWEEP_START = { x: 0, y: 0 } as const;
const SWEEP_END = { x: 1, y: 0 } as const;

/**
 * Where an element sits in the shared cycle, so a screenful of placeholders
 * ripples rather than pulsing in unison. Wraps every 8 elements — enough spread
 * to read as staggered, small enough that no element trails far behind.
 */
export function sweepPhase(index: number): number {
  return (index % 8) * 0.06;
}

const SweepClockContext = createContext<SharedValue<number> | null>(null);

/**
 * Shares one clock with every skeleton beneath it. Without this each placeholder
 * would run its own repeating animation — a dozen timelines to advance every
 * frame for one visual effect — and they would all sweep in lockstep anyway.
 */
export function SkeletonGroup({ children }: { children: React.ReactNode }) {
  const clock = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;

    clock.value = 0;
    clock.value = withRepeat(
      withTiming(1, { duration: SWEEP_DURATION, easing: Easing.linear }),
      -1,
      false
    );

    return () => cancelAnimation(clock);
  }, [clock, reduceMotion]);

  return (
    <SweepClockContext.Provider value={clock}>
      {children}
    </SweepClockContext.Provider>
  );
}

/**
 * The group's clock when there is one, otherwise a private clock so a lone
 * `<Skeleton />` still animates. The hooks run either way — only the animation
 * is conditional.
 */
function useSweepClock(): SharedValue<number> {
  const shared = useContext(SweepClockContext);
  const own = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const hasShared = shared !== null;

  useEffect(() => {
    if (hasShared || reduceMotion) return;

    own.value = 0;
    own.value = withRepeat(
      withTiming(1, { duration: SWEEP_DURATION, easing: Easing.linear }),
      -1,
      false
    );

    return () => cancelAnimation(own);
  }, [hasShared, own, reduceMotion]);

  return shared ?? own;
}

interface SkeletonProps {
  style?: StyleProp<ViewStyle>;
  /** Corner radius — copy it from the element being stood in for. */
  radius?: number;
  /** 0–1 offset into the shared cycle. See `sweepPhase`. */
  phase?: number;
}

export function Skeleton({ style, radius, phase = 0 }: SkeletonProps) {
  const clock = useSweepClock();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);

  // One measurement per element, not one per frame: the sweep needs to know how
  // far to travel, and that only changes when the layout does.
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setWidth((current) => (current === next ? current : next));
  }, []);

  const sweepStyle = useAnimatedStyle(() => {
    // The band is as wide as the element, so ±1.6 widths puts it clear of both
    // edges: the jump as the cycle wraps happens out of sight.
    const progress = (clock.value + phase) % 1;
    return {
      transform: [
        {
          translateX: interpolate(progress, [0, 1], [-width * 1.6, width * 1.6]),
        },
      ],
    };
  }, [width, phase]);

  return (
    <View
      onLayout={reduceMotion ? undefined : handleLayout}
      style={[styles.base, radius !== undefined && { borderRadius: radius }, style]}
    >
      {!reduceMotion && width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, sweepStyle]}
        >
          <LinearGradient
            colors={SWEEP_COLORS}
            start={SWEEP_START}
            end={SWEEP_END}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

interface SkeletonLineProps {
  /** Bar width. Text is rarely full-bleed, so neither is its placeholder. */
  width: DimensionValue;
  /** Height of the line box being replaced, so the bar takes the same space. */
  box: number;
  /** Height of the bar itself, centred in that box. Defaults to 70% of it. */
  bar?: number;
  /** Arabic right-aligns its text; the bar standing in for it has to follow. */
  isRTL?: boolean;
  phase?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A text placeholder. The wrapper reproduces the line box of the real text (and
 * carries its margins) while the bar inside is deliberately shorter — a bar as
 * tall as its line box reads as a block, not as writing.
 *
 * The wrapper stays full width and the bar is aligned inside it, rather than the
 * caller shrinking the wrapper: a percentage width against an auto-sized parent
 * has nothing to resolve against.
 */
export function SkeletonLine({
  width,
  box,
  bar,
  isRTL = false,
  phase = 0,
  style,
}: SkeletonLineProps) {
  const barHeight = bar ?? Math.round(box * 0.7);

  return (
    <View
      style={[
        { height: box },
        styles.lineBox,
        isRTL && styles.lineBoxRTL,
        style,
      ]}
    >
      <Skeleton phase={phase} style={{ width, height: barHeight, borderRadius: 4 }} />
    </View>
  );
}

interface SkeletonPillProps {
  width: DimensionValue;
  height: number;
  phase?: number;
  style?: StyleProp<ViewStyle>;
}

/** For the places the real UI is fully rounded — chips, tags, round buttons. */
export function SkeletonPill({
  width,
  height,
  phase = 0,
  style,
}: SkeletonPillProps) {
  return (
    <Skeleton
      phase={phase}
      radius={height / 2}
      style={[{ width, height }, style]}
    />
  );
}

interface SkeletonFadeProps {
  loading: boolean;
  /** Placeholder tree. Mounted inside a `SkeletonGroup` for you. */
  skeleton: React.ReactNode;
  children: React.ReactNode;
  /** Stretch to fill the parent — for a screen region, not for scroll content. */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Swaps a skeleton for its content without moving anything.
 *
 * While loading, the skeleton is in flow and gives the region its height. The
 * moment the data lands the real content takes over that flow and fades in,
 * and the skeleton — the same mounted element, only restyled — lifts *out of
 * flow* on top of it for one last fade. Nothing is ever competing for the same
 * space, so the handover cannot push content around; the only property that
 * changes is opacity.
 *
 * Restyling rather than re-mounting matters: a fresh skeleton would restart its
 * sweep from the left edge, and that jump is exactly what the eye catches.
 */
export function SkeletonFade({
  loading,
  skeleton,
  children,
  fill = false,
  style,
}: SkeletonFadeProps) {
  const [outgoing, setOutgoing] = useState(false);
  const wasLoading = useRef(loading);

  useEffect(() => {
    const justFinished = wasLoading.current && !loading;
    wasLoading.current = loading;
    if (!justFinished) return;

    setOutgoing(true);
    const timer = setTimeout(() => setOutgoing(false), FADE_DURATION);
    return () => clearTimeout(timer);
  }, [loading]);

  return (
    <View style={[fill && styles.fill, style]}>
      {/* Two fixed child slots, so React keeps the skeleton's own subtree
          mounted while the content appears beside it. */}
      {!loading && (
        <Animated.View
          style={fill ? styles.fill : undefined}
          entering={FadeIn.duration(FADE_DURATION)}
          // Composite the incoming subtree as one layer for the fade. Without
          // this, a card's elevation shadow is drawn at full strength while
          // the card itself is still transparent — a dark halo under every
          // photo for the length of the fade. Android needs the hardware
          // texture, iOS the offscreen alpha pass; both are only in effect
          // while the entering animation runs.
          renderToHardwareTextureAndroid
          needsOffscreenAlphaCompositing
        >
          {children}
        </Animated.View>
      )}

      {(loading || outgoing) && (
        <SkeletonLayer fading={outgoing}>
          <SkeletonGroup>{skeleton}</SkeletonGroup>
        </SkeletonLayer>
      )}
    </View>
  );
}

function SkeletonLayer({
  fading,
  children,
}: {
  fading: boolean;
  children: React.ReactNode;
}) {
  const opacity = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!fading) {
      opacity.value = 1;
      return;
    }

    opacity.value = reduceMotion
      ? 0
      : withTiming(0, {
          duration: FADE_DURATION,
          easing: Easing.out(Easing.quad),
        });
  }, [fading, opacity, reduceMotion]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[fading && styles.outgoingLayer, fadeStyle]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.sand,
    // Clips the sweep to the block's own corners.
    overflow: "hidden",
  },
  lineBox: {
    justifyContent: "center",
    alignItems: "flex-start",
  },
  lineBoxRTL: {
    alignItems: "flex-end",
  },
  fill: {
    flex: 1,
  },
  outgoingLayer: {
    ...StyleSheet.absoluteFillObject,
    // On its way out the skeleton keeps its natural height, which need not match
    // the content that replaced it; clipping keeps any surplus in the region.
    overflow: "hidden",
  },
});
