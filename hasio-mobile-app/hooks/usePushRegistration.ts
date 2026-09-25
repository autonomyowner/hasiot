import { useEffect } from "react";
import { AppState } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@/backend";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useLanguage } from "@/hooks/useLanguage";
import { signOut as authSignOut } from "@/lib/auth";
import {
  confirmPushSupported,
  ensureAndroidChannel,
  forgetThisDeviceForPush,
  isPushAvailable,
  refreshPushPermission,
  syncPushRegistration,
} from "@/lib/push";
import { pushRowState, type PushRowState } from "@/lib/pushDecision";
import { usePushStore } from "@/stores/pushStore";

/**
 * Keeps this phone registered for the signed-in account's push notices.
 * Mounted once, in the root layout.
 *
 * - Registers once someone is signed in and permission has been granted, and
 *   checks again each time the app comes back to the foreground: the person
 *   may have turned notifications on in the phone's settings meanwhile. It
 *   never asks for permission itself (lib/pushPrompt.ts does, in context).
 * - Keeps the Android channel's name in the app's language.
 * - Keeps the account's language on the server in step with the app's. Push
 *   and email are written in `users.preferredLanguage`, which every account is
 *   created with as Arabic and which the app never used to set — so an
 *   English-speaking guest's "Booking confirmed" would have arrived in Arabic.
 *
 * Where push cannot arrive (web, a simulator, a build without push) the
 * registration and the channel do nothing; the language is still kept, for
 * email.
 */
export function usePushRegistration(): void {
  const { user, userId } = useConvexUser();
  const { language } = useLanguage();
  const updateProfile = useMutation(api.users.mutations.updateProfile);
  const unsupported = usePushStore((state) => state.unsupported);

  useEffect(() => {
    if (!userId || unsupported || !isPushAvailable()) return;
    void syncPushRegistration(userId);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncPushRegistration(userId);
    });
    return () => subscription.remove();
  }, [userId, unsupported]);

  useEffect(() => {
    void ensureAndroidChannel();
  }, [language]);

  const serverLanguage = user?.preferredLanguage;
  useEffect(() => {
    if (!userId || serverLanguage === language) return;
    updateProfile({ preferredLanguage: language }).catch((error: unknown) => {
      console.warn("[push] could not save the account's language", error);
    });
  }, [userId, serverLanguage, language, updateProfile]);
}

/**
 * Sign out, having first taken this phone off the account's push list — while
 * the session still exists, because the server removes only a token its
 * caller owns. Throws only what the sign-out itself throws.
 */
export async function signOutWithPush(): Promise<void> {
  await forgetThisDeviceForPush();
  await authSignOut();
}

/**
 * What the Settings "Push notifications" row needs: whether to show it at all
 * (not on a build or device that cannot receive push), and what it says.
 * `state` is null until the permission has been read. Re-read whenever the
 * app comes back to the foreground, since the switch that changes it lives
 * in the phone's settings.
 */
export function usePushSettingsRow(): { available: boolean; state: PushRowState | null } {
  const unsupported = usePushStore((state) => state.unsupported);
  const permission = usePushStore((state) => state.permission);
  const available = !unsupported && isPushAvailable();

  useEffect(() => {
    if (!available) return;
    void refreshPushPermission();
    // Hides the row now, rather than on its first tap, on a binary that
    // turns out unable to get a token (see confirmPushSupported).
    void confirmPushSupported();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshPushPermission();
    });
    return () => subscription.remove();
  }, [available]);

  return { available, state: permission ? pushRowState(permission) : null };
}
