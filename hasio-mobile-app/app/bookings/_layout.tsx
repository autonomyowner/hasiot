import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { useConvexUser } from "@/hooks/useConvexUser";

export default function BookingsLayout() {
  const router = useRouter();
  const { user, isUserLoading } = useConvexUser();

  // Every screen under here is about the signed-in guest's own bookings, so
  // there is nothing to render for a visitor.
  useEffect(() => {
    if (isUserLoading) return;
    if (!user) router.replace("/auth");
  }, [user, isUserLoading, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FAF7F2" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
