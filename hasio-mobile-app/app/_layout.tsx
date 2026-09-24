import { useEffect, useState } from "react";
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
import { useLanguage } from "@/hooks/useLanguage";
import { useAppStore } from "@/stores/appStore";

import "../global.css";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

/**
 * True once the persisted settings (language, onboarding, currency) are back.
 *
 * The splash waits for this as well as for the fonts. It used to lift as soon
 * as the fonts were in, and the index route then showed a spinner while the
 * settings loaded — splash, spinner, fade, entrance — and an Arabic user saw
 * the first frame in English until their language arrived. A watchdog keeps a
 * wedged storage read from holding the splash up forever.
 */
function useSettingsHydrated() {
  const [hydrated, setHydrated] = useState(() => useAppStore.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    const unsubscribe = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    const watchdog = setTimeout(() => setHydrated(true), 3000);
    return () => {
      unsubscribe();
      clearTimeout(watchdog);
    };
  }, [hydrated]);
  return hydrated;
}

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
  const settingsReady = useSettingsHydrated();
  const ready = fontsReady && settingsReady;
  const { isRTL } = useLanguage();

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  // Screens you drill into from a tab slide in, as a pushed screen does
  // everywhere else; only the top-level hand-offs (launch, onboarding,
  // sign-in, the tabs themselves) cross-fade. Every root screen used to fade,
  // so opening My bookings dissolved in while the screens inside it slid.
  // From the left in Arabic, where the reading — and the Back button — starts
  // on the right.
  const push = isRTL ? "slide_from_left" : "slide_from_right";

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
        <Stack.Screen name="business" options={{ animation: push }} />
        <Stack.Screen name="provider" options={{ animation: push }} />
        <Stack.Screen name="blocked-accounts" options={{ animation: push }} />
        <Stack.Screen name="bookings" options={{ animation: push }} />
        <Stack.Screen name="notifications" options={{ animation: push }} />
        <Stack.Screen name="reviews" options={{ animation: push }} />
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
