import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useLanguage } from "@/hooks/useLanguage";
import { colors } from "@/constants/colors";

export default function BusinessLayout() {
  const router = useRouter();
  const { isRTL } = useLanguage();
  const { user, isUserLoading } = useConvexUser();

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      router.replace("/auth");
    } else if (user.role !== "business_owner" && user.role !== "admin") {
      router.replace("/(tabs)");
    }
  }, [user, isUserLoading, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        // In Arabic a screen comes in from the left and goes back out to it,
        // as a right-to-left reader expects; it slid in from the right in
        // both languages. (Layout is LTR natively — the app mirrors by
        // hand — so the platform will not do this on its own.)
        animation: isRTL ? "slide_from_left" : "slide_from_right",
        // And the iOS back swipe goes with it: from the right edge, following
        // the finger. Left out, iOS keeps its left-edge swipe, which with a
        // custom animation pops the screen at once, sliding it away from
        // the finger. Android's back gesture is unaffected.
        animationMatchesGesture: isRTL,
      }}
    >
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="verification" />
      <Stack.Screen name="post-lodging" />
      <Stack.Screen name="post-destination" />
      <Stack.Screen name="my-listings" />
      <Stack.Screen name="bookings" />
    </Stack>
  );
}
