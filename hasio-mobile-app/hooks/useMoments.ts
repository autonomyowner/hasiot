import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/backend";
import { uploadToConvexStorage } from "@/lib/convexUpload";
import type { Id } from "../../convex/_generated/dataModel";

export interface Moment {
  id: string;
  image_url: string | null;
  note: string | null;
  location: string | null;
  created_at: string;
}

// The key the pre-Convex version wrote to, kept only so those moments can be
// carried across once. See `migrateLegacyMoments`.
const LEGACY_PREFIX = "hasio_moments_";

interface LegacyMoment {
  id: string;
  user_id: string;
  image_url: string;
  note: string | null;
  location: string | null;
  created_at: string;
}

/**
 * The signed-in user's moments, backed by Convex.
 *
 * Moments used to live in AsyncStorage with the image stored as the raw URI
 * from the picker. That URI points into the app's cache directory, which iOS
 * purges under storage pressure — so moments silently became blank tiles — and
 * nothing survived a reinstall or appeared on a second device, despite the
 * screen promising that signing in saves them.
 */
export function useMoments(userId: string | null) {
  // `undefined` while the query is in flight; the server returns [] when signed
  // out, so a signed-out user settles on an empty list rather than loading
  // forever.
  const data = useQuery(api.moments.queries.getMyMoments);
  const createMoment = useMutation(api.moments.mutations.createMoment);
  const removeMoment = useMutation(api.moments.mutations.deleteMoment);

  const [isMutating, setIsMutating] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  const moments: Moment[] = data ?? [];
  const isLoading = data === undefined || isMigrating;

  const migratedFor = useRef<string | null>(null);

  /**
   * Best-effort, one-time lift of a device's old local moments into Convex.
   *
   * Every step is allowed to fail quietly: the file behind a legacy moment may
   * already have been evicted, which is the whole reason for this change. The
   * legacy key is cleared once regardless of how many moments made it across —
   * retrying on every mount would re-upload whatever succeeded last time.
   */
  const migrateLegacyMoments = useCallback(
    async (uid: string) => {
      const key = `${LEGACY_PREFIX}${uid}`;
      const stored = await AsyncStorage.getItem(key);
      if (!stored) return;

      let legacy: LegacyMoment[] = [];
      try {
        legacy = JSON.parse(stored);
      } catch {
        await AsyncStorage.removeItem(key);
        return;
      }

      if (!Array.isArray(legacy) || legacy.length === 0) {
        await AsyncStorage.removeItem(key);
        return;
      }

      setIsMigrating(true);
      try {
        // Oldest first, so the newest ends up on top of the grid — the query
        // orders by creation time on the server, not by the original date.
        for (const item of [...legacy].reverse()) {
          if (!item?.image_url) continue;
          try {
            const storageId = await uploadToConvexStorage(item.image_url);
            await createMoment({
              storageId,
              note: item.note ?? undefined,
              location: item.location ?? undefined,
            });
          } catch {
            // Missing file, or the daily cap — skip and keep going.
          }
        }
      } finally {
        await AsyncStorage.removeItem(key);
        setIsMigrating(false);
      }
    },
    [createMoment]
  );

  useEffect(() => {
    if (!userId) return;
    if (migratedFor.current === userId) return;
    migratedFor.current = userId;
    migrateLegacyMoments(userId).catch(() => {
      // Never block the screen on migration.
      setIsMigrating(false);
    });
  }, [userId, migrateLegacyMoments]);

  const addMoment = useCallback(
    async (imageUri: string, note?: string, location?: string) => {
      setIsMutating(true);
      try {
        const storageId = await uploadToConvexStorage(imageUri);
        await createMoment({ storageId, note, location });
        return true;
      } catch {
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [createMoment]
  );

  const deleteMoment = useCallback(
    async (id: string) => {
      setIsMutating(true);
      try {
        await removeMoment({ momentId: id as Id<"moments"> });
        return true;
      } catch {
        return false;
      } finally {
        setIsMutating(false);
      }
    },
    [removeMoment]
  );

  return { moments, isLoading, isMutating, addMoment, deleteMoment };
}
