import { api } from "@/convex/_generated/api";
import { useConvex, useQuery } from "convex/react";
import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router";
import { LogoMark } from "@/components/Logo";
import { ConnectionError } from "@/components/ConnectionError";
import { useI18n } from "@/lib/i18n";
import { startupLog } from "@/lib/startup-log";

/**
 * How long to wait before concluding the backend is unreachable. Covers both
 * a cold start with no network and a connection that drops mid-session.
 */
const OFFLINE_TIMEOUT_MS = 8000;

export function Gate({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const client = useConvex();
  const myProfile = useQuery(api.profiles.myProfile);
  const [offline, setOffline] = useState(false);

  // Watch the live Convex connection state. If the backend never connects
  // (or stays disconnected) past the grace window, show the branded offline
  // screen with a retry action instead of an endless spinner.
  useEffect(() => {
    let lastConnectedAt = 0;
    const check = () => {
      const cs = client.connectionState();
      if (cs.isWebSocketConnected) {
        lastConnectedAt = Date.now();
        setOffline(false);
      } else if (lastConnectedAt !== 0) {
        const downFor = Date.now() - lastConnectedAt;
        if (downFor > OFFLINE_TIMEOUT_MS) {
          startupLog("BACKEND_OFFLINE", `disconnected for ${downFor}ms`);
          setOffline(true);
        }
      }
    };
    check();
    // Initial-connection grace period (never connected yet).
    const initialTimer = window.setTimeout(() => {
      if (lastConnectedAt === 0) {
        startupLog("BACKEND_OFFLINE", "never connected");
        setOffline(true);
      }
    }, OFFLINE_TIMEOUT_MS);
    const interval = window.setInterval(check, 1500);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [client]);

  // Log once when the first backend query resolves — logcat proof that
  // Convex connected and the authenticated shell is reachable. Must be
  // declared unconditionally: hooks cannot come after an early return, or
  // React throws "rendered more hooks than during the previous render".
  useEffect(() => {
    if (myProfile !== undefined) startupLog("BACKEND_INIT", "connected");
  }, [myProfile]);

  if (offline) {
    return (
      <ConnectionError
        title={t("common.offlineTitle")}
        message={t("common.offlineDesc")}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (myProfile === undefined) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <LogoMark size={64} className="animate-[pulse_1.5s_ease-in-out_infinite]" />
          <div className="h-1 w-24 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/2 animate-pulse rounded-full vybe-gradient" />
          </div>
        </div>
      </div>
    );
  }

  if (!myProfile || !myProfile.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
