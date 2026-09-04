import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Language, Moment, DayPlan, ChatMessage } from "@/types";
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

  // Favorites
  favorites: string[];
  addFavorite: (id: string) => void;
  removeFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;

  // Moments
  moments: Moment[];
  addMoment: (moment: Moment) => void;
  removeMoment: (id: string) => void;

  // Day Plans
  dayPlans: DayPlan[];
  addDayPlan: (plan: DayPlan) => void;
  updateDayPlan: (plan: DayPlan) => void;
  removeDayPlan: (id: string) => void;

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
        set((state) => ({
          favorites: [...state.favorites, id],
        })),
      removeFavorite: (id) =>
        set((state) => ({
          favorites: state.favorites.filter((fav) => fav !== id),
        })),
      isFavorite: (id) => get().favorites.includes(id),

      // Moments
      moments: [],
      addMoment: (moment) =>
        set((state) => ({
          moments: [moment, ...state.moments],
        })),
      removeMoment: (id) =>
        set((state) => ({
          moments: state.moments.filter((m) => m.id !== id),
        })),

      // Day Plans
      dayPlans: [],
      addDayPlan: (plan) =>
        set((state) => ({
          dayPlans: [...state.dayPlans, plan],
        })),
      updateDayPlan: (plan) =>
        set((state) => ({
          dayPlans: state.dayPlans.map((p) => (p.id === plan.id ? plan : p)),
        })),
      removeDayPlan: (id) =>
        set((state) => ({
          dayPlans: state.dayPlans.filter((p) => p.id !== id),
        })),

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
          moments: [],
          dayPlans: [],
          chatMessages: [],
          hasCompletedOnboarding: false,
        }),
    }),
    {
      name: "hasio-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        language: state.language,
        currency: state.currency,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        favorites: state.favorites,
        moments: state.moments,
        dayPlans: state.dayPlans,
        notificationsEnabled: state.notificationsEnabled,
        sessionId: state.sessionId,
      }),
    }
  )
);
