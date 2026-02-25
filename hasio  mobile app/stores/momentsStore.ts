// Moments store - using local storage only
// TODO: Migrate to Cloudflare R2 for image storage

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MOMENTS_STORAGE_KEY = "hasio_moments";

export interface Moment {
  id: string;
  user_id: string;
  image_url: string;
  note: string | null;
  location: string | null;
  created_at: string;
}

interface MomentsState {
  moments: Moment[];
  isLoading: boolean;
  error: string | null;
  fetchMoments: () => Promise<void>;
  addMoment: (imageUri: string, note?: string, location?: string) => Promise<boolean>;
  deleteMoment: (id: string, imageUrl: string) => Promise<boolean>;
  clearMoments: () => void;
}

export const useMomentsStore = create<MomentsState>((set, get) => ({
  moments: [],
  isLoading: false,
  error: null,

  fetchMoments: async () => {
    set({ isLoading: true, error: null });

    try {
      const stored = await AsyncStorage.getItem(MOMENTS_STORAGE_KEY);
      const moments = stored ? JSON.parse(stored) : [];
      set({ moments, isLoading: false });
    } catch (error: any) {
      console.error("Error fetching moments:", error.message);
      set({ error: error.message, isLoading: false });
    }
  },

  addMoment: async (imageUri: string, note?: string, location?: string) => {
    set({ isLoading: true, error: null });

    try {
      const newMoment: Moment = {
        id: `moment_${Date.now()}`,
        user_id: "local_user",
        image_url: imageUri, // Store local URI directly
        note: note || null,
        location: location || null,
        created_at: new Date().toISOString(),
      };

      const currentMoments = get().moments;
      const updatedMoments = [newMoment, ...currentMoments];

      await AsyncStorage.setItem(MOMENTS_STORAGE_KEY, JSON.stringify(updatedMoments));

      set({
        moments: updatedMoments,
        isLoading: false,
      });

      return true;
    } catch (error: any) {
      console.error("Error adding moment:", error.message);
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  deleteMoment: async (id: string, imageUrl: string) => {
    set({ isLoading: true, error: null });

    try {
      const currentMoments = get().moments;
      const updatedMoments = currentMoments.filter((m) => m.id !== id);

      await AsyncStorage.setItem(MOMENTS_STORAGE_KEY, JSON.stringify(updatedMoments));

      set({
        moments: updatedMoments,
        isLoading: false,
      });

      return true;
    } catch (error: any) {
      console.error("Error deleting moment:", error.message);
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  clearMoments: () => {
    AsyncStorage.removeItem(MOMENTS_STORAGE_KEY);
    set({ moments: [], error: null });
  },
}));
