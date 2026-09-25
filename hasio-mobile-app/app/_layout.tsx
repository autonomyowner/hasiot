import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
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
import { PushPrompt } from "@/components/PushPrompt";
import { AppDialogHost } from "@/components/ui/AppDialog";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useLanguage } from "@/hooks/useLanguage";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import { notificationDataOf, routeForNotification } from "@/lib/notificationRoute";
import { showNotificationsInForeground } from "@/lib/push";
import { useAppStore } from "@/stores/appStore";

import "../global.css";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// A notice that arrives while the app is open shows as a banner, with sound.
// Without a handler expo-notifications drops it, and a host looking at the
// app would never see a request come in.
showNotificationsInForeground();

/**
 * Taps on push notices, routed like the inbox's rows (lib/notificationRoute.ts).
 *
 * A tap that launched the app is read once, when this mounts; taps while it
 * runs arrive through the listener. Routing waits for two things:
 * - the launch redirect. The bare index screen (no segments) only sends the
 *   app on to the tabs or onboarding with `replace`, and a screen pushed
 *   before that lands would be replaced by it;
 * - the account's role, which decides where a verification notice goes.
 *
 * Each tap is handled once (by its notification's id), and the saved launch
 * tap is cleared so a remount cannot route it again. With nowhere specific to
 * go, the inbox holds the notice.
 */
function useNotificationTaps() {
  const router = useRouter();
  const segments = useSegments();
  const { user, isUserLoading } = useConvexUser();
  const [tapped, setTapped] = useState<Notifications.NotificationResponse | null>(() =>
    Platform.OS === "web" ? null : Notifications.getLastNotificationResponse()
  );
  const handled = useRef(new Set<string>());

  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = Notifications.addNotificationResponseReceivedListener(setTapped);
    return () => subscription.remove();
  }, []);

  const launchRedirectDone = segments.length > 0;
  const role = user?.role;

  useEffect(() => {
    if (!tapped || !launchRedirectDone || isUserLoading) return;
    if (tapped.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = tapped.notification.request.identifier;
    if (handled.current.has(id)) return;
    handled.current.add(id);
    Notifications.clearLastNotificationResponse();
    const data = notificationDataOf(tapped.notification.request.content.data);
    const route = routeForNotification(data, role) ?? "/notifications";
    router.push(route as never);
  }, [tapped, launchRedirectDone, isUserLoading, role, router]);
}

/** Registration, the Android channel and taps. Renders nothing. */
function PushWiring() {
  usePushRegistration();
  useNotificationTaps();
  return null;
}

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
  // on the right. There the iOS back swipe only follows the finger with
  // `animationMatchesGesture`; without it the custom animation pops the screen
  // at once, sliding it away from the finger. Same pairing as every nested
  // stack's layout.
  const push = {
    animation: isRTL ? "slide_from_left" : "slide_from_right",
    animationMatchesGesture: isRTL,
  } as const;

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
        <Stack.Screen name="business" options={push} />
        <Stack.Screen name="provider" options={push} />
        <Stack.Screen name="blocked-accounts" options={push} />
        <Stack.Screen name="bookings" options={push} />
        <Stack.Screen name="notifications" options={push} />
        <Stack.Screen name="reviews" options={push} />
      </Stack>
      <StatusBar style="dark" />
      {/* Branded alert dialog (appAlert). Native Modals that fire alerts while
          open mount their own AppDialogHost inside the modal. */}
      <AppDialogHost />
      {/* "Get booking updates?" — asked for through maybeAskForPush, shown
          only once nothing else is on screen (components/PushPrompt.tsx). */}
      <PushPrompt />
      <PushWiring />
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
