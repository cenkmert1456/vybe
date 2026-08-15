import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { useAction, useMutation } from "convex/react";
import { compressImage } from "@/lib/format";

export function usePhotoUpload() {
  const generateUploadUrl = useAction(api.upload.generateUploadUrl);
  const saveProfilePhoto = useMutation(api.upload.saveProfilePhoto);
  const imageUrl = useMutation(api.upload.imageUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadToStorage = async (file: File): Promise<string> => {
    const blob = await compressImage(file);
    const uploadUrl = await generateUploadUrl();
    const result = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": blob.type },
      body: blob,
    });
    if (!result.ok) {
      const text = await result.text();
      throw new Error(text || "Upload failed");
    }
    const { storageId } = (await result.json()) as { storageId: string };
    return storageId;
  };

  /** Upload a file and resolve its public URL without touching the profile. */
  const uploadAndGetUrl = async (file: File): Promise<string> => {
    setUploading(true);
    setError(null);
    try {
      const storageId = await uploadToStorage(file);
      return await imageUrl({ storageId: storageId as any });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed";
      setError(message);
      throw e;
    } finally {
      setUploading(false);
    }
  };

  /** Upload and attach to the signed-in user's profile. Returns the URL. */
  const uploadProfilePhoto = async (file: File): Promise<string> => {
    setUploading(true);
    setError(null);
    try {
      const storageId = await uploadToStorage(file);
      return await saveProfilePhoto({ storageId: storageId as any });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed";
      setError(message);
      throw e;
    } finally {
      setUploading(false);
    }
  };

  return { uploading, error, uploadAndGetUrl, uploadProfilePhoto };
}
