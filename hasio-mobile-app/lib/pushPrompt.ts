import { confirmPushSupported, isPushAvailable, refreshPushPermission } from "./push";
import { shouldOfferPush } from "./pushDecision";
import { pushStoreHydrated, usePushStore } from "@/stores/pushStore";

/**
 * Ask for push permission at a moment the person can see why (design D14).
 *
 * `"guest"` after a traveller sends a booking request, once the confirmation
 * has closed; `"host"` when a host or provider opens their inbox or dashboard.
 * Never at first launch: a prompt with no reason in front of it gets a "no",
 * and on iOS a "no" is final.
 *
 * Fire and forget, callable from anywhere — a handler, an effect, a store —
 * because it only decides. It returns at once where push cannot arrive (web,
 * a simulator, a build without push), then checks the system permission
 * (neither granted nor refused for good) and the seven-day rule, and hands the
 * ask to the one `PushPrompt` in the root layout. That sheet shows the app's
 * explanation first and the system's prompt only on "Turn on"; it also waits
 * until no other sheet is on screen, so a caller may ask while its own sheet
 * is still closing. Signed in is checked there, where the session can be read.
 */
export function maybeAskForPush(context: "guest" | "host"): void {
  if (!isPushAvailable()) return;
  void askWhenDue(context).catch((error: unknown) => {
    console.warn("[push] could not decide whether to ask", error);
  });
}

/**
 * The Settings row: the person asked, so the seven-day rule does not apply.
 * The prompt still checks the permission before it shows.
 */
export function askForPushNow(context: "guest" | "host"): void {
  if (!isPushAvailable()) return;
  usePushStore.getState().requestPrompt(context, true);
}

async function askWhenDue(context: "guest" | "host"): Promise<void> {
  await pushStoreHydrated();
  if (usePushStore.getState().request) return;

  const permission = await refreshPushPermission();
  if (!permission) return;
  const { lastAskedAt } = usePushStore.getState();
  const due = shouldOfferPush({
    available: isPushAvailable(),
    signedIn: true,
    permission,
    lastAskedAt,
    now: Date.now(),
  });
  if (!due) return;

  // The build flags say push can arrive; the device token says whether it
  // really can, before anyone is asked to allow it (see confirmPushSupported).
  if (!(await confirmPushSupported())) return;

  usePushStore.getState().requestPrompt(context, false);
}
