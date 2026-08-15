/// <reference types="vite/client" />

// Compile-time constants injected by vite.config.ts (`define`) — detect whether
// native push credentials exist for THIS build (google-services.json on
// Android, APNs entitlement on iOS). See vite.config.ts for how they are set.
// They are replaced with real booleans at build time; the app must never call
// PushNotifications.register() when they are false (fatal native crash on
// Android without Firebase).
declare const __VYBE_PUSH_ENABLED_ANDROID__: boolean;
declare const __VYBE_PUSH_ENABLED_IOS__: boolean;
