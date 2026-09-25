import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PermissionSnapshot } from "@/lib/pushDecision";

/** Whose wording the prompt uses: a traveller's, or a host's / provider's. */
export type PushContext = "guest" | "host";

/** An ask waiting for the screen to be clear (see components/PushPrompt.tsx). */
export interface PushPromptRequest {
  context: PushContext;
  /** Asked for from the Settings row: the seven-day rule does not apply. */
  manual: boolean;
  /** When it was asked for; an ask that waits too long is let go. */
  at: number;
}

interface PushState {
  /**
   * When the prompt was last shown, for the seven-day rule. Per device, not
   * per account: the system permission it leads to belongs to the phone.
   */
  lastAskedAt: number | null;
  /**
   * The Expo push token this phone last got. Kept across launches so signing
   * out can always remove it from the account, even when this session never
   * fetched it — otherwise the next person to pick up the phone would get the
   * last one's booking notices until someone else signed in on it.
   */
  lastToken: string | null;
  /** The system permission as last read. Not kept: the system can change it. */
  permission: PermissionSnapshot | null;
  /**
   * This binary turned out unable to receive push (no entitlement, no
   * Firebase, no Play services). Per launch: a new build may fix it.
   */
  unsupported: boolean;
  request: PushPromptRequest | null;

  /** A new automatic ask never replaces one already waiting; a manual one does. */
  requestPrompt: (context: PushContext, manual: boolean) => void;
  clearRequest: () => void;
  markAsked: (at: number) => void;
  setPermission: (permission: PermissionSnapshot) => void;
  setLastToken: (token: string) => void;
  markUnsupported: () => void;
}

export const usePushStore = create<PushState>()(
  persist(
    (set) => ({
      lastAskedAt: null,
      lastToken: null,
      permission: null,
      unsupported: false,
      request: null,

      requestPrompt: (context, manual) =>
        set((state) =>
          state.request && !manual ? state : { request: { context, manual, at: Date.now() } }
        ),
      clearRequest: () => set((state) => (state.request ? { request: null } : state)),
      markAsked: (at) => set({ lastAskedAt: at }),
      // Unchanged answers keep the old object, so the Settings row does not
      // re-render every time the app comes back to the foreground.
      setPermission: (permission) =>
        set((state) =>
          state.permission?.status === permission.status &&
          state.permission.canAskAgain === permission.canAskAgain
            ? state
            : { permission }
        ),
      setLastToken: (token) => set((state) => (state.lastToken === token ? state : { lastToken: token })),
      markUnsupported: () => set((state) => (state.unsupported ? state : { unsupported: true })),
    }),
    {
      name: "hasio-push",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ lastAskedAt: state.lastAskedAt, lastToken: state.lastToken }),
    }
  )
);

/**
 * Resolves once the stored fields are back, or after a short wait: a slow
 * storage read must not hold an ask up for ever, and asking once too early is
 * the lesser harm.
 */
export function pushStoreHydrated(timeoutMs = 2000): Promise<void> {
  if (usePushStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    // Only ever called after both lines below have run: by the listener or
    // by the timer, never synchronously.
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve();
    };
    const unsubscribe = usePushStore.persist.onFinishHydration(finish);
    const timer = setTimeout(finish, timeoutMs);
  });
}
