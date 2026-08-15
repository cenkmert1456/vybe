/**
 * VYBE bundle verification.
 *
 * Guards against the "Android opens https://localhost / webpage not found"
 * failure mode: an APK that ships without the web bundle in
 * android/app/src/main/assets/public. Capacitor serves the app from its
 * virtual origin (https://localhost) using those bundled assets — if any are
 * missing, the WebView shows a browser-style "page not found" error.
 *
 * This script fails loudly so a broken APK can never be produced silently.
 *
 * Usage: bun scripts/verify-bundle.mjs
 * (run AFTER `bun run build && npx cap sync`)
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

function fail(msg) {
  console.error(`\n❌ ${msg}`);
  console.error(
    "Fix: run `bun run mobile:sync` (builds the web app and copies it into the native projects), then re-verify.",
  );
  process.exit(1);
}

const distIndex = path.join(ROOT, "dist/index.html");
if (!existsSync(distIndex)) {
  fail("dist/index.html is missing — the production web build has not been created.");
}

const distAssets = path.join(ROOT, "dist/assets");
if (!existsSync(distAssets) || readdirSync(distAssets).filter((f) => f.endsWith(".js")).length === 0) {
  fail("dist/assets is empty — the production web build produced no JavaScript.");
}

// Every asset referenced by the built index.html must exist in the synced
// Android project (android/app/src/main/assets/public).
const androidPublic = path.join(ROOT, "android/app/src/main/assets/public");
const androidIndex = path.join(androidPublic, "index.html");
if (!existsSync(androidIndex)) {
  fail("android/app/src/main/assets/public/index.html is missing — `npx cap sync android` has not copied the bundle into the APK project.");
}

const androidAssetsDir = path.join(androidPublic, "assets");
if (!existsSync(androidAssetsDir)) {
  fail("android/app/src/main/assets/public/assets is missing — the Android project has no bundled JavaScript at all.");
}

const html = readFileSync(distIndex, "utf8");
const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
if (refs.length === 0) {
  fail("dist/index.html references no /assets files — the build output looks wrong.");
}

const missing = refs.filter((ref) => !existsSync(path.join(androidPublic, ref)));
if (missing.length > 0) {
  fail(
    `The Android project is missing ${missing.length} bundled asset(s) referenced by index.html:\n   ${missing.join("\n   ")}\nRun \`npx cap sync android\` again.`,
  );
}

const syncedJs = readdirSync(androidAssetsDir).filter((f) => f.endsWith(".js")).length;
if (syncedJs === 0) {
  fail("android/app/src/main/assets/public/assets contains no JavaScript files.");
}

console.log(
  `✅ Bundle verified: ${refs.length} assets referenced by index.html are present in the Android APK project (${syncedJs} JS files synced).`,
);
