import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/constants/colors";
import { useKeyboardOverlap } from "@/hooks/useKeyboardOverlap";
import { useLanguage } from "@/hooks/useLanguage";
import { useDialogStore } from "@/stores/dialogStore";
import { AppDialogHost } from "./AppDialog";

interface BottomSheetProps {
  visible: boolean;
  /** Backdrop tap, the Android back button, or the handle dragged down. */
  onClose: () => void;
  /**
   * The sheet has left the screen and its native Modal is gone.
   *
   * This is the moment to show an alert about what the sheet just did, or to
   * open the next sheet. On iOS nothing can be presented while this one is
   * still presented — it is refused silently — so "close, then alert" must
   * wait for this rather than run on the same tick.
   */
  onDismissed?: () => void;
  /**
   * Rendered in the drag zone under the handle, so the title row can be
   * grabbed as well as the handle itself. Anything else goes in children.
   */
  header?: React.ReactNode;
  children: React.ReactNode;
  /** The panel's own padding. The bottom inset and keyboard are added to it. */
  style?: StyleProp<ViewStyle>;
  /** Space under the content, on top of the home-indicator inset. */
  bottomPadding?: number;
  /** Tallest the panel may grow, as a share of the window. */
  maxHeightRatio?: number;
}

const OPEN_MS = 300;
const CLOSE_MS = 220;
// Decelerate in, accelerate out: the panel arrives settling and leaves
// already moving, which is how the platform's own sheets feel.
const OPEN_EASING = Easing.out(Easing.cubic);
const CLOSE_EASING = Easing.in(Easing.cubic);
const SNAP_BACK = { damping: 22, stiffness: 260 } as const;
const BACKDROP = "rgba(31, 29, 23, 0.4)";
// The muted text colour at half strength. The border token it used to be is
// 1.2:1 on the white panel — a handle nobody could see is no invitation.
const HANDLE = "rgba(139, 133, 118, 0.5)";

/**
 * The app's one bottom sheet: a panel that slides up over a backdrop that
 * fades.
 *
 * Every sheet used to be its own `transparent` Modal with
 * `animationType="slide"`. That animates the Modal's whole window, so the dim
 * backdrop rode up from the bottom edge together with the panel — a dark slab
 * with a hard top edge sliding over the screen — and slid back down on close.
 * Here the native Modal does not animate at all; the backdrop fades and the
 * panel slides, both on the UI thread, and the Modal is only taken down once
 * the panel is off screen, so closing animates too.
 *
 * It also carries what each sheet used to re-implement, or forget:
 * - the keyboard: `KeyboardAvoidingView` on iOS, and on Android the measured
 *   overlap from `useKeyboardOverlap`, because edge-to-edge Android 15 no
 *   longer resizes the window for it;
 * - an `AppDialogHost`, so an alert fired while the sheet is up draws above
 *   it rather than behind it (on iOS, behind means not at all);
 * - the home-indicator inset, with the window drawn edge to edge on Android so
 *   the backdrop covers the status and navigation bars as well;
 * - a drag handle: pull the handle or the header down and let go to close.
 *   `PanResponder` rather than gesture-handler, which has no root view in this
 *   app and so no working gestures inside a Modal on Android.
 */
export function BottomSheet({
  visible,
  onClose,
  onDismissed,
  header,
  children,
  style,
  bottomPadding = 20,
  maxHeightRatio = 0.9,
}: BottomSheetProps) {
  const reducedMotion = useReducedMotion();
  const dialogUp = useDialogStore((state) => state.current !== null);

  // The Modal outlives `visible` by the length of the closing animation.
  // Adjusted during render rather than in an effect, so the frame that makes
  // the sheet visible already has its Modal mounted.
  const [mounted, setMounted] = useState(visible);

  // On iOS, dismissing a Modal that is itself presenting something dismisses
  // that child instead: the alert goes, and the sheet stays presented but
  // empty — a transparent screen that swallows every touch. So the sheet's
  // Modal is never taken down while a dialog is up (it renders in this sheet's
  // own host, above it). Two cases:
  // - asked to close *under* an alert ("Saved" then close, a confirm whose
  //   action closes the sheet): the panel stays until the alert has left, then
  //   slides away — the order people expect;
  // - an alert raised *after* the close began (a parent reporting on the
  //   request the sheet sent): the panel keeps sliding away, and only the
  //   invisible Modal waits for the alert (see finishClose).
  const [holding, setHolding] = useState(false);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setMounted(true);
      setHolding(false);
    } else if (mounted && dialogUp) {
      setHolding(true);
    }
  }
  if (holding && !dialogUp) setHolding(false);
  const shown = visible || holding;

  // 0 = off screen, 1 = open. The panel's translation derives from it and
  // from its measured height, so it starts fully hidden whatever its size.
  const progress = useSharedValue(0);
  const panelHeight = useSharedValue(Dimensions.get("window").height);
  const drag = useSharedValue(0);

  // Read inside a callback that outlives the render that made it (the close
  // animation's completion).
  const onDismissedRef = useRef(onDismissed);
  useEffect(() => {
    onDismissedRef.current = onDismissed;
  });

  // Set when the panel has finished leaving while a dialog was still up in the
  // sheet's host: the Modal comes down once the dialog has gone instead.
  const unmountDeferred = useRef(false);

  const unmount = useCallback(() => {
    setMounted(false);
    // iOS says so itself once the native dismissal is over — `onDismiss` on
    // the Modal below. Android has no such event and no presentation to wait
    // for; one frame lets the sheet's own dialog host unmount first, so an
    // alert raised in response lands on the screen underneath.
    if (Platform.OS !== "ios") {
      requestAnimationFrame(() => onDismissedRef.current?.());
    }
  }, []);

  const finishClose = useCallback(() => {
    if (useDialogStore.getState().current !== null) {
      unmountDeferred.current = true;
      return;
    }
    unmount();
  }, [unmount]);

  useEffect(() => {
    if (dialogUp || !unmountDeferred.current) return;
    unmountDeferred.current = false;
    unmount();
  }, [dialogUp, unmount]);

  useEffect(() => {
    if (shown) {
      unmountDeferred.current = false;
      drag.value = 0;
      // Start from fully hidden whatever the last content measured; the new
      // panel's first layout corrects it before a frame of it shows.
      if (progress.value === 0) panelHeight.value = Dimensions.get("window").height;
      progress.value = withTiming(1, {
        duration: reducedMotion ? 0 : OPEN_MS,
        easing: OPEN_EASING,
      });
    } else if (mounted) {
      progress.value = withTiming(
        0,
        { duration: reducedMotion ? 0 : CLOSE_MS, easing: CLOSE_EASING },
        (finished) => {
          "worklet";
          // Not finished means it was reopened mid-close: stay mounted.
          if (finished) scheduleOnRN(finishClose);
        }
      );
    }
  }, [shown, mounted, reducedMotion, finishClose, progress, drag, panelHeight]);

  const handleNativeDismiss = useCallback(() => {
    onDismissedRef.current?.();
  }, []);

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      onDismiss={handleNativeDismiss}
    >
      {/* Its own component so its keyboard listeners, pan responder and
          dialog host exist only while the sheet is up: a Modal renders its
          children only while shown, and a screen of cards each holding a
          closed sheet was otherwise a screen of idle keyboard listeners. */}
      <SheetBody
        progress={progress}
        drag={drag}
        panelHeight={panelHeight}
        onClose={onClose}
        header={header}
        style={style}
        bottomPadding={bottomPadding}
        maxHeightRatio={maxHeightRatio}
      >
        {children}
      </SheetBody>
    </Modal>
  );
}

interface SheetBodyProps
  extends Pick<
    BottomSheetProps,
    "onClose" | "header" | "children" | "style" | "bottomPadding" | "maxHeightRatio"
  > {
  progress: SharedValue<number>;
  drag: SharedValue<number>;
  panelHeight: SharedValue<number>;
}

function SheetBody({
  progress,
  drag,
  panelHeight,
  onClose,
  header,
  children,
  style,
  bottomPadding = 20,
  maxHeightRatio = 0.9,
}: SheetBodyProps) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const {
    ref: keyboardRef,
    overlap: keyboardOverlap,
    onLayout: keyboardOnLayout,
  } = useKeyboardOverlap();

  // Read when a drag ends, by a responder that is created once.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const pan = useMemo(
    () =>
      // Built once, and reads `onCloseRef` only when a drag ends — never while
      // rendering. Rebuilding it per render instead would hand the responder
      // fresh handlers mid-drag whenever the parent re-rendered, and the drag
      // would jump.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        // Only a clearly downward drag claims the touch, so a tap on a
        // button in the header still lands on the button.
        onMoveShouldSetPanResponder: (_e, g) =>
          g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
          // Never above its resting place: that would lift the panel's
          // bottom edge off the screen and show the page through the gap.
          drag.value = Math.max(0, g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          const distance = Math.min(140, panelHeight.value * 0.3);
          if (g.dy > distance || g.vy > 1.1) {
            onCloseRef.current();
          } else {
            drag.value = withSpring(0, SNAP_BACK);
          }
        },
        onPanResponderTerminate: () => {
          drag.value = withSpring(0, SNAP_BACK);
        },
      }),
    [drag, panelHeight]
  );

  const backdropStyle = useAnimatedStyle(() => {
    // Dims less as the panel is dragged away, so letting go past the
    // threshold reads as the same motion finishing.
    const pulled = Math.min(drag.value / Math.max(panelHeight.value, 1), 1);
    return { opacity: progress.value * (1 - pulled * 0.6) };
  });

  const panelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - progress.value) * panelHeight.value + drag.value },
    ],
  }));

  const handlePanelLayout = (e: LayoutChangeEvent) => {
    panelHeight.value = e.nativeEvent.layout.height;
  };

  const maxHeight = windowHeight * (maxHeightRatio ?? 0.9);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("close")}
        />
      </Animated.View>

      {/* Full height, with the panel at its foot, rather than pinned to the
          bottom edge: the keyboard's padding then takes room away from the
          panel, which shrinks and lets its content scroll, instead of
          pushing a tall panel's top off the screen. The top padding keeps it
          clear of the status bar whatever it is asked to hold. */}
      <KeyboardAvoidingView
        style={[styles.avoider, { paddingTop: insets.top + 12 }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        pointerEvents="box-none"
      >
        <Animated.View
          onLayout={handlePanelLayout}
          style={[styles.panel, { maxHeight }, panelStyle]}
        >
          {/* keyboardOverlap is Android-only (always 0 on iOS, where the
              KeyboardAvoidingView above lifts the panel instead). */}
          <View
            ref={keyboardRef}
            onLayout={keyboardOnLayout}
            style={[
              styles.body,
              style,
              {
                paddingBottom:
                  keyboardOverlap > 0
                    ? keyboardOverlap + 16
                    : insets.bottom + bottomPadding,
              },
            ]}
          >
            <View {...pan.panHandlers} style={styles.grabZone}>
              <View style={styles.handle} />
              {header}
            </View>
            {children}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Alerts fired while the sheet is up render above it. */}
      <AppDialogHost />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: BACKDROP,
  },
  avoider: {
    ...StyleSheet.absoluteFill,
    justifyContent: "flex-end",
  },
  // The sheet family: one flat surface with a 28px top radius.
  panel: {
    flexShrink: 1,
    backgroundColor: colors.surface.DEFAULT,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  body: {
    flexShrink: 1,
    paddingHorizontal: 24,
  },
  // Tall enough to grab without aiming: the handle itself is 4pt.
  grabZone: {
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: HANDLE,
    alignSelf: "center",
    marginBottom: 10,
  },
});
