import { LogoMark } from "@/components/Logo";

/**
 * Crash-isolation diagnostic screen.
 *
 * Rendered INSTEAD of the whole app tree (no Convex, no auth, no i18n, no
 * router, no native plugins, no analytics) when diagnostic mode is active:
 *
 *   - build time:  VITE_DIAGNOSTIC_MODE=1 (bake into the APK)
 *   - runtime:     /?diag=1 query parameter (web preview)
 *
 * If this screen renders on a device that otherwise closes on startup, the
 * crash is in app code after module evaluation. If the app still closes
 * before this screen appears, the problem is native Android configuration or
 * the WebView itself — not the JavaScript bundle.
 */
export function DiagnosticScreen() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        background: "#0b0b12",
        color: "#ffffff",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: 24,
        textAlign: "center",
      }}
    >
      <LogoMark size={88} />
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "0.24em" }}>
        VYBE
      </div>
      <div style={{ fontSize: 14, color: "#9ca3af", maxWidth: 320, lineHeight: 1.5 }}>
        Diagnostic startup — no backend, no native services.
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", maxWidth: 320, lineHeight: 1.5 }}>
        If you can see this screen on the device, the web bundle renders and
        the crash is in app startup code, not the native shell.
      </div>
    </div>
  );
}
