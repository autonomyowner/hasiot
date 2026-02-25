import { Stack } from "expo-router";

export default function BusinessLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FAF7F2" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="post-lodging" />
      <Stack.Screen name="post-food" />
      <Stack.Screen name="post-event" />
      <Stack.Screen name="post-destination" />
      <Stack.Screen name="my-listings" />
    </Stack>
  );
}
