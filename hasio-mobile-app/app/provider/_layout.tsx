import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useLanguage } from "@/hooks/useLanguage";
import { colors } from "@/constants/colors";

export default function ProviderLayout() {
  const router = useRouter();
  const { isRTL } = useLanguage();
  const { user, isUserLoading } = useConvexUser();

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace("/auth");
    } else if (user.role !== "service_provider" && user.role !== "admin") {
      router.replace("/(tabs)");
    }
  }, [user, isUserLoading, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        // From the left in Arabic, with the iOS back swipe from the right
        // edge following the finger — see app/business/_layout.tsx.
        animation: isRTL ? "slide_from_left" : "slide_from_right",
        animationMatchesGesture: isRTL,
      }}
    >
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="verification" />
      <Stack.Screen name="post-service" />
      <Stack.Screen name="my-services" />
      {/* The booking inbox for the provider's services; a push about a
          request for one lands here (target "provider-inbox"). */}
      <Stack.Screen name="bookings" />
    </Stack>
  );
}
