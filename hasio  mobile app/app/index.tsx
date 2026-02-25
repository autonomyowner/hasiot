import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAppStore } from "@/stores/appStore";

export default function Index() {
  const router = useRouter();
  const hasCompletedOnboarding = useAppStore(
    (state) => state.hasCompletedOnboarding
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasCompletedOnboarding) {
        router.replace("/(tabs)");
      } else {
        router.replace("/onboarding");
      }
    }, 300);

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
