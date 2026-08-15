import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { Gate } from "@/components/Gate";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { InstrumentationProvider } from "./instrumentation.tsx";
import { ConnectionError } from "@/components/ConnectionError";
import { ThemeProvider } from "next-themes";
import React, { StrictMode, lazy, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";
import { I18nProvider } from "@/lib/i18n";
import { LogoMark } from "@/components/Logo";
import { DiagnosticScreen } from "@/components/DiagnosticScreen";
import { installGlobalErrorLogging, startupLog } from "@/lib/startup-log";
import { initMobilePlatform, onNativeNavigate } from "@/lib/mobile";
import "./index.css";

// --------------------------------------------------------------------------
// Startup diagnostics — every marker is visible in logcat on a real device
// (`adb logcat | findstr VYBE`), so a crash can be pinned to the exact phase.
// --------------------------------------------------------------------------
installGlobalErrorLogging();
startupLog("START");
if (typeof document !== "undefined") {
  startupLog(
    "WEBVIEW_READY",
    `readyState=${document.readyState} userAgent=${navigator.userAgent.slice(0, 80)}`,
  );
}

// Crash-isolation diagnostic mode: renders a static screen with NO backend,
// NO native plugins, NO auth, NO router, NO analytics. Bake with
// VITE_DIAGNOSTIC_MODE=1 (or open the web preview with ?diag=1).
const DIAGNOSTIC_MODE =
  import.meta.env.VITE_DIAGNOSTIC_MODE === "1" ||
  (typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("diag"));

// Native-only setup (status bar, splash, deep links, push notifications).
// No-ops when running as a plain web app. Wrapped so no native plugin call
// can ever abort module evaluation and blank out the app on a device.
if (!DIAGNOSTIC_MODE) {
  try {
    initMobilePlatform();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[VYBE_START] native init threw:", err);
    startupLog("NATIVE_INIT_ERROR", String(err));
  }
}

// The dev toolbar is a platform tool (web preview only). It is lazy-loaded so
// its heavy snapshot library never ships in the mobile startup path.
const VlyToolbar = lazy(() =>
  import("../vly-toolbar-readonly.tsx").then((m) => ({
    default: m.VlyToolbar,
  })),
);

const Landing = lazy(() => import("./pages/Landing.tsx"));
const StaticLanding = lazy(() =>
  import("./pages/Landing.tsx").then((m) => ({ default: m.StaticLanding })),
);
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Onboarding = lazy(() => import("./pages/Onboarding.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const AppShell = lazy(() =>
  import("@/components/mobile/AppShell").then((m) => ({ default: m.AppShell })),
);
const Discover = lazy(() => import("./app/Discover.tsx"));
const Matches = lazy(() => import("./app/Matches.tsx"));
const Messages = lazy(() => import("./app/Messages.tsx"));
const Activity = lazy(() => import("./app/Activity.tsx"));
const MyProfile = lazy(() => import("./app/MyProfile.tsx"));
const ProfileDetail = lazy(() => import("./app/ProfileDetail.tsx"));
const MatchMoment = lazy(() => import("./app/MatchMoment.tsx"));
const Chat = lazy(() => import("./app/Chat.tsx"));
const EditProfile = lazy(() => import("./app/EditProfile.tsx"));
const Settings = lazy(() => import("./app/Settings.tsx"));
const Premium = lazy(() => import("./app/Premium.tsx"));
const Verify = lazy(() => import("./app/Verify.tsx"));
const DiscoveryPrefs = lazy(() => import("./app/DiscoveryPrefs.tsx"));
const SafetyCenter = lazy(() => import("./app/SafetyCenter.tsx"));
const Events = lazy(() => import("./app/Events.tsx"));
const DatePlans = lazy(() => import("./app/DatePlans.tsx"));
const DailyVibe = lazy(() => import("./app/DailyVibe.tsx"));
const Mood = lazy(() => import("./app/Mood.tsx"));
const DatingCoach = lazy(() => import("./app/DatingCoach.tsx"));
const BlindMatch = lazy(() => import("./app/BlindMatch.tsx"));
const Games = lazy(() => import("./app/Games.tsx"));
const Rooms = lazy(() => import("./app/Rooms.tsx"));
const RoomDetailLazy = lazy(() =>
  import("./app/Rooms.tsx").then((m) => ({ default: m.RoomDetail })),
);
const Referral = lazy(() => import("./app/Referral.tsx"));

/** /app/rooms/:roomId — renders the room chat detail. */
function RoomDetailRoute() {
  const { roomId } = useParams();
  return <RoomDetailLazy roomId={roomId ?? ""} />;
}

/**
 * Registers the device push token with the backend once the app shell is up
 * (only when this build actually has native push enabled). Graceful no-op
 * otherwise — push stays off, the app never depends on it.
 */
function PushSync() {
  const register = useMutation(api.pushNotifications.registerDeviceToken);
  useEffect(() => {
    const sync = async () => {
      try {
        const { getPushToken } = await import("@/lib/mobile");
        const token = await getPushToken();
        if (!token) return;
        await register({ token, platform: "android" });
      } catch {
        /* non-fatal */
      }
    };
    void sync();
  }, [register]);
  return null;
}

function RouteLoading() {
  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <LogoMark size={56} className="animate-[pulse_1.5s_ease-in-out_infinite]" />
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/**
 * Hard guard so runtime errors never leave the app as a blank screen or a
 * silent close. Shows a branded, non-browser error state with a working
 * retry — no technical stack traces exposed to users.
 */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.error("[VYBE] Root crash caught:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <ConnectionError
          title="Something went wrong"
          message="The app hit an unexpected problem. Your data is safe — try again."
          onRetry={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}

/**
 * Create the Convex client defensively. A missing or invalid
 * VITE_CONVEX_URL must never crash startup: instead of throwing at module
 * scope (which no error boundary can catch and leaves a blank screen), we
 * return null and render a friendly retry screen.
 */
function createConvexClient(): ConvexReactClient | null {
  const url = import.meta.env.VITE_CONVEX_URL;
  if (typeof url !== "string" || !url.trim()) {
    startupLog("CONVEX_CLIENT", "missing VITE_CONVEX_URL");
    return null;
  }
  try {
    const client = new ConvexReactClient(url.trim());
    startupLog("CONVEX_CLIENT", "ok");
    return client;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[VYBE] Convex client initialization failed:", err);
    startupLog("CONVEX_CLIENT", `error ${String(err)}`);
    return null;
  }
}

/**
 * Branded fallback for backend-dependent routes when Convex is unavailable
 * (an APK built without VITE_CONVEX_URL, or a backend that cannot be
 * reached). Never a browser error page and never a crash — just a retry.
 */
function ConnectFallback() {
  return (
    <ConnectionError
      title="Couldn't connect right now"
      message="The app needs a connection to the VYBE backend to start. Check your connection and try again."
      onRetry={() => window.location.reload()}
    />
  );
}

/**
 * Routes. In degraded mode (no Convex client at build time) the local,
 * network-free welcome screen still renders — only backend-dependent screens
 * show the branded connect state. Startup order is preserved everywhere:
 * native splash → local welcome → React UI stable → backend init.
 */
function AppRoutes({ degraded }: { degraded: boolean }) {
  if (degraded) {
    return (
      <Routes>
        <Route path="/" element={<StaticLanding />} />
        <Route path="*" element={<ConnectFallback />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/auth"
        element={<AuthPage redirectAfterAuth="/app/discover" />}
      />
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <Onboarding />
          </RequireAuth>
        }
      />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <Gate>
              <AppShell />
            </Gate>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/app/discover" replace />} />
        <Route path="discover" element={<Discover />} />
        <Route path="matches" element={<Matches />} />
        <Route path="messages" element={<Messages />} />
        <Route path="activity" element={<Activity />} />
        <Route path="profile" element={<MyProfile />} />
      </Route>
      <Route
        path="/app/chat/:matchId"
        element={
          <RequireAuth>
            <Gate>
              <Chat />
            </Gate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/match/:matchId"
        element={
          <RequireAuth>
            <Gate>
              <MatchMoment />
            </Gate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/profile/:profileId"
        element={
          <RequireAuth>
            <Gate>
              <ProfileDetail />
            </Gate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/edit"
        element={
          <RequireAuth>
            <Gate>
              <EditProfile />
            </Gate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/settings"
        element={
          <RequireAuth>
            <Gate>
              <Settings />
            </Gate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/premium"
        element={
          <RequireAuth>
            <Gate>
              <Premium />
            </Gate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/verify"
        element={
          <RequireAuth>
            <Gate>
              <Verify />
            </Gate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/prefs"
        element={
          <RequireAuth>
            <Gate>
              <DiscoveryPrefs />
            </Gate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/safety"
        element={
          <RequireAuth>
            <Gate>
              <SafetyCenter />
            </Gate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/events"
        element={
          <RequireAuth>
            <Gate>
              <Events />
            </Gate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/dateplans"
        element={
          <RequireAuth>
            <Gate>
              <DatePlans />
            </Gate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/daily"
        element={
          <RequireAuth>
            <Gate>
              <DailyVibe />
            </Gate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/mood"
        element={
          <RequireAuth>
            <Gate>
              <Mood />
            </Gate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/coach"
        element={
          <RequireAuth>
            <Gate>
              <DatingCoach />
            </Gate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/blind"
        element={
          <RequireAuth>
            <Gate>
              <BlindMatch />
            </Gate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/games"
        element={
          <RequireAuth>
            <Gate>
              <Games />
            </Gate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/rooms"
        element={
          <RequireAuth>
            <Gate>
              <Rooms />
            </Gate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/rooms/:roomId"
        element={
          <RequireAuth>
            <Gate>
              <RoomDetailRoute />
            </Gate>
          </RequireAuth>
        }
      />
      <Route
        path="/app/referral"
        element={
          <RequireAuth>
            <Gate>
              <Referral />
            </Gate>
          </RequireAuth>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

/** Logs the first React commit so logcat shows how far startup got. */
function StartupMarker() {
  useEffect(() => {
    startupLog("REACT_RENDERED");
  }, []);
  return null;
}

function RouteSyncer() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Deep links + push notification taps on native platforms.
  useEffect(() => onNativeNavigate((path) => navigate(path)), [navigate]);

  return null;
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  // eslint-disable-next-line no-console
  console.error("[VYBE_JS_ERROR] #root element missing from index.html");
} else if (DIAGNOSTIC_MODE) {
  // Crash-isolation mode: bare-bones static screen, nothing else runs.
  startupLog("REACT_START", "diagnostic mode");
  createRoot(rootElement).render(<DiagnosticScreen />);
  startupLog("REACT_RENDERED", "diagnostic mode");
} else {
  startupLog("REACT_START");
  // Create the Convex client once, defensively (null when VITE_CONVEX_URL is
  // missing or invalid). With a client the whole app gets auth + backend;
  // without one, AppRoutes runs in degraded mode so the local welcome screen
  // still renders and backend routes show the branded connect screen instead
  // of crashing.
  const convexClient = createConvexClient();
  createRoot(rootElement).render(
  <StrictMode>
    <RootErrorBoundary>
      <InstrumentationProvider>
        <ToolbarErrorBoundary>
          <Suspense fallback={null}>
            <VlyToolbar />
          </Suspense>
        </ToolbarErrorBoundary>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <I18nProvider>
              <BrowserRouter>
                <StartupMarker />
                <RouteSyncer />
                <Suspense fallback={<RouteLoading />}>
                  {convexClient ? (
                    <ConvexAuthProvider client={convexClient}>
                      <PushSync />
                      <AppRoutes degraded={false} />
                    </ConvexAuthProvider>
                  ) : (
                    <AppRoutes degraded={true} />
                  )}
                </Suspense>
              </BrowserRouter>
              <Toaster position="top-center" />
            </I18nProvider>
          </ThemeProvider>
      </InstrumentationProvider>
    </RootErrorBoundary>
  </StrictMode>,
  );
}
