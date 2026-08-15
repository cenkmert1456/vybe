import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.vybe.app",
  appName: "VYBE",
  webDir: "dist",
  // VYBE is a PWA-first app; Capacitor serves the built Vite output.
  server: {
    androidScheme: "https",
    iosScheme: "capacitor",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    // Android 13+ notification runtime permission handled by the app.
    backgroundColor: "#0b0b12",
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#0b0b12",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: "#0b0b12",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      overlaysWebView: true,
      style: "DARK",
      backgroundColor: "#0b0b12",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
    // Real push notifications require Firebase Cloud Messaging credentials.
    // See README "Push Notifications" for the exact setup steps.
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Haptics: {
      // Native haptic feedback on supported devices.
    },
    Camera: {
      // Native camera + photo library access.
      saveToGallery: false,
      allowEditing: false,
      presentationStyle: "fullscreen",
    },
    Geolocation: {
      // Coarse location by default; the app asks for precise only when needed.
    },
  },
};

export default config;
