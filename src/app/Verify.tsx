import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { useI18n, type TKey } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { ScreenHeader } from "@/components/mobile/ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  BadgeCheck,
  Camera,
  Check,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { runLiveness, type ChallengeType } from "@/lib/liveness";
import {
  requestCameraPermission,
  openAppSettings,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";

const CHALLENGE_KEYS: Record<ChallengeType, TKey> = {
  blink: "verify.challenge.blink",
  turn_left: "verify.challenge.turn_left",
  turn_right: "verify.challenge.turn_right",
  look_up: "verify.challenge.look_up",
  look_down: "verify.challenge.look_down",
  smile: "verify.challenge.smile",
};

type Mode =
  | "intro"
  | "requesting"
  | "live"
  | "analyzing"
  | "success"
  | "failed"
  | "denied";

export default function Verify() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const status = useQuery(api.verification.myVerification);
  const start = useMutation(api.verification.startVerification);
  const retry = useMutation(api.verification.retryVerification);
  const submit = useMutation(api.verification.submitLiveness);

  const [mode, setMode] = useState<Mode>("intro");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<ChallengeType[]>([]);
  const [lastScore, setLastScore] = useState(0);

  // Entry state derived from the backend.
  useEffect(() => {
    if (!status) return;
    if (status.verified) setMode("success");
    else if (status.status === "failed") setMode("failed");
    else setMode("intro");
  }, [status]);

  const beginSession = useCallback(
    async (useRetry: boolean) => {
      try {
        // Request camera only when the user actually starts verification.
        const perm = await requestCameraPermission();
        if (perm !== "granted") {
          setMode("denied");
          return;
        }
        setMode("requesting");
        const res = useRetry ? await retry() : await start();
        setSessionId(res.sessionId);
        setChallenges((res.challengeSequence ?? []) as ChallengeType[]);
        setMode("live");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("common.error"));
        setMode(status?.status === "failed" ? "failed" : "intro");
      }
    },
    [start, retry, t, status],
  );

  const finish = async (
    results: string[],
    capturedAt: number[],
    score: number,
    frames: number,
    durationMs: number,
  ) => {
    if (!sessionId) return;
    setMode("analyzing");
    try {
      const res = await submit({
        sessionId: sessionId as any,
        results,
        capturedAt,
        score,
        frames,
        durationMs,
      });
      setLastScore(res.score);
      haptic(res.status === "verified" ? "success" : "error");
      setMode(res.status === "verified" ? "success" : "failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
      setMode("failed");
    }
  };

  const cancelToIntro = () => {
    // Cancelling never marks the user as failed.
    setSessionId(null);
    setChallenges([]);
    setMode(status?.status === "failed" ? "failed" : "intro");
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ScreenHeader title={t("verify.title")} onBack={() => navigate(-1)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
            className="flex flex-1 flex-col"
          >
            {mode === "intro" && (
              <IntroView
                verified={status?.verified ?? false}
                onStart={() => void beginSession(false)}
                onBack={() => navigate(-1)}
              />
            )}
            {mode === "live" && challenges.length > 0 && (
              <CameraFlow
                challenges={challenges}
                onCancel={cancelToIntro}
                onComplete={(r, c, s, f, d) => void finish(r, c, s, f, d)}
              />
            )}
            {mode === "requesting" && (
              <Centered>
                <Loader2 className="size-7 animate-spin text-primary" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("common.loading")}
                </p>
              </Centered>
            )}
            {mode === "analyzing" && (
              <Centered>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
                  className="flex size-16 items-center justify-center rounded-full vybe-gradient shadow-glow"
                >
                  <ShieldCheck className="size-8 text-white" />
                </motion.div>
                <p className="mt-4 font-display text-lg font-bold">
                  {t("verify.live.analyzing")}
                </p>
              </Centered>
            )}
            {mode === "denied" && (
              <DeniedView
                onRetry={() => void beginSession(false)}
                onBack={cancelToIntro}
              />
            )}
            {mode === "success" && (
              <SuccessView score={lastScore} onDone={() => navigate(-1)} />
            )}
            {mode === "failed" && (
              <FailedView
                score={lastScore}
                onRetry={() => void beginSession(true)}
                onBack={() => navigate(-1)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      {children}
    </div>
  );
}

function IntroView({
  verified,
  onStart,
  onBack,
}: {
  verified: boolean;
  onStart: () => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  if (verified) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="flex size-20 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"
        >
          <BadgeCheck className="size-10" />
        </motion.div>
        <h2 className="mt-5 font-display text-2xl font-bold">
          {t("verify.success.title")}
        </h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          {t("verify.success.desc")}
        </p>
        <Button
          onClick={onBack}
          className="mt-7 h-12 w-full max-w-xs rounded-full vybe-gradient text-base font-bold text-white shadow-glow"
        >
          {t("common.done")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-6 pb-safe pt-6">
      <div className="rounded-3xl border border-border/70 bg-card/60 p-6">
        <div className="flex size-14 items-center justify-center rounded-2xl vybe-gradient shadow-glow">
          <ShieldCheck className="size-7 text-white" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold">
          {t("verify.consent.title")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("verify.consent.desc")}
        </p>

        <div className="mt-5 flex flex-col gap-3">
          <InfoRow icon={<Camera className="size-4" />} text={t("verify.consent.camera")} />
          <InfoRow icon={<ShieldCheck className="size-4" />} text={t("verify.consent.privacy")} />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        <Button
          onClick={onStart}
          className="h-13 w-full rounded-full vybe-gradient text-base font-bold text-white shadow-glow"
        >
          <ShieldCheck className="size-5" />
          {t("verify.consent.start")}
        </Button>
        <Button
          variant="ghost"
          onClick={onBack}
          className="h-12 w-full rounded-full text-sm font-semibold text-muted-foreground"
        >
          {t("common.back")}
        </Button>
      </div>
    </div>
  );
}

function InfoRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-3 text-[13px] leading-snug text-foreground/90">
      <span className="mt-0.5 shrink-0 text-primary">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function DeniedView({
  onRetry,
  onBack,
}: {
  onRetry: () => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  return (
    <Centered>
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Camera className="size-8" />
      </div>
      <h2 className="mt-4 font-display text-lg font-bold">
        {t("verify.denied.title")}
      </h2>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
        {t("verify.denied.desc")}
      </p>
      <Button
        onClick={onRetry}
        className="mt-6 h-12 w-full max-w-xs rounded-full vybe-gradient text-base font-bold text-white shadow-glow"
      >
        <Camera className="size-5" />
        {t("common.retry")}
      </Button>
      <Button
        variant="outline"
        onClick={openAppSettings}
        className="mt-2.5 h-12 w-full max-w-xs rounded-full border-border bg-card text-sm font-semibold"
      >
        {t("verify.openSettings")}
      </Button>
      <Button
        variant="ghost"
        onClick={onBack}
        className="mt-1 h-11 w-full max-w-xs rounded-full text-sm font-semibold text-muted-foreground"
      >
        {t("common.cancel")}
      </Button>
    </Centered>
  );
}

function SuccessView({ score, onDone }: { score: number; onDone: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="relative"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: [0.4, 1.6, 1] }}
          transition={{ duration: 0.9, times: [0, 0.6, 1] }}
          className="flex size-24 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"
        >
          <BadgeCheck className="size-12" />
        </motion.div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], scale: [0, 1, 0.4], y: [-6, -26] }}
            transition={{ delay: 0.35 + i * 0.08, duration: 0.7 }}
            className="absolute -top-1 text-sm"
            style={{
              left: `${6 + i * 17}%`,
            }}
          >
            ✨
          </motion.span>
        ))}
      </motion.div>
      <h2 className="mt-5 font-display text-2xl font-bold">
        {t("verify.success.title")}
      </h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        {t("verify.success.desc")}
      </p>
      <div className="mt-4 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary">
        {t("verify.score", { score })}
      </div>
      <Button
        onClick={onDone}
        className="mt-7 h-12 w-full max-w-xs rounded-full vybe-gradient text-base font-bold text-white shadow-glow"
      >
        {t("common.done")}
      </Button>
    </div>
  );
}

function FailedView({
  score,
  onRetry,
  onBack,
}: {
  score: number;
  onRetry: () => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive"
      >
        <X className="size-8" />
      </motion.div>
      <h2 className="mt-4 font-display text-lg font-bold">
        {t("verify.failed.title")}
      </h2>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
        {t("verify.failed.desc")}
      </p>
      {score > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t("verify.score", { score })}
        </p>
      )}
      <Button
        onClick={onRetry}
        className="mt-6 h-12 w-full max-w-xs rounded-full vybe-gradient text-base font-bold text-white shadow-glow"
      >
        <ShieldCheck className="size-5" />
        {t("verify.retry")}
      </Button>
      <Button
        variant="ghost"
        onClick={onBack}
        className="mt-1 h-11 w-full max-w-xs rounded-full text-sm font-semibold text-muted-foreground"
      >
        {t("common.back")}
      </Button>
    </div>
  );
}

function CameraFlow({
  challenges,
  onCancel,
  onComplete,
}: {
  challenges: ChallengeType[];
  onCancel: () => void;
  onComplete: (
    results: string[],
    capturedAt: number[],
    score: number,
    frames: number,
    durationMs: number,
  ) => void;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [stepDone, setStepDone] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [multiFace, setMultiFace] = useState(false);
  const [faceLost, setFaceLost] = useState(false);
  const startedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const faceLostTimer = useRef<number | null>(null);

  const handleChallenge = useCallback((idx: number, done: boolean) => {
    setStepIdx(idx);
    setStepDone(done);
    if (done) haptic("light");
  }, []);

  const handleFrame = useCallback(
    (info: { faceDetected: boolean; multiFace: boolean }) => {
      setFaceDetected(info.faceDetected);
      setMultiFace(info.multiFace);
      if (info.multiFace) {
        setFaceLost(false);
      } else if (info.faceDetected) {
        setFaceLost(false);
        if (faceLostTimer.current) {
          window.clearTimeout(faceLostTimer.current);
          faceLostTimer.current = null;
        }
      } else {
        // Graceful "look back at the camera" warning after a short streak.
        if (!faceLostTimer.current) {
          faceLostTimer.current = window.setTimeout(() => setFaceLost(true), 900);
        }
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
      } catch {
        onCancel();
      }
    };
    void start();
    return () => {
      cancelled = true;
      if (faceLostTimer.current) window.clearTimeout(faceLostTimer.current);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = () => {
    const video = videoRef.current;
    if (!video || startedRef.current) return;
    startedRef.current = true;
    void runLiveness(video, challenges, {
      onChallenge: handleChallenge,
      onFrame: handleFrame,
    }).then((out) => {
      onComplete(out.results, out.capturedAt, out.score, out.frames, out.durationMs);
    });
  };

  const progress = (Math.min(stepIdx, challenges.length) / challenges.length) * 100;
  const R = 62;
  const C = 2 * Math.PI * R;
  const currentKey = CHALLENGE_KEYS[challenges[Math.min(stepIdx, challenges.length - 1)]];

  return (
    <div className="relative flex-1 overflow-hidden bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        onPlaying={run}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Soft vignette for readability */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.55)_100%)]" />

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pb-4 pt-safe pt-5">
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("verify.live.cancel")}
          className="flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur active:scale-95"
        >
          <X className="size-5" />
        </button>
        <span className="rounded-full bg-black/50 px-3.5 py-1.5 text-xs font-bold text-white backdrop-blur">
          {t("verify.live.step", {
            current: Math.min(stepIdx + 1, challenges.length),
            total: challenges.length,
          })}
        </span>
        <span className="size-10" />
      </div>

      {/* Face ring + progress */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex items-center justify-center">
          <svg width="176" height="176" viewBox="0 0 176 176" className="absolute -inset-4">
            <circle
              cx="88"
              cy="88"
              r={R}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="5"
            />
            <motion.circle
              cx="88"
              cy="88"
              r={R}
              fill="none"
              stroke="url(#vybe-ring)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={C}
              animate={{ strokeDashoffset: C - (progress / 100) * C }}
              transition={{ duration: 0.5 }}
              transform="rotate(-90 88 88)"
            />
            <defs>
              <linearGradient id="vybe-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--vybe-violet, #8b5cf6)" />
                <stop offset="100%" stopColor="var(--vybe-pink, #ec4899)" />
              </linearGradient>
            </defs>
          </svg>

          {/* Dynamic face frame */}
          <motion.div
            animate={
              stepDone
                ? { scale: 1.08, borderColor: "rgba(52,211,153,0.95)", boxShadow: "0 0 0 6px rgba(52,211,153,0.18)" }
                : faceDetected
                  ? { scale: 1.02, borderColor: "rgba(139,92,246,0.9)", boxShadow: "0 0 0 6px rgba(139,92,246,0.15)" }
                  : { scale: 1, borderColor: "rgba(255,255,255,0.35)", boxShadow: "0 0 0 0px rgba(255,255,255,0)" }
            }
            transition={{ duration: 0.25 }}
            className="size-56 rounded-full border-[3px]"
            style={{ borderRadius: "45%" }}
          />

          {stepDone && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 16 }}
              className="absolute -bottom-2 -right-2 flex size-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow-glow"
            >
              <Check className="size-5" />
            </motion.span>
          )}
        </div>
      </div>

      {/* Warning strip */}
      <AnimatePresence>
        {multiFace ? (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 top-24 z-10 text-center text-xs font-bold text-amber-300"
          >
            ⚠ {t("verify.live.multiFace")}
          </motion.p>
        ) : faceLost ? (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 top-24 z-10 text-center text-xs font-bold text-amber-300"
          >
            {t("verify.live.faceLost")}
          </motion.p>
        ) : null}
      </AnimatePresence>

      {/* Challenge instruction — minimal, at the bottom */}
      <div className="absolute inset-x-0 bottom-12 z-10 flex flex-col items-center px-8">
        <motion.div
          key={stepIdx}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-sm rounded-3xl border border-white/15 bg-black/55 px-5 py-4 text-center shadow-2xl backdrop-blur-xl"
        >
          <p className="font-display text-lg font-bold text-white">
            {t(currentKey)}
          </p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-white/60">
            {stepDone ? (
              <>
                <Check className="size-3.5 text-emerald-400" />
                {t("verify.live.detected")}
              </>
            ) : (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {t("verify.live.detecting")}
              </>
            )}
          </p>
        </motion.div>
      </div>

      {/* Face guide caption */}
      <p
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-4 z-10 text-center text-[10px] font-semibold text-white/50 transition-opacity",
          faceLost ? "opacity-0" : "opacity-100",
        )}
      >
        {t("verify.live.faceGuide")}
      </p>
    </div>
  );
}
