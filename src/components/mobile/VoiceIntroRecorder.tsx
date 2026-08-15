import { api } from "@/convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { VOICE_INTRO_MAX_SECONDS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  Settings2,
  Square,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  microphonePermissionState,
  openAppSettings,
  requestMicrophonePermission,
  type PermissionResult,
} from "@/lib/permissions";

type VoiceIntro = { url: string; durationSec: number; createdAt: number };
type MicState = "checking" | "ready" | "denied" | "blocked";

export function VoiceIntroRecorder({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const mine = useQuery(api.voiceIntros.myVoiceIntro);
  const saveIntro = useMutation(api.voiceIntros.saveVoiceIntro);
  const removeIntro = useMutation(api.voiceIntros.removeVoiceIntro);
  const generateUploadUrl = useAction(api.upload.generateUploadUrl);

  const [micState, setMicState] = useState<MicState>("checking");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [playing, setPlaying] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const waveformRef = useRef<HTMLCanvasElement | null>(null);

  const current: VoiceIntro | null = mine ?? null;

  // Check passive permission state on mount (never prompts).
  useEffect(() => {
    let cancelled = false;
    void microphonePermissionState().then((state) => {
      if (cancelled) return;
      if (state === "granted") setMicState("ready");
      else if (state === "denied") setMicState("blocked");
      else setMicState("ready"); // "prompt"/"unknown" → we'll request on demand
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      audioRef.current?.pause();
    };
  }, []);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    analyserRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const drawWaveform = () => {
    const canvas = waveformRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    const bars = 28;
    const step = Math.floor(data.length / bars);
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "#8b5cf6");
    gradient.addColorStop(1, "#ec4899");
    ctx.fillStyle = gradient;
    for (let i = 0; i < bars; i++) {
      let max = 0;
      for (let j = 0; j < step; j++) max = Math.max(max, Math.abs(data[i * step + j] - 128));
      const h = Math.max(3, (max / 128) * height);
      const x = (i / bars) * width + 1;
      const w = width / bars - 3;
      ctx.beginPath();
      ctx.roundRect(x, (height - h) / 2, w, h, 2);
      ctx.fill();
    }
    rafRef.current = requestAnimationFrame(drawWaveform);
  };

  const start = async () => {
    if (micState === "blocked") {
      setMicState("blocked");
      return;
    }
    let perm: PermissionResult;
    try {
      perm = await requestMicrophonePermission();
    } catch {
      perm = "unsupported";
    }
    if (perm === "denied") {
      setMicState("denied");
      return;
    }
    if (perm === "unsupported") {
      toast.error(t("voice.error"));
      return;
    }
    setMicState("ready");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Waveform visualization
      try {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
        void audioCtx.resume();
        drawWaveform();
      } catch {
        /* waveform is decorative — never block recording without it */
      }

      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const secs = Math.floor((Date.now() - startRef.current) / 1000);
        // Never save empty/silent recordings shorter than 1 second.
        if (secs < 1) {
          setElapsed(0);
          toast(t("voice.tooShort"));
          return;
        }
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        void upload(blob, Math.min(secs, VOICE_INTRO_MAX_SECONDS));
      };
      recorderRef.current = rec;
      rec.start();
      startRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      haptic("medium");
      timerRef.current = window.setInterval(() => {
        const sec = Math.floor((Date.now() - startRef.current) / 1000);
        setElapsed(sec);
        if (sec >= VOICE_INTRO_MAX_SECONDS) stop();
      }, 250);
    } catch {
      toast.error(t("voice.error"));
    }
  };

  const stop = () => {
    if (!recorderRef.current || recorderRef.current.state === "inactive") return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    try {
      recorderRef.current.stop();
    } catch {
      /* ignore */
    }
    setRecording(false);
    stopTracks();
  };

  const upload = async (blob: Blob, durationSec: number) => {
    setUploading(true);
    try {
      const storageId = await generateUploadUrl();
      const res = await fetch(storageId, {
        method: "PUT",
        headers: { "Content-Type": blob.type || "audio/webm" },
        body: blob,
      });
      if (!res.ok) throw new Error("upload_failed");
      await saveIntro({ storageId: storageId as any, durationSec });
      haptic("success");
      toast.success(t("voice.saved"));
    } catch {
      toast.error(t("voice.error"));
    } finally {
      setUploading(false);
    }
  };

  const play = () => {
    if (!current || playing) return;
    const audio = new Audio(current.url);
    audioRef.current = audio;
    audio.onended = () => setPlaying(false);
    audio.onerror = () => setPlaying(false);
    void audio.play().catch(() => setPlaying(false));
    setPlaying(true);
  };

  const remove = async () => {
    try {
      await removeIntro();
      audioRef.current?.pause();
      setPlaying(false);
      toast(t("voice.delete"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  if (compact && current) {
    return (
      <div className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card/60 p-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Mic className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold">{t("voice.title")}</p>
          <p className="text-[11px] text-muted-foreground">
            {t("voice.seconds", { n: current.durationSec })}
          </p>
        </div>
        <button
          type="button"
          onClick={play}
          className="flex size-9 items-center justify-center rounded-full vybe-gradient text-white"
          aria-label={t("voice.listen")}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => void remove()}
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
          aria-label={t("voice.delete")}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    );
  }

  // Blocked permanently → clear explanation + open app settings.
  if (micState === "blocked") {
    return (
      <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <MicOff className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{t("voice.permBlocked")}</p>
            <Button
              variant="outline"
              onClick={openAppSettings}
              className="mt-3 h-10 w-full rounded-full border-border bg-card text-xs font-semibold"
            >
              <Settings2 className="size-3.5" />
              {t("voice.openSettings")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold">
            {recording ? t("voice.recording") : t("voice.title")}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {t("voice.desc")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {recording && (
            <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-bold tabular-nums text-red-400">
              {Math.min(elapsed, VOICE_INTRO_MAX_SECONDS)}s
            </span>
          )}
          <Button
            onClick={recording ? stop : () => void start()}
            disabled={uploading || micState === "checking"}
            className={cn(
              "size-12 rounded-full p-0",
              recording
                ? "bg-red-500 text-white hover:bg-red-500"
                : "vybe-gradient text-white shadow-glow",
            )}
            aria-label={recording ? t("voice.stop") : t("voice.record")}
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : recording ? (
              <Square className="size-5" fill="currentColor" />
            ) : (
              <Mic className="size-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Waveform */}
      <canvas
        ref={waveformRef}
        aria-label={t("voice.waveform")}
        className="mt-3 h-10 w-full rounded-xl bg-muted/40"
      />

      {micState === "denied" && !recording && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-destructive">
          <MicOff className="size-3.5" />
          {t("voice.permDenied")}
        </p>
      )}

      {current && !recording && (
        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="outline"
            onClick={play}
            className="h-9 flex-1 rounded-full border-border bg-card text-xs font-semibold"
          >
            {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            {t("voice.listen")} · {t("voice.seconds", { n: current.durationSec })}
          </Button>
          <Button
            variant="ghost"
            onClick={() => void remove()}
            className="h-9 rounded-full px-3 text-xs font-semibold text-destructive"
          >
            <Trash2 className="size-3.5" />
            {t("voice.delete")}
          </Button>
        </div>
      )}
    </div>
  );
}
