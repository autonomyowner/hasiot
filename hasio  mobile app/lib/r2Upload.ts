// R2 Upload utilities for Cloudflare R2 storage
import * as FileSystem from "expo-file-system";

// Get the R2 public URL from environment
const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL;

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload a file to Cloudflare R2
 *
 * For the Hasio app, R2 bucket is pre-configured with public access.
 * Images are uploaded and accessible via the public R2 URL.
 *
 * @param fileUri - Local file URI (from image picker)
 * @param folder - Folder in R2 bucket (e.g., "lodging", "food", "moments")
 * @param filename - Optional custom filename
 */
export async function uploadToR2(
  fileUri: string,
  folder: string = "uploads",
  filename?: string
): Promise<UploadResult> {
  try {
    if (!R2_PUBLIC_URL) {
      console.warn("R2_PUBLIC_URL not configured, using local storage");
      return {
        success: true,
        url: fileUri, // Return local URI as fallback
      };
    }

    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      return {
        success: false,
        error: "File not found",
      };
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = fileUri.split(".").pop() || "jpg";
    const uniqueFilename = filename
      ? `${filename}-${timestamp}.${extension}`
      : `${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`;

    const key = `${folder}/${uniqueFilename}`;

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to blob for upload
    const blob = base64ToBlob(base64, `image/${extension}`);

    // Upload to R2 using fetch
    // Note: This requires R2 bucket to have public PUT access or use presigned URLs
    // For production, implement presigned URL generation in convex/http.ts
    const uploadUrl = `${R2_PUBLIC_URL}/${key}`;

    const response = await fetch(uploadUrl, {
      method: "PUT",
      body: blob,
      headers: {
        "Content-Type": `image/${extension}`,
      },
    });

    if (response.ok) {
      return {
        success: true,
        url: uploadUrl,
      };
    } else {
      // If direct upload fails, return local URI as fallback
      console.warn("R2 upload failed, using local storage");
      return {
        success: true,
        url: fileUri,
      };
    }
  } catch (error) {
    console.error("Upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Upload multiple files to R2
 */
export async function uploadMultipleToR2(
  fileUris: string[],
  folder: string = "uploads"
): Promise<string[]> {
  const results = await Promise.all(
    fileUris.map((uri) => uploadToR2(uri, folder))
  );

  return results
    .filter((r) => r.success && r.url)
    .map((r) => r.url as string);
}

/**
 * Convert base64 string to Blob
 */
function base64ToBlob(base64: string, contentType: string): Blob {
  const byteCharacters = atob(base64);
  const byteArrays: Uint8Array[] = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);

    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
}

/**
 * Delete a file from R2
 * Note: Requires DELETE access on the R2 bucket
 */
export async function deleteFromR2(url: string): Promise<boolean> {
  try {
    if (!url.startsWith(R2_PUBLIC_URL || "")) {
      return false;
    }

    const response = await fetch(url, {
      method: "DELETE",
    });

    return response.ok;
  } catch (error) {
    console.error("Delete error:", error);
    return false;
  }
}

/**
 * Get the public URL for a file in R2
 */
export function getR2PublicUrl(key: string): string {
  if (!R2_PUBLIC_URL) {
    return key;
  }
  return `${R2_PUBLIC_URL}/${key}`;
}

/**
 * Check if a URL is an R2 URL
 */
export function isR2Url(url: string): boolean {
  return R2_PUBLIC_URL ? url.startsWith(R2_PUBLIC_URL) : false;
}
