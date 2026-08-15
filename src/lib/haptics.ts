import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

export type HapticType = "light" | "medium" | "success" | "error";

const WEB_PATTERNS: Record<HapticType, number | number[]> = {
  light: 8,
  medium: [10, 30, 10],
  success: [12, 40, 18, 40, 12],
  error: [40, 30, 40],
};

let lastCall = 0;

/**
 * Fire haptic feedback. Uses native Capacitor haptics on device and falls
 * back to the Web Vibration API in browsers. No-op where unsupported.
 */
export function haptic(type: HapticType = "light") {
  try {
    if (Capacitor.isNativePlatform()) {
      void (async () => {
        switch (type) {
          case "success":
            await Haptics.notification({ type: NotificationType.Success });
            break;
          case "error":
            await Haptics.notification({ type: NotificationType.Error });
            break;
          case "medium":
            await Haptics.impact({ style: ImpactStyle.Medium });
            break;
          default:
            await Haptics.impact({ style: ImpactStyle.Light });
        }
      })();
      return;
    }

    if (typeof navigator === "undefined" || !navigator.vibrate) return;
    const now = Date.now();
    if (now - lastCall < 60) return; // debounce rapid triggers
    lastCall = now;
    navigator.vibrate(WEB_PATTERNS[type]);
  } catch {
    /* ignore */
  }
}
