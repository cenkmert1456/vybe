export function ageFromDateOfBirth(ms: number): number {
  const dob = new Date(ms);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

export function formatDistance(km: number | undefined | null): string | null {
  if (km === undefined || km === null) return null;
  if (km < 1) return "<1 km away";
  return `${Math.round(km)} km away`;
}

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Rough profile completion used for the "complete your profile" card.
 * Weights: 1 photo (40), 3+ photos (60), bio (15), 3+ interests (15), languages (5), verified (5).
 */
export function profileCompletion(profile: {
  photos: string[];
  bio: string;
  interests: string[];
  languages: string[];
  verified: boolean;
}): number {
  let score = 0;
  if (profile.photos.length > 0) score += 40;
  if (profile.photos.length >= 3) score += 20;
  if (profile.bio.trim().length > 0) score += 15;
  if (profile.interests.length >= 3) score += 15;
  if (profile.languages.length > 0) score += 5;
  if (profile.verified) score += 5;
  return Math.min(100, score);
}

/** Compress + resize an image file client-side before upload. */
export async function compressImage(
  file: File,
  maxDim = 1280,
  quality = 0.82,
): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Invalid image"));
    image.src = dataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
      "image/jpeg",
      quality,
    );
  });
}
