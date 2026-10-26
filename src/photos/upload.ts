// Uploading a picked photo to the private bucket, shared by document and shift photos: the API hands out an
// upload URL, the file goes straight to R2, and keeping it answers whatever that photo route answers.
import { File, UploadType } from "expo-file-system";

import { ApiError, type useApi } from "@/api/client";
import { PHOTO_TYPES, type PhotoType } from "@/domain/photos";

/** A picked image: its local file and type, as the image picker gives them. */
export type PickedPhoto = { uri: string; mimeType?: string | null };

/**
 * Starts the upload at `path` (POST with `target` and the type), PUTs the file to the signed URL, then keeps it
 * (PUT with `target` and the key) and returns that answer. Throws an ApiError; a failed file upload is `offline`.
 */
export async function uploadPhoto<T>(
  api: ReturnType<typeof useApi>,
  path: string,
  target: Record<string, string>,
  photo: PickedPhoto,
): Promise<T> {
  const contentType: PhotoType = PHOTO_TYPES.includes(photo.mimeType as PhotoType)
    ? (photo.mimeType as PhotoType)
    : "image/jpeg";
  const { key, uploadUrl } = await api<{ key: string; uploadUrl: string }>(path, {
    method: "POST",
    body: { ...target, contentType },
  });
  let status: number;
  try {
    ({ status } = await new File(photo.uri).upload(uploadUrl, {
      httpMethod: "PUT",
      uploadType: UploadType.BINARY_CONTENT,
      mimeType: contentType,
      headers: { "Content-Type": contentType },
    }));
  } catch {
    throw new ApiError("offline");
  }
  if (status < 200 || status >= 300) throw new ApiError("server");
  return api<T>(path, { method: "PUT", body: { ...target, key } });
}
