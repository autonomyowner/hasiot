import React, { useRef, useCallback } from "react";
import { View, Pressable, StyleSheet, Dimensions, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolateColor,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import PagerView from "@/components/PagerViewWrapper";

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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface TabItem {
  key: string;
  icon: keyof typeof Feather.glyphMap;
}

// Reordered: 3 left, home center, 3 right
const tabs: TabItem[] = [
  { key: "lodging", icon: "map-pin" },
  { key: "food", icon: "coffee" },
  { key: "events", icon: "calendar" },
  { key: "home", icon: "home" },
  { key: "planner", icon: "message-circle" },
  { key: "moments", icon: "camera" },
  { key: "settings", icon: "settings" },
];

// Elevation offsets for arch effect (index 3 = home is highest, negative = up)
const elevationOffsets = [0, -4, -8, -14, -8, -4, 0];

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<any>(null);
  const [currentPage, setCurrentPage] = React.useState(3); // Start at home (center)
  const scrollPosition = useSharedValue(3);
  const isWeb = Platform.OS === "web";

  const handlePageScroll = useCallback((e: any) => {
    if (isWeb) return;
    const { position, offset } = e.nativeEvent;
    scrollPosition.value = position + offset;
  }, [isWeb]);

  const handlePageSelected = useCallback((e: any) => {
    if (isWeb) return;
    const position = e.nativeEvent.position;
    setCurrentPage(position);
  }, [isWeb]);

  const handleTabPress = useCallback((index: number) => {
    if (isWeb) {
      setCurrentPage(index);
      scrollPosition.value = index;
    } else {
      pagerRef.current?.setPage(index);
    }
  }, [isWeb]);

  const handleNavigateToTab = useCallback((tabKey: string) => {
    const index = tabs.findIndex(tab => tab.key === tabKey);
    if (index !== -1) {
      if (isWeb) {
        setCurrentPage(index);
        scrollPosition.value = index;
      } else {
        pagerRef.current?.setPage(index);
      }
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
      scrollPosition.value = newIndex;
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

  const tabWidth = (SCREEN_WIDTH - 32) / 7;

  return (
    <View style={styles.container}>
      {/* Content area - PagerView on native, simple View on web */}
      {isWeb ? (
        <View style={styles.pagerView}>
          {renderScreen(tabs[currentPage].key)}
        </View>
      ) : PagerView ? (
        <PagerView
          ref={pagerRef}
          style={styles.pagerView}
          initialPage={3}
          onPageScroll={handlePageScroll}
          onPageSelected={handlePageSelected}
          overdrag={true}
          overScrollMode="always"
        >
          {tabs.map((tab) => (
            <View key={tab.key} style={styles.page}>
              {renderScreen(tab.key)}
            </View>
          ))}
        </PagerView>
      ) : (
        <View style={styles.pagerView}>
          {renderScreen(tabs[currentPage].key)}
        </View>
      )}

      {/* Hierarchical Arch Tab Bar */}
      <View style={[styles.tabBarContainer, { paddingBottom: insets.bottom + 4 }]}>
        {/* Arch background curve */}
        <View style={styles.archBackground} />

        <View style={styles.tabBarContent}>
          {tabs.map((tab, index) => {
            const isActive = currentPage === index;
            const isHome = tab.key === "home";
            const elevation = elevationOffsets[index];

            return (
              <TabButton
                key={tab.key}
                icon={tab.icon}
                isActive={isActive}
                isHome={isHome}
                scrollPosition={scrollPosition}
                tabIndex={index}
                elevation={elevation}
                tabWidth={tabWidth}
                onPress={() => handleTabPress(index)}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

interface TabButtonProps {
  icon: keyof typeof Feather.glyphMap;
  isActive: boolean;
  isHome: boolean;
  scrollPosition: Animated.SharedValue<number>;
  tabIndex: number;
  elevation: number;
  tabWidth: number;
  onPress: () => void;
}

function TabButton({
  icon,
  isActive,
  isHome,
  scrollPosition,
  tabIndex,
  elevation,
  tabWidth,
  onPress
}: TabButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: elevation },
    ],
  }));

  // Animate based on scroll position
  const containerStyle = useAnimatedStyle(() => {
    'worklet';
    const distance = Math.abs(scrollPosition.value - tabIndex);
    const progress = Math.max(0, Math.min(1, 1 - distance));

    const backgroundColor = interpolateColor(
      progress,
      [0, 1],
      isHome ? ["rgba(13, 122, 95, 0.1)", "rgba(13, 122, 95, 0.25)"] : ["transparent", "rgba(13, 122, 95, 0.12)"]
    );

    return {
      backgroundColor,
    };
  });

  const dotStyle = useAnimatedStyle(() => {
    'worklet';
    const distance = Math.abs(scrollPosition.value - tabIndex);
    const progress = Math.max(0, Math.min(1, 1 - distance));

    return {
      opacity: progress,
      transform: [{ scale: progress }],
    };
  });

  const iconOpacity = useAnimatedStyle(() => {
    'worklet';
    const distance = Math.abs(scrollPosition.value - tabIndex);
    const progress = Math.max(0, Math.min(1, 1 - distance));

    return {
      opacity: 0.5 + (progress * 0.5),
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <AnimatedPressable
      style={[
        styles.tabButton,
        isHome && styles.homeTabButton,
        { width: tabWidth },
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[
        styles.tabButtonInner,
        isHome && styles.homeTabButtonInner,
        containerStyle,
      ]}>
        <Animated.View style={iconOpacity}>
          <Feather
            name={icon}
            size={isHome ? 22 : 18}
            color={isActive ? "#0D7A5F" : "#737373"}
          />
        </Animated.View>
        <Animated.View style={[styles.activeDot, dotStyle]} />
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
  pagerView: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  tabBarContainer: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E8E5E0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 8,
    paddingTop: 16,
    position: "relative",
  },
  archBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 20,
    backgroundColor: "#FFFFFF",
  },
  tabBarContent: {
    flexDirection: "row",
    paddingHorizontal: 16,
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  homeTabButton: {
    zIndex: 10,
  },
  tabButtonInner: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: "center",
    minHeight: 36,
    justifyContent: "center",
  },
  homeTabButtonInner: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    minHeight: 42,
    borderWidth: 2,
    borderColor: "rgba(13, 122, 95, 0.2)",
  },
  activeDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#0D7A5F",
    marginTop: 3,
  },
});
