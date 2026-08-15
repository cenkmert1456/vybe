/**
 * VYBE startup instrumentation.
 *
 * Every marker is emitted with a `[VYBE_*]` prefix so it is easy to grep in
 * logcat on a real Android device. Console output from the Capacitor WebView
 * appears in logcat under the `chromium` tag (adb logcat | findstr VYBE).
 *
 * Markers:
 *   [VYBE_START]            ES module graph evaluated
 *   [VYBE_WEBVIEW_READY]    document is interactive/complete
 *   [VYBE_START_NATIVE]     native platform init begun (with platform name)
 *   [VYBE_NATIVE_INIT_DONE] native init completed without throwing
 *   [VYBE_NATIVE_INIT_ERROR]native init threw (logged, never fatal)
 *   [VYBE_REACT_START]      React root render called
 *   [VYBE_REACT_RENDERED]   first React commit completed
 *   [VYBE_WELCOME_VISIBLE]  Landing (splash/welcome) mounted
 *   [VYBE_BACKEND_INIT]     Convex first query resolved (backend reachable)
 *   [VYBE_BACKEND_OFFLINE]  backend deemed unreachable -> offline screen
 *   [VYBE_JS_ERROR]         any uncaught window error / rejection
 */
export function startupLog(event: string, detail?: string): void {
  try {
    const suffix = detail ? ` ${detail}` : "";
    // eslint-disable-next-line no-console
    console.log(`[VYBE_${event}]${suffix}`);
  } catch {
    /* logging must never break startup */
  }
}

/**
 * Install global error listeners that write uncaught errors and unhandled
 * promise rejections to the console (logcat) with a VYBE_JS_ERROR marker.
 * This is intentionally separate from the in-app error dialog so errors that
 * happen BEFORE React mounts are still visible to the developer.
 */
export function installGlobalErrorLogging(): void {
  try {
    window.addEventListener("error", (event) => {
      const msg = event.message || "Unknown window error";
      const loc = event.filename
        ? ` at ${event.filename}:${event.lineno ?? 0}:${event.colno ?? 0}`
        : "";
      const stack = event.error?.stack ? `\n${event.error.stack}` : "";
      // eslint-disable-next-line no-console
      console.error(`[VYBE_JS_ERROR] ${msg}${loc}${stack}`);
    });
    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      const msg =
        reason instanceof Error
          ? `${reason.message}\n${reason.stack ?? ""}`
          : typeof reason === "string"
            ? reason
            : String(reason ?? "Unknown rejection");
      // eslint-disable-next-line no-console
      console.error(`[VYBE_JS_ERROR] Unhandled promise rejection: ${msg}`);
    });
  } catch {
    /* non-fatal */
  }
}
