import React, { useRef, useCallback } from "react";
import { View, Pressable, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useEvent,
  useHandler,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import PagerView from "@/components/PagerViewWrapper";
import type { PagerViewProps } from "react-native-pager-view";
import { colors, type AppFonts } from "@/constants/colors";
import { TAB_BAR_HEIGHT } from "@/constants/layout";
import { BottomBarFade } from "@/components/ui/Gradients";
import { useThemedStyles } from "@/hooks/useAppFonts";
import { useLanguage } from "@/hooks/useLanguage";
import type { TranslationKey } from "@/constants/translations";

// Import screen content components
import {
  HomeScreenContent,
  LodgingScreenContent,
  PlannerScreenContent,
  FavoritesScreenContent,
  SettingsScreenContent,
} from "@/components/screens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedPagerView = PagerView
  ? Animated.createAnimatedComponent(PagerView)
  : null;

type PagerScrollEvent = {
  eventName: string;
  position: number;
  offset: number;
};

/**
 * Subscribes to PagerView's onPageScroll as a Reanimated event, so the handler
 * runs on the UI thread.
 *
 * This is the difference between the tab bar tracking the swipe and lagging
 * behind it. As a plain `onPageScroll={fn}` prop, every scroll frame has to
 * cross to the JS thread — and while a newly revealed screen is mounting and
 * its Convex queries are resolving, that thread is busy, so the events queue up
 * and the tint jumps late. A worklet is never blocked by that work.
 */
function usePagerScrollHandler(
  handlers: { onPageScroll: (event: PagerScrollEvent) => void },
  dependencies?: unknown[]
) {
  const { doDependenciesDiffer } = useHandler(handlers, dependencies);

  return useEvent<PagerScrollEvent>(
    (event) => {
      "worklet";
      const { onPageScroll } = handlers;
      if (onPageScroll && event.eventName.endsWith("onPageScroll")) {
        onPageScroll(event);
      }
    },
    ["onPageScroll"],
    doDependenciesDiffer
  );
}
// Feather renders a Text under the hood, so `color` is a style property and can
// be animated on the UI thread like any other.
const AnimatedFeather = Animated.createAnimatedComponent(Feather);

// Active icon and label sit on / beside the lime puck. Lime is a light colour —
// white on it is 1.39:1, which is why the active icon vanished into the bar —
// so both tint to ink instead: 12.1:1.
const ACTIVE_TINT = colors.ink;
const INACTIVE_TINT = colors.onSurface.muted;

// The puck is a fixed-size circle behind the ICON only, never behind the label:
// labels differ in width between languages (and between "Plan" and "المفضلة"),
// and a fixed size keeps the swipe interpolation simple and identical per tab.
const PUCK_SIZE = 40;
const ICON_SIZE = 22;
const LABEL_SIZE = 11;
const ICON_LABEL_GAP = 3;

// The tab bar's order is this array's order, and every cross-screen jump is
// addressed by key (see navigateToTab) rather than by position — an index-based
// API meant that adding or removing a tab silently re-pointed every caller.
export type TabKey =
  | "lodging"
  | "home"
  | "planner"
  | "favorites"
  | "settings";

interface TabItem {
  key: TabKey;
  icon: keyof typeof Feather.glyphMap;
  labelKey: TranslationKey;
}

// Discovery on the left of home, the guest's own things on the right.
// Every tab carries a visible label, translated through `t(labelKey)`, which
// doubles as its accessibilityLabel — one string, so the two can never drift.
// Home sits in the middle slot: it is the tab the app opens on and the one
// the thumb rests over, so it takes the centre of the bar. Everything below
// derives from this order — HOME_INDEX, the pager's pages, the puck — so
// reordering here is the whole change.
const tabs: TabItem[] = [
  { key: "lodging", icon: "map-pin", labelKey: "tabStay" },
  { key: "planner", icon: "message-circle", labelKey: "tabPlan" },
  { key: "home", icon: "home", labelKey: "tabHome" },
  { key: "favorites", icon: "heart", labelKey: "tabFavorites" },
  { key: "settings", icon: "user", labelKey: "tabProfile" },
];

const HOME_INDEX = tabs.findIndex((tab) => tab.key === "home");

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const { t } = useLanguage();
  const pagerRef = useRef<any>(null);
  const [currentPage, setCurrentPage] = React.useState(HOME_INDEX); // Start at home
  const scrollPosition = useSharedValue(HOME_INDEX);
  const isWeb = Platform.OS === "web";

  // Runs on the UI thread — see usePagerScrollHandler.
  const pageScrollHandler = usePagerScrollHandler({
    onPageScroll: (e) => {
      "worklet";
      scrollPosition.value = e.position + e.offset;
    },
  });

  // Only bookkeeping the JS side still needs: which page is settled, for the
  // web render path and the label weight. The tint no longer waits on it.
  const handlePageSelected = useCallback((e: any) => {
    if (isWeb) return;
    const position = e.nativeEvent.position;
    setCurrentPage(position);
  }, [isWeb]);

  const handleTabPress = useCallback((index: number) => {
    if (isWeb) {
      setCurrentPage(index);
      // Web has no pager to emit scroll events, so the tint has nothing driving
      // it — animate the position by hand to match the native feel.
      scrollPosition.value = withTiming(index, { duration: 220 });
    } else {
      pagerRef.current?.setPage(index);
    }
  }, [isWeb]);

  // Jump to a tab by key, for the cross-screen shortcuts (the home category
  // cards, the planner's suggestion chips).
  const navigateToTab = useCallback((key: TabKey) => {
    const index = tabs.findIndex((tab) => tab.key === key);
    if (index < 0) return;
    if (isWeb) {
      setCurrentPage(index);
      // Web has no pager to emit scroll events — animate the position by hand.
      scrollPosition.value = withTiming(index, { duration: 220 });
    } else {
      pagerRef.current?.setPage(index);
    }
  }, [isWeb]);

  const renderScreen = (key: TabKey) => {
    switch (key) {
      case "home":
        return <HomeScreenContent onNavigateToTab={navigateToTab} />;
      case "lodging":
        return <LodgingScreenContent />;
      case "planner":
        return <PlannerScreenContent onNavigateToTab={navigateToTab} />;
      case "favorites":
        return <FavoritesScreenContent />;
      case "settings":
        return <SettingsScreenContent />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Content area - PagerView on native, simple View on web */}
      {isWeb ? (
        <View style={styles.pagerView}>
          {renderScreen(tabs[currentPage].key)}
        </View>
      ) : AnimatedPagerView ? (
        <AnimatedPagerView
          ref={pagerRef}
          style={styles.pagerView}
          initialPage={HOME_INDEX}
          // react-native-pager-view types onPageScroll as a JS
          // DirectEventHandler; Reanimated's useEvent returns its own processed
          // handler that the native side understands but the prop type does
          // not describe. The cast is the documented way to connect the two.
          onPageScroll={
            pageScrollHandler as unknown as PagerViewProps["onPageScroll"]
          }
          onPageSelected={handlePageSelected}
          overdrag={true}
          overScrollMode="always"
        >
          {tabs.map((tab) => (
            <View key={tab.key} style={styles.page}>
              {renderScreen(tab.key)}
            </View>
          ))}
        </AnimatedPagerView>
      ) : (
        <View style={styles.pagerView}>
          {renderScreen(tabs[currentPage].key)}
        </View>
      )}

      {/* Content scrolls under the docked bar, so it dissolves into the page
          just above it rather than being cut off by the bar's edge. The bar is
          flush with the screen edge, so the fade sits on top of its full
          height plus the safe-area padding underneath it. */}
      <BottomBarFade bottom={TAB_BAR_HEIGHT + insets.bottom} />

      {/* Docked tab bar: flush with the bottom edge, full width, hairline top
          border. Screens reserve TAB_BAR_CLEARANCE + insets.bottom for it. */}
      <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
        {tabs.map((tab, index) => (
          <TabButton
            key={tab.key}
            icon={tab.icon}
            label={t(tab.labelKey)}
            isActive={currentPage === index}
            index={index}
            scrollPosition={scrollPosition}
            onPress={() => handleTabPress(index)}
          />
        ))}
      </View>
    </View>
  );
}

interface TabButtonProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  isActive: boolean;
  index: number;
  scrollPosition: SharedValue<number>;
  onPress: () => void;
}

function TabButton({
  icon,
  label,
  isActive,
  index,
  scrollPosition,
  onPress,
}: TabButtonProps) {
  const styles = useThemedStyles(makeStyles);
  const scale = useSharedValue(1);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Distance from this tab to the pager's live position: 0 while this page fills
  // the screen, 1 once a neighbour has fully taken over. Driving the tint from
  // this — rather than from the `currentPage` state, which only updates when the
  // pager settles — is what keeps the colour moving with the swipe instead of
  // snapping at the end of it. interpolateColor clamps, so overdrag past the
  // first or last page cannot push the value out of range.
  //
  // The lime puck and the ink icon read the SAME distance value, so they can
  // never disagree. Only the label's *weight* comes from `isActive`, because a
  // fontFamily cannot be interpolated; its colour animates with everything else.
  const tintStyle = useAnimatedStyle(() => {
    const distance = Math.min(Math.abs(scrollPosition.value - index), 1);
    return {
      color: interpolateColor(distance, [0, 1], [ACTIVE_TINT, INACTIVE_TINT]),
    };
  });

  const circleStyle = useAnimatedStyle(() => {
    const distance = Math.min(Math.abs(scrollPosition.value - index), 1);
    return {
      opacity: 1 - distance,
      transform: [{ scale: 0.7 + 0.3 * (1 - distance) }],
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <AnimatedPressable
      style={[styles.tabButton, pressStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="tab"
      accessibilityLabel={label}
    >
      <View style={styles.iconWrap}>
        <Animated.View pointerEvents="none" style={[styles.activeCircle, circleStyle]} />
        {/* No `color` prop: the animated style supplies it, and the prop would
            be a static value competing with the interpolation. */}
        <AnimatedFeather name={icon} size={ICON_SIZE} style={tintStyle} />
      </View>
      <Animated.Text
        numberOfLines={1}
        style={[
          styles.label,
          isActive ? styles.labelActive : styles.labelInactive,
          tintStyle,
        ]}
      >
        {label}
      </Animated.Text>
    </AnimatedPressable>
  );
}

// Module scope, passed the active font map by useThemedStyles — the labels have
// to render in Cairo while the app is in Arabic, which a plain module-level
// StyleSheet.create (evaluated once, at import) could never do.
const makeStyles = (fonts: AppFonts) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    pagerView: {
      flex: 1,
    },
    page: {
      flex: 1,
    },
    // Docked bar: full width, flush with the bottom edge, no radius. The
    // hairline top border is what separates it from the content scrolling
    // underneath; paddingBottom carries the home-indicator inset, so the
    // bar's own content is always TAB_BAR_HEIGHT tall.
    tabBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface.DEFAULT,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
    },
    // Five equal columns; height matches the bar's content height exactly, so
    // the icon/label pair is centred inside it above the safe-area padding.
    tabButton: {
      flex: 1,
      height: TAB_BAR_HEIGHT,
      alignItems: "center",
      justifyContent: "center",
    },
    iconWrap: {
      width: PUCK_SIZE,
      height: PUCK_SIZE,
      alignItems: "center",
      justifyContent: "center",
    },
    // The lime puck behind the active icon; opacity tracks the swipe.
    // Lime is a fill — the icon on it is ink, never white (1.39:1).
    activeCircle: {
      position: "absolute",
      width: PUCK_SIZE,
      height: PUCK_SIZE,
      borderRadius: 999,
      backgroundColor: colors.primary.DEFAULT,
    },
    label: {
      marginTop: ICON_LABEL_GAP,
      fontSize: LABEL_SIZE,
      lineHeight: LABEL_SIZE + 4,
      includeFontPadding: false,
      textAlign: "center",
    },
    labelActive: {
      fontFamily: fonts.semibold,
    },
    labelInactive: {
      fontFamily: fonts.medium,
    },
  });
