import * as FileSystem from "expo-file-system";
import { api } from "@/backend";
import { ConvexReactClient } from "convex/react";
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
    uploadType: (FileSystem as any).FileSystemUploadType?.BINARY_CONTENT ?? 0,
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
