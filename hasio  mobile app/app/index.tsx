import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAppStore } from "@/stores/appStore";

export default function Index() {
  const router = useRouter();
  const hasNavigated = useRef(false);
  const hasCompletedOnboarding = useAppStore(
    (state) => state.hasCompletedOnboarding
  );

  useEffect(() => {
    // Wait for Zustand to hydrate from AsyncStorage.
    // The persist middleware triggers a state update once hydration is done,
    // so we use a short delay to let the first hydration event fire.
    const timer = setTimeout(() => {
      if (hasNavigated.current) return;
      hasNavigated.current = true;

      if (hasCompletedOnboarding) {
        router.replace("/(tabs)");
      } else {
        router.replace("/onboarding");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [hasCompletedOnboarding]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0D7A5F" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAF7F2",
  },
});
