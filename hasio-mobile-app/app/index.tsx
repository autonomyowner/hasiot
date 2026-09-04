import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAppStore } from "@/stores/appStore";

export default function Index() {
  const router = useRouter();
  const hasCompletedOnboarding = useAppStore(
    (state) => state.hasCompletedOnboarding
  );

  // Wait for the real hydration signal rather than a fixed delay — a slow read
  // from AsyncStorage used to route returning users back into onboarding.
  // Read lazily in case hydration finished before this screen mounted.
  const [hydrated, setHydrated] = useState(() =>
    useAppStore.persist.hasHydrated()
  );

  useEffect(() => {
    if (hydrated) return;
    const unsubscribe = useAppStore.persist.onFinishHydration(() =>
      setHydrated(true)
    );
    // Watchdog: never strand the user on a spinner if storage is wedged.
    const watchdog = setTimeout(() => setHydrated(true), 3000);
    return () => {
      unsubscribe();
      clearTimeout(watchdog);
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    router.replace(hasCompletedOnboarding ? "/(tabs)" : "/onboarding");
  }, [hydrated, hasCompletedOnboarding, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#CCE745" />
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
