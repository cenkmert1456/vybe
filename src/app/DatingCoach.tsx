import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { useNavigate } from "react-router";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { ScreenHeader } from "@/components/mobile/ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type CoachMode =
  | "firstMessage"
  | "reply"
  | "rescue"
  | "bio"
  | "bioImprove"
  | "prompts";

type CoachTone = "friendly" | "flirty" | "funny" | "confident" | "romantic" | "casual";

type Result = {
  source: "local" | "ai";
  suggestions: string[];
  explanation: string;
};

const MODES: CoachMode[] = ["firstMessage", "reply", "rescue", "bio", "bioImprove", "prompts"];
const TONES: CoachTone[] = ["friendly", "flirty", "funny", "confident", "romantic", "casual"];

export default function DatingCoach() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const coach = useAction(api.ai.coachAdvice);

  const [mode, setMode] = useState<CoachMode>("firstMessage");
  const [tone, setTone] = useState<CoachTone>("friendly");
  const [context, setContext] = useState("");
  const [theirName, setTheirName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const run = async () => {
    if (busy) return;
    if (!context.trim()) {
      toast.error(t("coach.needContext"));
      return;
    }
    setBusy(true);
    try {
      const res = await coach({
        mode,
        tone,
        context: context.trim(),
        theirName: theirName.trim() || undefined,
        lang,
      });
      haptic("success");
      setResult(res as Result);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("coach.copied"));
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ScreenHeader title={t("coach.title")} onBack={() => navigate(-1)} />
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-4">
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-primary/25 bg-gradient-to-br from-violet-500/10 via-transparent to-pink-500/10 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl vybe-gradient text-white shadow-glow">
            <Wand2 className="size-5" />
          </span>
          <div>
            <p className="text-sm font-bold">{t("coach.intro")}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {t("coach.language", { language: t("lang.native") })}
            </p>
          </div>
        </div>

        {/* Mode picker */}
        <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("coach.what")}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setResult(null);
              }}
              className={cn(
                "min-h-10 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all active:scale-95",
                mode === m
                  ? "border-transparent vybe-gradient text-white shadow-glow"
                  : "border-border bg-card text-foreground",
              )}
            >
              {t(`coach.mode.${m}`)}
            </button>
          ))}
        </div>

        {/* Tone picker */}
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("coach.tone")}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {TONES.map((tn) => (
            <button
              key={tn}
              type="button"
              onClick={() => {
                setTone(tn);
                setResult(null);
              }}
              className={cn(
                "min-h-10 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all active:scale-95",
                tone === tn
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {t(`coach.tone.${tn}`)}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("coach.context")}
        </p>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder={t(`coach.placeholder.${mode}`)}
          rows={3}
          className="mt-2 w-full rounded-xl border border-input bg-card p-3.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        <input
          value={theirName}
          onChange={(e) => setTheirName(e.target.value)}
          placeholder={t("coach.theirName")}
          className="mt-2 h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
        />

        <Button
          onClick={() => void run()}
          disabled={busy}
          className="mt-4 h-12 w-full rounded-full vybe-gradient text-base font-bold text-white shadow-glow"
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <>
              <Sparkles className="size-4" />
              {t("coach.generate")}
            </>
          )}
        </Button>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-5"
            >
              {result.explanation && (
                <p className="text-xs text-muted-foreground">{result.explanation}</p>
              )}
              <div className="mt-2.5 flex flex-col gap-2.5">
                {result.suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 rounded-2xl border border-border/70 bg-card/60 p-4"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      {i + 1}
                    </span>
                    <p className="flex-1 text-sm leading-relaxed">{s}</p>
                    <button
                      type="button"
                      onClick={() => void copy(s)}
                      aria-label={t("coach.copy")}
                      className="shrink-0 text-muted-foreground active:scale-90"
                    >
                      <Copy className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              {result.source === "local" && (
                <p className="mt-2 text-center text-[10px] text-muted-foreground/70">
                  {t("coach.localNote")}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
