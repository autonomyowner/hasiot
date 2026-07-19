import React, { useRef, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import PagerView from "@/components/PagerViewWrapper";
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

interface TabItem {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
}

// 7 tabs, home centered. Labels surfaced in the floating glass bar (v5 redesign).
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

      {/* Floating glass tab bar (v5) */}
      <View style={[styles.tabBarContainer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 14 }]}>
        <View style={styles.tabBarPill}>
          {tabs.map((tab, index) => (
            <TabButton
              key={tab.key}
              icon={tab.icon}
              label={tab.label}
              isActive={currentPage === index}
              onPress={() => handleTabPress(index)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

interface TabButtonProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  isActive: boolean;
  onPress: () => void;
}

function TabButton({ icon, label, isActive, onPress }: TabButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const tint = isActive ? colors.primary.DEFAULT : "#A39D8E";

  return (
    <AnimatedPressable
      style={[styles.tabButton, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Feather name={icon} size={22} color={tint} />
      <Text
        style={[
          styles.tabLabel,
          { color: tint, fontFamily: isActive ? fonts.semibold : fonts.medium },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
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
  tabBarContainer: {
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tabBarPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 30,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "rgba(31,29,23,0.04)",
    shadowColor: "#1F1D17",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 16,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 2,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
});
