#!/usr/bin/env node
/**
 * verify-convex-url.mjs — blocks builds that would ship without a backend.
 *
 * The Convex deployment URL is public (it ships inside the client bundle) but
 * REQUIRED: an APK built without VITE_CONVEX_URL shows only the local welcome
 * screen and cannot sign in, load profiles, match, or chat.
 *
 * Usage:
 *   VITE_CONVEX_URL=https://your-project.convex.cloud node scripts/verify-convex-url.mjs
 *
 * Local builds:   add VITE_CONVEX_URL=... to .env.local (see README).
 * GitHub Actions: add a repository secret named VITE_CONVEX_URL.
 * Skipped when    VITE_DIAGNOSTIC_MODE=1 (static-screen debugging only).
 */

const url = process.env.VITE_CONVEX_URL;

if (process.env.VITE_DIAGNOSTIC_MODE === "1") {
  console.log("[verify-convex-url] skipped (VITE_DIAGNOSTIC_MODE=1)");
  process.exit(0);
}

if (!url || !url.trim()) {
  console.error(
    [
      "❌ VITE_CONVEX_URL is not set — this build would ship an APK with no",
      "   backend connection (welcome screen only, no sign-in, no data).",
      "",
      "   Set it to your Convex deployment URL, for example:",
      "     VITE_CONVEX_URL=https://your-project.convex.cloud",
      "",
      "   Locally:       add VITE_CONVEX_URL=... to a .env.local file (see README).",
      "   GitHub Actions: add a repository secret named VITE_CONVEX_URL.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const normalized = url.trim().replace(/\/+$/, "");
if (!/^https:\/\//.test(normalized)) {
  console.error("❌ VITE_CONVEX_URL must be an https:// URL for mobile builds.");
  process.exit(1);
}

console.log(
  `[verify-convex-url] ✅ VITE_CONVEX_URL configured (${normalized.replace(
    /(https:\/\/[^/]+).*/,
    "$1",
  )}/...)`,
);
