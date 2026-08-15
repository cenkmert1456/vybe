/**
 * Unified permission experience.
 *
 * Permissions are requested lazily — only when a feature actually needs them —
 * never all at once at startup. Every helper returns a friendly, typed result
 * so callers can show localized explanations and an "open app settings" path
 * when a permission is permanently denied.
 */
import { Capacitor } from "@capacitor/core";
import { isNative } from "./mobile";

export type PermissionResult = "granted" | "denied" | "unsupported";

export function browserSupportsMediaDevices(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    window.isSecureContext !== false
  );
}

function isPermissionError(err: unknown): boolean {
  const name = (err as { name?: string })?.name ?? "";
  return (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    name === "SecurityError"
  );
}

/**
 * Best-effort deep link to this app's settings pane on a real device.
 * iOS opens the settings app via the custom scheme; on Android the system
 * browser is invoked and the caller also shows the manual path as a fallback.
 */
export function openAppSettings(): void {
  try {
    if (isNative()) {
      window.open("app-settings:", "_system");
    } else if (Capacitor.isNativePlatform()) {
      // Capacitor WebView bridges custom schemes to the OS intent system.
      window.open("app-settings:", "_system");
    }
  } catch {
    /* instructions fallback handled by the caller */
  }
}

/** Ask for camera (user-facing). Does NOT keep the stream open. */
export async function requestCameraPermission(): Promise<PermissionResult> {
  if (!browserSupportsMediaDevices()) return "unsupported";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
    });
    stream.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch (err) {
    return isPermissionError(err) ? "denied" : "unsupported";
  }
}

/** Ask for microphone (user-facing). Does NOT keep the stream open. */
export async function requestMicrophonePermission(): Promise<PermissionResult> {
  if (!browserSupportsMediaDevices()) return "unsupported";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch (err) {
    return isPermissionError(err) ? "denied" : "unsupported";
  }
}

/** Passive microphone state (no prompt). Falls back to "unknown". */
export async function microphonePermissionState(): Promise<
  "granted" | "denied" | "prompt" | "unknown"
> {
  try {
    if (navigator.permissions?.query) {
      const st = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });
      return st.state;
    }
  } catch {
    /* older engines — treat as unknown */
  }
  return "unknown";
}

/**
 * Ask for geolocation. `position` is returned when granted so callers can
 * autofill city/country; permission failures never throw.
 */
export function requestLocationPermission(): Promise<{
  status: "granted" | "denied" | "unsupported";
  latitude?: number;
  longitude?: number;
}> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve({ status: "unsupported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          status: "granted",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => resolve({ status: "denied" }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  });
}
