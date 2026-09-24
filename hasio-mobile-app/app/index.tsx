import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { View, StyleSheet } from "react-native";
import { useAppStore } from "@/stores/appStore";

export default function Index() {
  const router = useRouter();
  const hasCompletedOnboarding = useAppStore(
    (state) => state.hasCompletedOnboarding
  );

  // Wait for the real hydration signal rather than a fixed delay — a slow read
  // from AsyncStorage used to route returning users back into onboarding.
  // Read lazily in case hydration finished before this screen mounted, which
  // is now the normal case: the root layout keeps the splash up until it has.
  const [hydrated, setHydrated] = useState(() =>
    useAppStore.persist.hasHydrated()
  );

  useEffect(() => {
    if (hydrated) return;
    const unsubscribe = useAppStore.persist.onFinishHydration(() =>
      setHydrated(true)
    );
    // Watchdog: never strand the user here if storage is wedged.
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

  // Just the splash's own colour. This screen is on for a frame or two while
  // the redirect lands, and the spinner it used to show flashed between the
  // splash and the first real screen.
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
});
