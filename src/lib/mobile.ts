import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";
import { Preferences } from "@capacitor/preferences";
import { PushNotifications } from "@capacitor/push-notifications";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style as StatusBarStyle } from "@capacitor/status-bar";

/**
 * VYBE mobile platform bridge.
 *
 * All native-only behaviour is guarded by `isNative()`, so the app keeps
 * working as a normal web app when running in a browser or the preview
 * environment. On device, this module wires up:
 *
 *  - Status bar + splash screen (dark, edge-to-edge)
 *  - Keyboard handling
 *  - Deep links (custom URL scheme + universal links)
 *  - Push notifications (registration, permission, tap-to-navigate)
 *  - Haptic feedback (via src/lib/haptics.ts)
 */

const VYBE_NAVIGATE_EVENT = "vybe:navigate";
const PUSH_TOKEN_KEY = "vybe.push.token";

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Whether real push notifications are configured for THIS build.
 *
 * Decided at compile time in vite.config.ts: true only when the native push
 * credentials exist in the repo (android/app/google-services.json for Android,
 * an APNs entitlement for iOS).
 *
 * CRITICAL: on Android, calling PushNotifications.register() without Firebase
 * configured throws a FATAL native exception (IllegalStateException —
 * "Default FirebaseApp is not initialized") that no JS try/catch can catch:
 * the process is killed. So the register() call must never exist in a bundle
 * built without Firebase config — the flag below compiles it out entirely.
 */
const PUSH_AVAILABLE = isNative()
  ? Capacitor.getPlatform() === "android"
    ? __VYBE_PUSH_ENABLED_ANDROID__
    : Capacitor.getPlatform() === "ios"
      ? __VYBE_PUSH_ENABLED_IOS__
      : false
  : false;

/** True when this build ships with native push credentials. */
export const pushEnabled = PUSH_AVAILABLE;

/** Dispatch an internal navigation request handled by the router. */
function requestNavigate(path: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(VYBE_NAVIGATE_EVENT, { detail: path }));
}

/** Register a listener that the router uses to perform navigation. */
export function onNativeNavigate(cb: (path: string) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<string>).detail;
    if (typeof detail === "string" && detail.startsWith("/")) cb(detail);
  };
  window.addEventListener(VYBE_NAVIGATE_EVENT, handler);
  return () => window.removeEventListener(VYBE_NAVIGATE_EVENT, handler);
}

/** Extract a router path from a push payload or deep link URL. */
export function routeFromPayload(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const raw = data.route ?? data.path ?? data.url;
  if (typeof raw !== "string") return null;
  try {
    // Accept both "/app/chat/..." and "vybe://app/chat/..." style values.
    const parsed = new URL(raw, "https://vybe.local");
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return path.startsWith("/") ? path : null;
  } catch {
    return raw.startsWith("/") ? raw : null;
  }
}

/** Store the latest push token for the backend to consume. */
export async function storePushToken(token: string): Promise<void> {
  try {
    await Preferences.set({ key: PUSH_TOKEN_KEY, value: token });
  } catch {
    /* non-fatal */
  }
}

export async function getPushToken(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: PUSH_TOKEN_KEY });
    return value ?? null;
  } catch {
    return null;
  }
}

/**
 * Initialize native platform behaviour. Safe to call on web (no-ops).
 * Returns a cleanup function for app lifecycle listeners.
 */
export function initMobilePlatform(): () => void {
  if (!isNative()) return () => {};

  // Every native call below is guarded. A plugin failure must never abort
  // startup — the whole body runs inside try/catch so a synchronous bridge
  // exception cannot blank the app on a real device.
  try {
    // eslint-disable-next-line no-console
    console.log(
      `[VYBE_START_NATIVE] platform=${Capacitor.getPlatform()} scheme=${window.location.protocol}//${window.location.host}`,
    );
  } catch {
    /* non-fatal */
  }

  const cleanups: Array<() => void> = [];

  // Dark, edge-to-edge status bar over the deep dark app background.
  StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  StatusBar.setStyle({ style: StatusBarStyle.Dark }).catch(() => {});
  StatusBar.setBackgroundColor({ color: "#0b0b12" }).catch(() => {});

  // Hide the splash screen once the web app is interactive.
  SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});

  // Proper keyboard behaviour (resize the webview, avoid covering inputs).
  Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {});

  // Deep links: custom scheme (vybe://) and universal links.
  void CapacitorApp.addListener("appUrlOpen", (event) => {
    const path = routeFromPayload({ url: event.url });
    if (path) requestNavigate(path);
  }).catch(() => {});

  // Push notifications: OPTIONAL and only when this build was made with native
  // push credentials. When Firebase/APNs is not configured (the current state:
  // no google-services.json), the entire registration path is compiled out —
  // calling register() without Firebase is a fatal native crash, so the call
  // must never run. Registration is also DEFERRED until after the first paint
  // so a cold start never blocks on permissions, and it runs at most once.
  if (!PUSH_AVAILABLE) {
    // eslint-disable-next-line no-console
    console.log(
      "[VYBE_PUSH] disabled — no google-services.json / APNs entitlement in this build; push stays off until Firebase is configured",
    );
  } else {
    void PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (notification) => {
        const path = routeFromPayload(notification.notification.data);
        if (path) requestNavigate(path);
      },
    ).catch(() => {});

    void PushNotifications.addListener("registration", (token) => {
      void storePushToken(token.value);
    }).catch(() => {});

    const registerPush = async () => {
      try {
        // eslint-disable-next-line no-console
        console.log("[VYBE_PUSH] register start");
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === "prompt") {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== "granted") {
          // eslint-disable-next-line no-console
          console.log(`[VYBE_PUSH] permission ${perm.receive}`);
          return;
        }
        await PushNotifications.register();
        // eslint-disable-next-line no-console
        console.log("[VYBE_PUSH] register complete");
      } catch (err) {
        // Firebase registration failed (e.g. FCM rejected the token): the
        // app keeps working; only push delivery is unavailable. This is a
        // normal rejected promise — NOT the fatal missing-Firebase crash,
        // which is prevented by the compile-time flag above.
        // eslint-disable-next-line no-console
        console.log(`[VYBE_PUSH] unavailable ${String(err)}`);
      }
    };

    const pushTimer = window.setTimeout(() => {
      void registerPush();
    }, 3000);
    cleanups.push(() => window.clearTimeout(pushTimer));
  }

  // eslint-disable-next-line no-console
  console.log("[VYBE_NATIVE_INIT_DONE]");
  return () => {
    cleanups.forEach((off) => off());
  };
}
