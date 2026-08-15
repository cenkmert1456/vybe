# VYBE — Global Social & Dating Mobile App

**Feel the vibe. Find your people.**

VYBE is a production-oriented global social discovery and dating app built as a
**native mobile application** for iOS and Android, with a shared TypeScript
codebase.

## Tech Stack

- **Frontend**: Vite + React 19 + TypeScript
- **UI**: Tailwind CSS v4, shadcn/ui, Framer Motion, Lucide icons
- **Backend & Database**: Convex (realtime queries, auth, storage, subscriptions)
- **Auth**: Convex Auth (email OTP, Google, Apple)
- **Mobile**: Capacitor 8 (Android + iOS native projects)
- **Native plugins**: Camera, Geolocation, Push Notifications, Haptics, Status Bar, Keyboard, Splash Screen, Preferences, App (deep links)
- **Package manager**: Bun

## Repository Layout

```
android/                  Native Android project (Gradle, applicationId com.vybe.app)
ios/                      Native iOS project (Xcode, bundle id com.vybe.app)
src/                      Shared TypeScript application (web + mobile)
  app/                    App screens (Discover, Matches, Messages, Activity, Profile, Chat, ...)
  convex/                 Convex backend (schema, queries, mutations, actions)
  lib/mobile.ts           Capacitor native bridge (deep links, push, status bar)
  lib/haptics.ts          Native haptic feedback with web fallback
scripts/generate-icons.mjs  Generates app icons + splash assets from the logo
.github/workflows/        CI (Android build + iOS check)
capacitor.config.ts       Capacitor configuration
```

## Prerequisites

- **Bun** ≥ 1.1 (`curl -fsSL https://bun.sh/install | bash`)
- **Node.js** ≥ 20
- **Android**: JDK 21 (Temurin), Android Studio with Android SDK (compileSdk 36)
- **iOS**: macOS with Xcode 16+

## Install

```bash
bun install
```

## Run Web Development

```bash
bun run dev
```

The app runs at `http://localhost:5173`. The Convex backend must be running
(managed by the Freebuff cloud environment, or locally with
`npx convex dev`).

## Mobile Development Workflow

The web app is the source of truth. After changing `src/`, sync the native
projects:

```bash
# Build the web app and copy assets into both native projects
bun run mobile:sync

# Or only copy assets without rebuilding
npx cap copy
```

### Run Android

```bash
bun run mobile:sync
cd android
./gradlew assembleDebug        # builds app-debug.apk
./gradlew installDebug         # installs on a connected device/emulator
```

Or open Android Studio:

```bash
bun run mobile:android         # npx cap open android
```

### Run iOS

```bash
bun run mobile:sync
bun run mobile:ios             # npx cap open ios
```

Then select a simulator or your device in Xcode and press **Run**. The iOS
project uses Swift Package Manager — Xcode resolves Capacitor packages
automatically on first build.

## Sync Mobile Platforms

```bash
bun run mobile:sync    # bun run build && npx cap sync && verify bundle
npx cap sync android   # sync only Android (after a build)
npx cap sync ios       # sync only iOS (after a build)
```

`mobile:sync` builds the production web app **first**, copies it into the
native projects, and then **verifies** that the full bundle landed in
`android/app/src/main/assets/public` (`bun scripts/verify-bundle.mjs`).

> ⚠️ **Never run `cap sync` without a fresh `bun run build` first.** The Android
> app loads its UI from the bundled assets inside the APK — if they are
> missing or stale, the app opens `https://localhost` (Capacitor's virtual
> origin for bundled assets — **not** a real server) and shows a browser-style
> "webpage not found" error. A correct build+sync produces an app that works
> fully offline for the splash, welcome, and login screens.

## Build Android APK

One command (verifies `VITE_CONVEX_URL`, builds, syncs, verifies the bundle,
then compiles the APK):

```bash
bun run mobile:build:android
```

Or step by step:

```bash
export VITE_CONVEX_URL=https://your-project.convex.cloud   # or set it in .env.local
bun run mobile:sync   # build + sync + verify (fails loudly if the bundle is missing)
cd android
./gradlew assembleDebug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

> **`VITE_CONVEX_URL` is required** for production/mobile builds. `mobile:build:android`
> and the GitHub Actions workflow refuse to produce an APK when it is missing —
> an APK without the backend URL can only show the local welcome screen.

Verify the APK actually contains the web bundle before distributing:

```bash
unzip -l android/app/build/outputs/apk/debug/app-debug.apk | grep "assets/public/index.html"
```

Release build (unsigned):

```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

## Build Android App Bundle (.aab)

```bash
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

The AAB requires a signed keystore to be usable on Google Play — see
[Release Signing](#release-signing).

## Generate App Icons & Splash Assets

Icons are generated from `src/assets/logo.svg`:

```bash
bun run mobile:icons
```

This rewrites all Android mipmaps, splash drawables, and the iOS AppIcon set
and splash images. Run it after changing the logo, then `npx cap sync`.

## Environment Variables

| Variable                  | Where       | Purpose                                  |
| ------------------------- | ----------- | ---------------------------------------- |
| `VITE_CONVEX_URL`         | Client      | Convex deployment URL (**required** for production & mobile builds) |
| `CONVEX_DEPLOYMENT`       | Backend     | Convex deployment ID                     |
| `JWKS` / `JWT_PRIVATE_KEY`| Backend     | Convex Auth signing keys                 |
| `SITE_URL`                | Backend     | Canonical site URL for auth redirects    |
| `VITE_VLY_APP_ID`         | Client      | Vly monitoring/analytics app id          |
| `VITE_VLY_MONITORING_URL` | Client      | Vly error-reporting endpoint             |

Copy `.env.example` to `.env.local` for local client values. **Never commit**
real keys. Backend secrets are managed through the platform's Keys/API keys UI.

`scripts/verify-convex-url.mjs` fails production/Android builds when
`VITE_CONVEX_URL` is missing — set it in `.env.local` for local builds and as a
`VITE_CONVEX_URL` repository secret in GitHub Actions. If the app is built
without it, it still starts (native splash → welcome screen), and only the
backend-dependent screens show the branded "Couldn't connect right now" state.

To get your deployment URL: open your project in the Convex dashboard
(`https://dashboard.convex.dev`) — the URL is `https://<project>.convex.cloud`.

## Push Notifications

Push support is wired into `src/lib/mobile.ts` (permission request,
registration, token storage, and tap-to-navigate deep linking). Delivery needs
Firebase Cloud Messaging, which requires your own Firebase project.

> **Safety guard (prevents a fatal crash).** Calling
> `PushNotifications.register()` on Android without Firebase configured throws
> a **fatal native exception** (`IllegalStateException: Default FirebaseApp is
> not initialized`) that no JavaScript try/catch can catch — the process dies.
> So push registration is **compiled out of the bundle** unless the native
> credentials exist at build time (detected automatically in `vite.config.ts`):
> `android/app/google-services.json` for Android, an APNs entitlement for
> iOS. Until then the app logs a `[VYBE_PUSH] disabled` warning and runs
> normally — just add the file(s) and rebuild to activate push, no code
> changes needed.

### Android (FCM)

1. Create a Firebase project and register the Android app with package
   `com.vybe.app`.
2. Download `google-services.json` and place it at `android/app/google-services.json`
   (gitignored — never commit it).
3. The app's `build.gradle` applies the Google Services plugin automatically
   when the file is present, and `vite.config.ts` detects it to enable the
   native `register()` call at the next web build.
4. Add a `route` field to notification payloads (e.g. `/app/chat/<matchId>`) so
   taps open the right screen.

### iOS (APNs)

1. In the Apple Developer portal, enable **Push Notifications** for the App ID
   `com.vybe.app` and generate an APNs auth key.
2. Add the APNs key to your Firebase project under **Cloud Messaging**.
3. Download `GoogleService-Info.plist` and add it to the `App` target in Xcode
   (gitignored).

Until FCM is configured, the app runs normally; only push delivery is absent.

## In-App Purchases

VYBE's subscription tiers (Silver, Gold, Platinum) are enforced server-side:
Convex is the source of truth for entitlements
(`src/convex/entitlements.ts`, `src/convex/subscriptions.ts`). The client never
unlocks premium features by itself.

Native billing (Google Play Billing / Apple StoreKit) requires your own
developer accounts:

1. **Google Play Console** — create the app with `com.vybe.app`, add the
   in-app products (Silver/Gold/Platinum monthly + annual).
2. **App Store Connect** — create the app with bundle id `com.vybe.app` and
   configure the same auto-renewable subscriptions.

A native billing bridge (e.g. RevenueCat or Capacitor billing plugins) can then
forward verified receipts to the Convex backend for entitlement checks. This
step is intentionally not simulated in the app.

## GitHub Actions

- **`.github/workflows/android-build.yml`** — on push/PR: installs
  dependencies, verifies `VITE_CONVEX_URL` (repository secret — the workflow
  fails with a clear message if it is missing, so an APK without a backend URL
  is never produced), regenerates Convex types (best-effort), typechecks,
  lints, builds the web app, syncs Capacitor, compiles the debug APK with the
  Android SDK, and uploads `app-debug.apk` as a build artifact. Fails the run
  if the APK cannot be built.
- **`.github/workflows/ios-check.yml`** — on push/PR (macOS runner):
  regenerates Convex types (best-effort), typechecks, builds the web app,
  syncs Capacitor, and compiles an **unsigned simulator build** with
  `xcodebuild` to validate the Xcode project. Real signed iOS builds require
  Apple certificates and run from a local Mac or a paid Apple runner.

> **Convex codegen note:** `src/convex/_generated/` is committed to the repo
> (Convex's recommended setup — your code won't typecheck without it) and is
> regenerated automatically by `bun convex dev --once` whenever Convex source
> files change. CI regenerates it best-effort and falls back to the committed
> types so typechecking never depends on Convex credentials.

## Release Signing

### Android

1. Generate a keystore (keep it private, store the password in your CI
   secrets):
   ```bash
   keytool -genkey -v -keystore vybe-release.keystore \
     -alias vybe -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Create `android/keystore.properties` (gitignored):
   ```properties
   storeFile=../vybe-release.keystore
   storePassword=***
   keyAlias=vybe
   keyPassword=***
   ```
3. The signing config is already wired into `android/app/build.gradle` — it
   reads `keystore.properties` when present and falls back to an unsigned
   release build otherwise. Then build `assembleRelease` / `bundleRelease`.
4. In GitHub Actions, add the keystore as a base64 secret and the passwords as
   secrets, then sign the release artifacts before upload.

### iOS

1. In Xcode → *Signing & Capabilities*, select your team and enable
   **Automatically manage signing**.
2. Set the bundle identifier to `com.vybe.app`.
3. Create the distribution profile in the Apple Developer portal and archive
   via **Product → Archive**, then upload to App Store Connect.

Never commit keystores, certificates, provisioning profiles, or
`google-services.json` / `GoogleService-Info.plist`.

## App Configuration Reference

- **App IDs**: `com.vybe.app` (Android `applicationId` + iOS bundle id) —
  set in `capacitor.config.ts` and synced into both native projects.
- **Android permissions** (`android/app/src/main/AndroidManifest.xml`):
  internet, camera, coarse+fine location, notifications, photo library
  (Android 13+ / legacy), vibration. Permissions are requested contextually in
  the app, never all at launch.
- **iOS permissions** (`ios/App/App/Info.plist`): camera, photo library
  (read + add), location (when-in-use + always), remote notifications with
  user-facing usage strings.
- **Dark mode**: the app defaults to a deep-dark theme
  (`#0b0b12` background, violet/pink accents) with light mode supported.
- **Safe areas**: handled via `env(safe-area-inset-*)` utilities and Capacitor
  status bar overlays.

## VYBE Feature Map

| Screen        | Purpose                                                        |
| ------------- | -------------------------------------------------------------- |
| Landing `/`   | Brand landing with sign-in / sign-up CTAs                       |
| Auth `/auth`  | Apple / Google / Email OTP sign-in                              |
| Onboarding    | Step-by-step profile setup (name, DOB, gender, photos, bio...)  |
| Discover      | Card-based profile discovery with swipe + Super VYBE            |
| Matches       | Mutual matches with verified badges                             |
| Messages      | Conversations, read receipts, verified badges                   |
| Activity      | Likes / notifications feed                                      |
| Profile       | Own profile, edit, Boost, Question of the Day                   |
| Premium       | Silver / Gold / Platinum subscription plans                     |
| Verify        | Live-camera liveness verification with randomized challenges    |

## Contributing & Conventions

- Use Bun for installs and scripts.
- Typecheck: `bun tsc -b --noEmit` · Lint: `bun run lint`
- Convex functions live in `src/convex/`; run `bun convex dev --once` to
  regenerate types after schema changes.
- Never hand-edit `src/convex/_generated/*`.
- Keep the app mobile-first: bottom tab navigation, swipe gestures, native
  sheets, safe-area aware, dark mode primary.
