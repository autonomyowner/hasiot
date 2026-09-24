import { Stack } from "expo-router";
import { useLanguage } from "@/hooks/useLanguage";

/**
 * Reviews are public, so unlike `bookings/` this layout gates nothing. It
 * exists because a directory under `app/` without one is flattened into the
 * root stack, which would leave `<Stack.Screen name="reviews" />` in the root
 * layout naming a route that does not exist.
 */
export default function ReviewsLayout() {
  const { isRTL } = useLanguage();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FAF7F2" },
        // From the left in Arabic, with the iOS back swipe from the right edge
        // to match — the reasoning is in app/bookings/_layout.tsx.
        animation: isRTL ? "slide_from_left" : "slide_from_right",
        animationMatchesGesture: isRTL,
      }}
    >
      <Stack.Screen name="[listingId]" />
    </Stack>
  );
}
