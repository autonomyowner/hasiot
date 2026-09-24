// SDK 54 made the new File/Directory API the default export of
// "expo-file-system"; the old helpers still exist there as stubs that throw at
// runtime. `uploadAsync` lives in the legacy entrypoint and must be imported
// from there or every upload in the app fails.
import * as FileSystem from "expo-file-system/legacy";
import { api } from "@/backend";
import { ConvexReactClient } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { convex } from "./convex";

/**
 * Put a file in Convex storage and return its storage id.
 *
 * The id, not a URL, is the thing worth keeping: a record that stores the id can
 * always resolve a fresh URL, and can delete the file when the record goes.
 * Callers that need a URL immediately use `uploadImageToConvex` below.
 */
export async function uploadToConvexStorage(
  fileUri: string,
  mimeType: string = "image/jpeg",
  client: ConvexReactClient = convex
): Promise<Id<"_storage">> {
  const uploadUrl = await client.mutation(api.users.mutations.generateUploadUrl);

  const response = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      "Content-Type": mimeType,
    },
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  const { storageId } = JSON.parse(response.body);
  if (!storageId) {
    throw new Error("Upload succeeded but no storageId was returned");
  }

  return storageId;
}

/**
 * Upload a single image to Convex storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadImageToConvex(
  fileUri: string,
  client: ConvexReactClient = convex
): Promise<string> {
  const storageId = await uploadToConvexStorage(fileUri, "image/jpeg", client);

  const url = await client.query(api.users.queries.getStorageUrl, {
    storageId,
  });

  if (!url) {
    throw new Error("Failed to get storage URL");
  }

  return url;
}

/**
 * Upload a verification document (business licence, CR, ID) to Convex storage.
 *
 * Returns the raw storageId because `saveBusinessDoc` stores an `_storage` id on
 * the user record — the file is private and is only ever resolved to a URL by an
 * admin via `getBusinessDocUrl`.
 */
export async function uploadDocumentToConvex(
  fileUri: string,
  mimeType: string = "image/jpeg",
  client: ConvexReactClient = convex
): Promise<Id<"_storage">> {
  return uploadToConvexStorage(fileUri, mimeType, client);
}

export interface UploadManyOptions {
  /**
   * Called with how many uploads have finished — 0 before the first ends,
   * `total` after the last. Five phone photos over mobile data can take most
   * of a minute, and a spinner alone for that long reads as a frozen screen.
   */
  onProgress?: (done: number, total: number) => void;
  client?: ConvexReactClient;
}

/**
 * Upload multiple images to Convex storage in parallel.
 * Returns their public URLs in the order the files were given.
 */
export async function uploadMultipleToConvex(
  fileUris: string[],
  { onProgress, client = convex }: UploadManyOptions = {}
): Promise<string[]> {
  const total = fileUris.length;
  let done = 0;
  onProgress?.(0, total);
  return Promise.all(
    fileUris.map(async (uri) => {
      const url = await uploadImageToConvex(uri, client);
      done += 1;
      onProgress?.(done, total);
      return url;
    })
  );
}
