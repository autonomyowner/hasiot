import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useLanguage } from "@/hooks/useLanguage";

export default function BookingsLayout() {
  const router = useRouter();
  const { user, isUserLoading } = useConvexUser();
  const { isRTL } = useLanguage();

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
        // In Arabic a booking opens from the left — the way the page reads
        // on to — where it used to push in from the right as in English. On
        // iOS `slide_from_left` is react-native-screens' own transition, and
        // the back swipe only follows it with `animationMatchesGesture`: it
        // then starts at the right edge and slides the screen back out to the
        // left. Without it the swipe stayed the system's, from the left edge,
        // throwing the screen off to the right it never came from.
        animation: isRTL ? "slide_from_left" : "slide_from_right",
        animationMatchesGesture: isRTL,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
