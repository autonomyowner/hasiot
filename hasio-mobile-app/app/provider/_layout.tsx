import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { useConvexUser } from "@/hooks/useConvexUser";

export default function ProviderLayout() {
  const router = useRouter();
  const { user, isUserLoading } = useConvexUser();

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace("/auth");
    } else if (user.role !== "service_provider" && user.role !== "admin") {
      router.replace("/(tabs)");
    }
  }, [user, isUserLoading]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FAF7F2" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="verification" />
      <Stack.Screen name="post-service" />
      <Stack.Screen name="my-services" />
    </Stack>
  );
}
