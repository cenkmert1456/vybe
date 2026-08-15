import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { LogoMark } from "@/components/Logo";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { startupLog } from "@/lib/startup-log";
import { useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/* Splash — premium, fast, network-free. ~1.7s + soft fade.            */
/* ------------------------------------------------------------------ */

function SplashScreen({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    const timer = window.setTimeout(onDone, 1350);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/15 blur-[90px]" />
      </div>
      <svg width="106" height="106" viewBox="0 0 64 64" fill="none" aria-hidden="true" className="overflow-visible">
        <defs>
          <linearGradient id="splash-v" x1="12" y1="12" x2="52" y2="54" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8B5CF6" />
            <stop offset="0.55" stopColor="#C026D3" />
            <stop offset="1" stopColor="#FF5FA2" />
          </linearGradient>
          <linearGradient id="splash-dot" x1="27" y1="45" x2="37" y2="57" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF5FA2" />
            <stop offset="1" stopColor="#38BDF8" />
          </linearGradient>
        </defs>
        <motion.path
          d="M13 14 C 25 19, 30.5 33, 32 46"
          stroke="url(#splash-v)"
          strokeWidth="8.5"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeInOut", delay: 0.08 }}
        />
        <motion.path
          d="M51 14 C 39 19, 33.5 33, 32 46"
          stroke="url(#splash-v)"
          strokeWidth="8.5"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeInOut", delay: 0.22 }}
        />
        <motion.circle
          cx="32"
          cy="51.5"
          r="3"
          fill="url(#splash-dot)"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative mt-6 font-display text-2xl font-bold tracking-[0.24em]"
      >
        VYBE
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.75 }}
        className="relative mt-2 text-[13px] font-medium text-muted-foreground"
      >
        {t("landing.splashTagline")}
      </motion.p>
      {/* Glowing progress bar (matches brand reference) — purely decorative */}
      <div className="absolute bottom-16 left-0 right-0 flex justify-center">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.28, ease: "easeInOut", delay: 0.1 }}
          className="h-[3px] w-40 origin-left overflow-hidden rounded-full bg-white/10"
        >
          <div className="h-full w-full rounded-full vybe-gradient shadow-glow" />
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Abstract visuals (offline-safe — no external images)                */
/* ------------------------------------------------------------------ */

function ConnectionVisual() {
  const nodes = [
    { x: 60, y: 84, r: 10 },
    { x: 172, y: 46, r: 14 },
    { x: 268, y: 92, r: 9 },
    { x: 116, y: 168, r: 11 },
    { x: 232, y: 178, r: 13 },
    { x: 166, y: 116, r: 20 },
  ];
  return (
    <svg viewBox="0 0 320 220" className="w-72" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="conn-grad" x1="60" y1="60" x2="260" y2="200" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#FF5FA2" />
        </linearGradient>
      </defs>
      {/* connection lines */}
      {[
        [0, 1],
        [1, 5],
        [5, 2],
        [1, 3],
        [5, 4],
        [0, 3],
        [3, 4],
      ].map(([a, b], i) => (
        <motion.line
          key={i}
          x1={nodes[a].x}
          y1={nodes[a].y}
          x2={nodes[b].x}
          y2={nodes[b].y}
          stroke="url(#conn-grad)"
          strokeWidth="1.6"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.5 }}
          transition={{ duration: 0.7, delay: 0.15 + i * 0.08 }}
        />
      ))}
      {/* nodes */}
      {nodes.map((n, i) => (
        <motion.circle
          key={i}
          cx={n.x}
          cy={n.y}
          r={n.r}
          fill={i === 5 ? "url(#conn-grad)" : "#1B1B26"}
          stroke={i === 5 ? "none" : "rgba(139,92,246,0.55)"}
          strokeWidth="2"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.3 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
      {/* center pulse ring */}
      <motion.circle
        cx={nodes[5].x}
        cy={nodes[5].y}
        r={20}
        stroke="rgba(192,38,211,0.5)"
        strokeWidth="1.5"
        initial={{ opacity: 0.7, scale: 1 }}
        animate={{ opacity: 0, scale: 1.8 }}
        transition={{ repeat: Infinity, duration: 2.4, ease: "easeOut", delay: 1 }}
      />
    </svg>
  );
}

function SafetyVisual() {
  return (
    <div className="relative flex h-52 w-52 items-center justify-center">
      <motion.div
        className="absolute inset-0 rounded-full bg-violet-600/15 blur-2xl"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute inset-6 rounded-full border border-violet-500/25"
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
      />
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex size-24 items-center justify-center rounded-[1.75rem] border border-white/10 bg-card shadow-glow"
      >
        <ShieldCheck className="size-11 text-primary" strokeWidth={1.8} />
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Welcome flow — 3 short, skippable intro screens                     */
/* ------------------------------------------------------------------ */

type WelcomeStep = 0 | 1 | 2;

const slide: Record<string, unknown> = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
};

function WelcomeFlow() {
  const { t } = useI18n();
  const [step, setStep] = useState<WelcomeStep>(0);

  const visual =
    step === 0 ? (
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      >
        <LogoMark size={132} />
      </motion.div>
    ) : step === 1 ? (
      <ConnectionVisual />
    ) : (
      <SafetyVisual />
    );

  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-md flex-col px-6 pt-safe">
      {/* Top bar: wordmark + skip */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <LogoMark size={26} variant="mark" />
          <span className="font-display text-base font-bold tracking-[0.2em]">VYBE</span>
        </div>
        <button
          type="button"
          onClick={() => setStep(2)}
          className="rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground active:bg-muted"
        >
          {t("landing.skip")}
        </button>
      </div>

      {/* Slide content */}
      <div className="flex flex-1 flex-col">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            {...slide}
            className="flex flex-1 flex-col items-center justify-center pb-6 text-center"
          >
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((step - 1) as WelcomeStep)}
                aria-label={t("common.back")}
                className="absolute left-1 top-1 flex size-10 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
              >
                <ArrowLeft className="size-5" />
              </button>
            )}
            {visual}
            <h1
              className={
                step === 0
                  ? "mt-8 font-display text-4xl font-bold tracking-tight"
                  : "mt-8 font-display text-3xl font-bold tracking-tight"
              }
            >
              {step === 0
                ? t("landing.welcomeTitle")
                : step === 1
                  ? t("landing.screen2Title")
                  : t("landing.screen3Title")}
            </h1>
            <p className="mt-3 max-w-[17rem] text-sm leading-relaxed text-muted-foreground">
              {step === 0
                ? t("landing.welcomeSub")
                : step === 1
                  ? t("landing.screen2Desc")
                  : t("landing.screen3Desc")}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom: dots + primary CTA */}
      <div className="pb-safe pb-8">
        <div className="mb-6 flex items-center justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              type="button"
              aria-label={`Step ${i + 1}`}
              onClick={() => setStep(i as WelcomeStep)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? "w-6 vybe-gradient"
                  : "w-1.5 bg-muted-foreground/25"
              }`}
            />
          ))}
        </div>
        <Link
          to="/auth"
          className="group flex min-h-13 w-full items-center justify-center gap-2 rounded-full vybe-gradient px-6 text-base font-bold text-white shadow-glow transition-transform active:scale-[0.98]"
        >
          {step === 0 ? t("landing.getStarted") : t("landing.continue")}
          <ArrowRight className="size-5 transition-transform group-active:translate-x-0.5" />
        </Link>
        {step === 0 && (
          <Link
            to="/auth"
            className="mt-4 block w-full text-center text-sm font-semibold text-muted-foreground"
          >
            {t("landing.logIn")}
          </Link>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Compact hero for already-authenticated visitors                     */
/* ------------------------------------------------------------------ */

function AuthedHero() {
  const { t } = useI18n();
  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-600/20 blur-[90px]" />
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <LogoMark size={96} />
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="relative mt-7 font-display text-3xl font-bold tracking-tight"
      >
        {t("landing.welcomeTitle")}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="relative mt-3 max-w-[17rem] text-sm leading-relaxed text-muted-foreground"
      >
        {t("landing.welcomeSub")}
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45 }}
        className="relative mt-8 w-full max-w-xs"
      >
        <Link
          to="/app/discover"
          className="flex min-h-13 w-full items-center justify-center gap-2 rounded-full vybe-gradient px-6 text-base font-bold text-white shadow-glow transition-transform active:scale-[0.98]"
        >
          {t("landing.openApp")}
          <ArrowRight className="size-5" />
        </Link>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Landing                                                             */
/* ------------------------------------------------------------------ */

/**
 * Pure entry experience — splash + welcome flow. Contains NO backend, auth,
 * or network dependency: it must always render, even on a fresh install with
 * no backend reachable, so the app never shows a blank screen or crashes.
 */
function LandingShell({ authed }: { authed: boolean }) {
  // logcat proof that the entry screen mounted (splash + welcome are
  // network-free, so reaching this marker means the bundle is healthy).
  useEffect(() => {
    startupLog("WELCOME_VISIBLE");
  }, []);

  const [showSplash, setShowSplash] = useState(() => {
    try {
      if (sessionStorage.getItem("vybe-splash-seen")) return false;
      sessionStorage.setItem("vybe-splash-seen", "1");
      return true;
    } catch {
      return false;
    }
  });

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <AnimatePresence>
        {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      </AnimatePresence>

      {authed ? <AuthedHero /> : <WelcomeFlow />}
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();
  return <LandingShell authed={isAuthenticated && !isLoading} />;
}

/**
 * Convex-free variant used when the backend is unavailable (e.g. an APK built
 * without VITE_CONVEX_URL). The welcome screen must still show; only the
 * backend-dependent routes degrade to the branded connect screen.
 */
export function StaticLanding() {
  return <LandingShell authed={false} />;
}
