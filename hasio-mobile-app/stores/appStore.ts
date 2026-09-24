import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Language, ChatMessage } from "@/types";
import type { Currency } from "@/lib/currency";
import { messagesToStore, settleRestoredChat } from "@/lib/plannerChat";

interface AppState {
  // Language
  language: Language;
  setLanguage: (lang: Language) => void;

  // Display currency. Prices are stored in SAR; this only changes what is shown.
  currency: Currency;
  setCurrency: (currency: Currency) => void;

  // Onboarding
  hasCompletedOnboarding: boolean;
  setOnboardingComplete: (complete: boolean) => void;

  // Favorites — a signed-out guest's only. A signed-in account's live on the
  // server; these are merged into it at sign-in and then cleared.
  favorites: string[];
  addFavorite: (id: string) => void;
  removeFavorite: (id: string) => void;
  clearFavorites: () => void;
  isFavorite: (id: string) => boolean;

  // Planner chat. Kept on the device (the newest ~40 messages) so a plan
  // survives a restart; see `lib/plannerChat.ts` for what is kept.
  chatMessages: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  /** Flag a guest turn as unanswered, or clear the flag on a retry. */
  setChatMessageFailed: (id: string, failed: boolean) => void;
  /** Drop unanswered turns — a new message supersedes them. */
  removeFailedChatMessages: () => void;
  clearChatMessages: () => void;

  // Notifications
  notificationsEnabled: boolean;
  toggleNotifications: () => void;

  // Anonymous session id — rate-limit key for the AI planner when signed out
  sessionId: string | null;
  ensureSessionId: () => string;

  // Clear all user data (sign-out and account deletion)
  clearUserData: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Language - default to English
      language: "en",
      setLanguage: (lang) => set({ language: lang }),

      // Display currency - default to riyals, the currency prices are stored in
      currency: "SAR",
      setCurrency: (currency) => set({ currency }),

      // Onboarding
      hasCompletedOnboarding: false,
      setOnboardingComplete: (complete) => set({ hasCompletedOnboarding: complete }),

      // Favorites
      favorites: [],
      addFavorite: (id) =>
        set((state) =>
          state.favorites.includes(id) ? state : { favorites: [...state.favorites, id] }
        ),
      removeFavorite: (id) =>
        set((state) => ({
          favorites: state.favorites.filter((fav) => fav !== id),
        })),
      clearFavorites: () => set({ favorites: [] }),
      isFavorite: (id) => get().favorites.includes(id),

      // Planner chat
      chatMessages: [],
      addChatMessage: (message) =>
        set((state) => ({
          chatMessages: [...state.chatMessages, message],
        })),
      setChatMessageFailed: (id, failed) =>
        set((state) => ({
          chatMessages: state.chatMessages.map((m) => {
            if (m.id !== id) return m;
            // Dropped rather than stored as `false`, so a retried turn is
            // stored exactly like one that never failed.
            const { failed: _previous, ...rest } = m;
            return failed ? { ...rest, failed: true } : rest;
          }),
        })),
      removeFailedChatMessages: () =>
        set((state) =>
          state.chatMessages.some((m) => m.failed)
            ? { chatMessages: state.chatMessages.filter((m) => !m.failed) }
            : state
        ),
      clearChatMessages: () => set({ chatMessages: [] }),

      // Notifications
      notificationsEnabled: true,
      toggleNotifications: () =>
        set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),

      // Anonymous session id (Hermes has no crypto.randomUUID)
      sessionId: null,
      ensureSessionId: () => {
        const existing = get().sessionId;
        if (existing) return existing;
        const generated = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
        set({ sessionId: generated });
        return generated;
      },

      // Clear all user data (sign-out and account deletion). The planner chat
      // goes with it: it is kept on the device now, and the next person to use
      // this phone should not open onto someone else's trip.
      clearUserData: () =>
        set({
          favorites: [],
          chatMessages: [],
          hasCompletedOnboarding: false,
        }),
    }),
    {
      name: "hasio-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // `moments` and `dayPlans` used to be stored here as well. Neither has
      // a screen any more; a row written by an older build still carries them,
      // and they drop out of it the next time the store is written, because
      // only the keys listed here are ever written back.
      partialize: (state) => ({
        language: state.language,
        currency: state.currency,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        favorites: state.favorites,
        chatMessages: messagesToStore(state.chatMessages),
        notificationsEnabled: state.notificationsEnabled,
        sessionId: state.sessionId,
      }),
      // The default shallow merge, plus two things for the chat: a stored
      // value that is not a list of messages cannot break the planner, and a
      // question that was still waiting when the app closed is marked failed —
      // nothing can be in flight across a restart, so it gets a Retry instead
      // of a reply that will never come.
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...stored,
          chatMessages: settleRestoredChat(stored.chatMessages),
        };
      },
    }
  )
);
