import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { InstrumentSerif_400Regular } from "@expo-google-fonts/instrument-serif";
import {
  Outfit_300Light,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit";
// Per-weight subpaths, not the package root. The root index re-exports all
// eight weights with a require() each, so importing from it makes Metro bundle
// every one — 753 kB for the five actually registered below. This is the
// import style the package's own README documents.
import { Cairo_300Light } from "@expo-google-fonts/cairo/300Light";
import { Cairo_400Regular } from "@expo-google-fonts/cairo/400Regular";
import { Cairo_500Medium } from "@expo-google-fonts/cairo/500Medium";
import { Cairo_600SemiBold } from "@expo-google-fonts/cairo/600SemiBold";
import { Cairo_700Bold } from "@expo-google-fonts/cairo/700Bold";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConvexProviderWithAuth } from "convex/react";
import { convex, useAuthFromSecureStore } from "@/lib/convex";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppDialogHost } from "@/components/ui/AppDialog";

import "../global.css";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

function InnerLayout() {
  // Both families load up front rather than on demand: the language toggle is
  // instant, and expo-font caches by family name, so a font fetched only when
  // Arabic is first selected would leave a frame of system-font text behind it.
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSerif_400Regular,
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Cairo_300Light,
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });

  // Fall through on error too — a failed font download must not leave the
  // splash screen up forever. System fonts are an acceptable fallback.
  const fontsReady = fontsLoaded || !!fontError;

  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsReady]);

  if (!fontsReady) {
    return null;
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#FAF7F2" },
          animation: "fade",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="business" />
        <Stack.Screen name="provider" />
        <Stack.Screen name="blocked-accounts" />
      </Stack>
      <StatusBar style="dark" />
      {/* Branded alert dialog (appAlert). Native Modals that fire alerts while
          open mount their own AppDialogHost inside the modal. */}
      <AppDialogHost />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ConvexProviderWithAuth client={convex} useAuth={useAuthFromSecureStore}>
          <InnerLayout />
        </ConvexProviderWithAuth>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
