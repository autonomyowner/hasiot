import { Stack } from "expo-router";

export default function ProviderLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FAF7F2" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="post-service" />
      <Stack.Screen name="my-services" />
    </Stack>
  );
}
