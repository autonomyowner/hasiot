import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Language, ChatMessage } from "@/types";
import type { Currency } from "@/lib/currency";

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

  // Chat Messages
  chatMessages: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  clearChatMessages: () => void;

  // Notifications
  notificationsEnabled: boolean;
  toggleNotifications: () => void;

  // Anonymous session id — rate-limit key for the AI planner when signed out
  sessionId: string | null;
  ensureSessionId: () => string;

  // Clear all user data (for account deletion)
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

      // Chat Messages
      chatMessages: [],
      addChatMessage: (message) =>
        set((state) => ({
          chatMessages: [...state.chatMessages, message],
        })),
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

      // Clear all user data (for account deletion)
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
        notificationsEnabled: state.notificationsEnabled,
        sessionId: state.sessionId,
      }),
    }
  )
);
