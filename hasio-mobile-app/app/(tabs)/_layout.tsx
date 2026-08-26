import React, { useRef, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
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
import { colors, fonts } from "@/constants/colors";

// Import screen content components
import {
  HomeScreenContent,
  LodgingScreenContent,
  FoodScreenContent,
  EventsScreenContent,
  PlannerScreenContent,
  MomentsScreenContent,
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

const ACTIVE_TINT = colors.primary.DEFAULT;
const INACTIVE_TINT = "#A39D8E";

// Devices without a home indicator (iPhone SE, most Androids) report a bottom
// inset of 0. A bar sitting flush on the screen edge still needs breathing room
// there, so the inset is a floor, not the whole story. On a notched iPhone the
// full 34pt inset is used, which puts total bar height at ~83pt — the same as a
// UIKit tab bar, so the home indicator never overlaps a tap target.
const MIN_BAR_BOTTOM_PADDING = 10;

interface TabItem {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
}

// 7 tabs, home centered. Labels surfaced under each icon in the docked bar.
const tabs: TabItem[] = [
  { key: "lodging", icon: "map-pin", label: "Stay" },
  { key: "food", icon: "coffee", label: "Eat" },
  { key: "events", icon: "calendar", label: "Events" },
  { key: "home", icon: "home", label: "Home" },
  { key: "planner", icon: "message-circle", label: "Plan" },
  { key: "moments", icon: "camera", label: "Moments" },
  { key: "settings", icon: "user", label: "Profile" },
];

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<any>(null);
  const [currentPage, setCurrentPage] = React.useState(3); // Start at home (center)
  const scrollPosition = useSharedValue(3);
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

  // Map old tab indices to new for navigation
  const handleNavigateToTabIndex = useCallback((oldIndex: number) => {
    // Old order: home(0), lodging(1), food(2), events(3), planner(4), moments(5), settings(6)
    // New order: lodging(0), food(1), events(2), home(3), planner(4), moments(5), settings(6)
    const indexMap: Record<number, number> = {
      0: 3, // home -> index 3
      1: 0, // lodging -> index 0
      2: 1, // food -> index 1
      3: 2, // events -> index 2
      4: 4, // planner -> index 4
      5: 5, // moments -> index 5
      6: 6, // settings -> index 6
    };
    const newIndex = indexMap[oldIndex] ?? oldIndex;
    if (isWeb) {
      setCurrentPage(newIndex);
      scrollPosition.value = withTiming(newIndex, { duration: 220 });
    } else {
      pagerRef.current?.setPage(newIndex);
    }
  }, [isWeb]);

  const renderScreen = (key: string) => {
    switch (key) {
      case "home":
        return <HomeScreenContent onNavigateToTab={handleNavigateToTabIndex} />;
      case "lodging":
        return <LodgingScreenContent />;
      case "food":
        return <FoodScreenContent />;
      case "events":
        return <EventsScreenContent />;
      case "planner":
        return <PlannerScreenContent onNavigateToTab={handleNavigateToTabIndex} />;
      case "moments":
        return <MomentsScreenContent />;
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
          initialPage={3}
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

      {/* Docked tab bar: anchored to the bottom edge, full-bleed, with the safe
          area painted in the bar's own colour so nothing shows through under it. */}
      <View
        style={[
          styles.tabBar,
          { paddingBottom: Math.max(insets.bottom, MIN_BAR_BOTTOM_PADDING) },
        ]}
      >
        {tabs.map((tab, index) => (
          <TabButton
            key={tab.key}
            icon={tab.icon}
            label={tab.label}
            index={index}
            scrollPosition={scrollPosition}
            isActive={currentPage === index}
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
  index: number;
  scrollPosition: SharedValue<number>;
  isActive: boolean;
  onPress: () => void;
}

function TabButton({
  icon,
  label,
  index,
  scrollPosition,
  isActive,
  onPress,
}: TabButtonProps) {
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
  const tintStyle = useAnimatedStyle(() => {
    const distance = Math.min(Math.abs(scrollPosition.value - index), 1);
    return {
      color: interpolateColor(distance, [0, 1], [ACTIVE_TINT, INACTIVE_TINT]),
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
    >
      {/* No `color` prop: the animated style supplies it, and the prop would be
          a static value competing with the interpolation. */}
      <AnimatedFeather name={icon} size={22} style={tintStyle} />
      <Animated.Text
        style={[
          styles.tabLabel,
          // Weight stays keyed to the settled page — there is no intermediate
          // font file to interpolate towards, so animating it would only add a
          // pop partway through the swipe.
          { fontFamily: isActive ? fonts.semibold : fonts.medium },
          tintStyle,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {label}
      </Animated.Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
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
  // Seven tabs have to fit across the narrowest phone we support, so the
  // horizontal padding here is deliberately tight. Opaque fill rather than a
  // translucent one: the bar is part of the layout, not a pane hovering over
  // scrolling content, so there is nothing behind it worth showing through.
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.surface.DEFAULT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 6,
    paddingHorizontal: 2,
  },
  // No fixed height: the row is sized by its tallest button, and the safe-area
  // padding is added underneath. minHeight keeps every tap target at the 44pt
  // iOS minimum even though the icon and label together are shorter than that.
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minHeight: 44,
    paddingVertical: 2,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0,
  },
});
