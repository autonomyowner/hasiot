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
 * Upload a single image to Convex storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadImageToConvex(
  fileUri: string,
  client: ConvexReactClient = convex
): Promise<string> {
  // 1. Get a short-lived upload URL from Convex
  const uploadUrl = await client.mutation(
    api.users.mutations.generateUploadUrl
  );

  // 2. Upload the file
  const response = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      "Content-Type": "image/jpeg",
    },
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  // 3. Parse the storage ID from the response
  const { storageId } = JSON.parse(response.body);

  // 4. Get the public URL for the storage ID
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
 * Unlike `uploadImageToConvex` this returns the raw storageId, because
 * `saveBusinessDoc` stores an `_storage` id on the user record — the file is
 * private and is only ever resolved to a URL by an admin via `getBusinessDocUrl`.
 */
export async function uploadDocumentToConvex(
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
 * Upload multiple images to Convex storage in parallel.
 * Returns an array of public URLs.
 */
export async function uploadMultipleToConvex(
  fileUris: string[],
  client: ConvexReactClient = convex
): Promise<string[]> {
  const results = await Promise.all(
    fileUris.map((uri) => uploadImageToConvex(uri, client))
  );
  return results;
}
