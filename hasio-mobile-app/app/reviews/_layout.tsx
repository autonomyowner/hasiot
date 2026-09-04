import { Stack } from "expo-router";

/**
 * Reviews are public, so unlike `bookings/` this layout gates nothing. It
 * exists because a directory under `app/` without one is flattened into the
 * root stack, which would leave `<Stack.Screen name="reviews" />` in the root
 * layout naming a route that does not exist.
 */
export default function ReviewsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FAF7F2" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="[listingId]" />
    </Stack>
  );
}
