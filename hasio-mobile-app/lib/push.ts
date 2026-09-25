import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { DevicePushToken } from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { api } from "@/backend";
import { convex } from "@/lib/convex";
import { translations } from "@/constants/translations";
import { useAppStore } from "@/stores/appStore";
import { usePushStore } from "@/stores/pushStore";
import {
  isPushUnsupportedError,
  permissionGranted,
  pushAvailableFor,
  snapshotOf,
  type PermissionSnapshot,
} from "./pushDecision";

/**
 * Push notifications, as the rest of the app sees them.
 *
 * Every call here is safe to make from anywhere and never throws into the UI:
 * push is how a notice reaches someone who is not looking at the app, and the
 * in-app inbox (app/notifications.tsx) holds every notice whether or not it
 * arrives. A failure is logged once per kind (`warnOnce`) and the app carries
 * on — a phone offline at launch retries the next time it comes back.
 *
 * The decisions themselves are pure and tested in lib/pushDecision.ts; this
 * file only talks to expo-notifications, the server and the stores.
 */

/**
 * The Android channel every notice is posted to. The server names it in every
 * message (convex/notifications/deliver.ts: `channelId: "default"`), and the
 * app config makes it the Firebase default, so a notice that arrives while the
 * app is closed lands here too.
 */
export const PUSH_CHANNEL_ID = "default";

// A device token is usually back within a second, but on a phone with no
// network iOS may never answer at all.
const DEVICE_TOKEN_TIMEOUT_MS = 15_000;
// Expo's token is a round trip to Expo's servers.
const EXPO_TOKEN_TIMEOUT_MS = 15_000;
const REGISTER_TIMEOUT_MS = 10_000;
// Signing out waits for this, so it is short: a sign-out never hangs on push.
const UNREGISTER_TIMEOUT_MS = 4_000;

const warned = new Set<string>();

function warnOnce(what: string, error: unknown): void {
  if (warned.has(what)) return;
  warned.add(what);
  const detail = error instanceof Error ? error.message : error;
  console.warn(`[push] ${what}`, detail ?? "");
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Whether this build, on this phone, can receive a push at all — a physical
 * device whose build carries the push flag for its platform (`extra.push`,
 * set by app.config.js), and whose attempt to get a device token has not
 * already shown otherwise.
 *
 * Where it is false, nothing asks for permission, nothing registers, and the
 * Settings row is hidden: asking "Get booking updates?" on a build that can
 * never receive one would be a promise the app cannot keep.
 */
export function isPushAvailable(): boolean {
  if (usePushStore.getState().unsupported) return false;
  return pushAvailableFor({
    os: Platform.OS,
    isDevice: Device.isDevice,
    flags: Constants.expoConfig?.extra?.push,
  });
}

/**
 * Show notices while the app is open — as a banner, in the list, with sound.
 * Without a handler expo-notifications drops a notice that arrives in the
 * foreground, so a host looking at the app would never see the request come
 * in. Called once, at module scope in the root layout.
 */
export function showNotificationsInForeground(): void {
  if (Platform.OS === "web") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

let channelLanguage: string | null = null;

/**
 * The high-importance channel the server posts to, named in the app's
 * language ("Bookings" / «الحجوزات») in the phone's notification settings.
 *
 * It has to exist before any token is asked for or any permission requested:
 * Android 13 shows its permission prompt only once the app has a channel, and
 * a notice posted to a channel that does not exist falls back to a silent
 * default one. Created with the default sound — Android fixes a channel's
 * importance and sound when it is first created, so this is the one chance to
 * get them right. Renaming it later, when the language changes, is allowed.
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android" || !isPushAvailable()) return;
  const language = useAppStore.getState().language;
  if (channelLanguage === language) return;
  try {
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
      name: translations[language].pushChannelName,
      importance: Notifications.AndroidImportance.HIGH,
    });
    channelLanguage = language;
  } catch (error) {
    warnOnce("could not create the notification channel", error);
  }
}

/** Reads the system permission and keeps it in the store; null where there is none to read. */
export async function refreshPushPermission(): Promise<PermissionSnapshot | null> {
  if (Platform.OS === "web") return null;
  try {
    const permission = snapshotOf(await Notifications.getPermissionsAsync());
    usePushStore.getState().setPermission(permission);
    return permission;
  } catch (error) {
    warnOnce("could not read the notification permission", error);
    return null;
  }
}

/** Shows the system's own permission prompt. Only ever after the app's explanation. */
export async function requestPushPermission(): Promise<PermissionSnapshot | null> {
  if (!isPushAvailable()) return null;
  await ensureAndroidChannel();
  try {
    const permission = snapshotOf(
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      })
    );
    usePushStore.getState().setPermission(permission);
    return permission;
  } catch (error) {
    warnOnce("could not request the notification permission", error);
    return null;
  }
}

let knownDeviceToken: DevicePushToken | null = null;
let deviceTokenInFlight: Promise<DevicePushToken | null> | null = null;

/**
 * The APNs or FCM token, fetched once per launch.
 *
 * One request at a time: on iOS a second `getDevicePushTokenAsync` while the
 * first is waiting rejects the first ("A newer async call … was started"), so
 * the Settings row, the ask and the registration all share this one.
 *
 * It needs no permission — iOS registers for remote notifications whether or
 * not the person has allowed alerts, and so does Firebase — which is what
 * makes it the honest test of whether this binary can receive push at all. A
 * build without the aps-environment entitlement or without Firebase fails it
 * straight away, and is marked unsupported for the rest of the launch. That
 * catches the case the build flags cannot: an over-the-air update carries its
 * own copy of the app config, evaluated where the update was published, not
 * where the binary was built.
 */
function deviceToken(): Promise<DevicePushToken | null> {
  if (knownDeviceToken) return Promise.resolve(knownDeviceToken);
  if (!deviceTokenInFlight) {
    deviceTokenInFlight = fetchDeviceToken().finally(() => {
      deviceTokenInFlight = null;
    });
  }
  return deviceTokenInFlight;
}

async function fetchDeviceToken(): Promise<DevicePushToken | null> {
  try {
    const token = await withTimeout(Notifications.getDevicePushTokenAsync(), DEVICE_TOKEN_TIMEOUT_MS);
    knownDeviceToken = token;
    return token;
  } catch (error) {
    if (isPushUnsupportedError(error)) {
      usePushStore.getState().markUnsupported();
      warnOnce("this build cannot receive push notifications", error);
    } else {
      warnOnce("could not get the device push token", error);
    }
    return null;
  }
}

/**
 * Whether push really works here, checked against the device token before the
 * app asks anyone to allow it. A token that is merely late (no network) is
 * not held against the build.
 */
export async function confirmPushSupported(): Promise<boolean> {
  if (!isPushAvailable()) return false;
  await deviceToken();
  return isPushAvailable();
}

function easProjectId(): string | null {
  const id: unknown =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

let expoTokenFor: { device: string; expo: string } | null = null;

/**
 * This phone's Expo push token, or null where there is none to have: push
 * unavailable, permission not granted, or a failure (logged). Reused for as
 * long as the device token is unchanged, so coming back to the app does not
 * cost a round trip to Expo each time.
 */
export async function getPushTokenAsync(): Promise<string | null> {
  if (!isPushAvailable()) return null;
  const permission = await refreshPushPermission();
  if (!permission || !permissionGranted(permission)) return null;
  await ensureAndroidChannel();

  const device = await deviceToken();
  if (!device || typeof device.data !== "string") return null;
  if (expoTokenFor?.device === device.data) return expoTokenFor.expo;

  const projectId = easProjectId();
  if (!projectId) {
    warnOnce("the app config has no EAS project id", null);
    return null;
  }
  try {
    const { data } = await withTimeout(
      Notifications.getExpoPushTokenAsync({ projectId, devicePushToken: device }),
      EXPO_TOKEN_TIMEOUT_MS
    );
    expoTokenFor = { device: device.data, expo: data };
    usePushStore.getState().setLastToken(data);
    return data;
  } catch (error) {
    warnOnce("could not get an Expo push token", error);
    return null;
  }
}

// Account and token pairs registered in this launch, so coming back to the
// app does not re-send what the server already has.
const registered = new Set<string>();

/**
 * Tell the server this phone receives the signed-in account's notices, once
 * push is allowed. Safe to call on every sign-in and every return to the app:
 * it does nothing until permission is granted, and nothing twice. The server
 * moves a token that belonged to someone else to this account, so a shared
 * phone follows whoever is signed in.
 */
export async function syncPushRegistration(userId: string): Promise<void> {
  const token = await getPushTokenAsync();
  if (!token) return;
  const key = `${userId}|${token}`;
  if (registered.has(key)) return;
  // Claimed before the call, so two quick returns to the app send it once.
  registered.add(key);
  try {
    await withTimeout(
      convex.mutation(api.users.push.registerPushToken, {
        token,
        platform: Platform.OS === "ios" ? "ios" : "android",
      }),
      REGISTER_TIMEOUT_MS
    );
  } catch (error) {
    // Let the next return to the app try again.
    registered.delete(key);
    warnOnce("could not register this phone for notifications", error);
  }
}

/**
 * Stop this phone receiving the signed-in account's notices. Call it while the
 * session still exists — on sign-out and before deleting the account — because
 * the server only removes a token its caller owns. Never throws, and gives up
 * after a few seconds rather than hold a sign-out.
 */
export async function forgetThisDeviceForPush(): Promise<void> {
  registered.clear();
  const token = usePushStore.getState().lastToken;
  if (!token || Platform.OS === "web") return;
  try {
    await withTimeout(
      convex.mutation(api.users.push.unregisterPushToken, { token }),
      UNREGISTER_TIMEOUT_MS
    );
  } catch (error) {
    warnOnce("could not unregister this phone from notifications", error);
  }
}
