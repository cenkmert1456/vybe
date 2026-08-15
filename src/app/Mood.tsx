import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { ScreenHeader } from "@/components/mobile/ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type MoodKey = "chill" | "social" | "romantic" | "adventurous" | "chatty" | "quiet" | "creative" | "active";
type DurationKey = "2h" | "6h" | "12h" | "24h" | "3d";

const MOOD_EMOJI: Record<MoodKey, string> = {
  chill: "🌊",
  social: "🥳",
  romantic: "🌹",
  adventurous: "🧗",
  chatty: "💬",
  quiet: "🌙",
  creative: "🎨",
  active: "⚡",
};

const DURATIONS: DurationKey[] = ["2h", "6h", "12h", "24h", "3d"];

export default function Mood() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const myMood = useQuery(api.moods.myMood);
  const setMood = useMutation(api.moods.setMood);
  const clearMood = useMutation(api.moods.clearMood);

  const [selected, setSelected] = useState<MoodKey | null>(null);
  const [duration, setDuration] = useState<DurationKey>("12h");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await setMood({ mood: selected, duration });
      haptic("success");
      toast.success(t("mood.saved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    try {
      await clearMood();
      haptic("light");
      toast(t("mood.cleared"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  };

  const moodKeys = Object.keys(MOOD_EMOJI) as MoodKey[];

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ScreenHeader title={t("mood.title")} onBack={() => navigate(-1)} />
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-4">
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {t("mood.desc")}
        </p>

        {myMood && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3.5">
            <span className="text-2xl">{MOOD_EMOJI[myMood.mood as MoodKey] ?? "✨"}</span>
            <div className="flex-1">
              <p className="text-sm font-bold">{t(`mood.${myMood.mood}`)}</p>
              <p className="text-[11px] text-muted-foreground">
                {t("mood.expires", {
                  time: new Date(myMood.expiresAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void clear()}
              aria-label={t("mood.clear")}
              className="flex size-8 items-center justify-center rounded-full bg-card text-muted-foreground active:scale-95"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <p className="mt-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("mood.pick")}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {moodKeys.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setSelected(m);
                haptic("light");
              }}
              className={cn(
                "flex items-center gap-2.5 rounded-2xl border px-4 py-3.5 text-left transition-all active:scale-[0.98]",
                selected === m
                  ? "border-transparent vybe-gradient text-white shadow-glow"
                  : "border-border/70 bg-card/60 text-foreground",
              )}
            >
              <span className="text-xl">{MOOD_EMOJI[m]}</span>
              <span className="text-sm font-bold">{t(`mood.${m}`)}</span>
            </button>
          ))}
        </div>

        <p className="mt-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("mood.duration")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className={cn(
                "min-h-10 rounded-full border px-4 py-2 text-sm font-semibold transition-all active:scale-95",
                duration === d
                  ? "border-transparent vybe-gradient text-white shadow-glow"
                  : "border-border bg-card text-foreground",
              )}
            >
              {t(`mood.dur.${d}`)}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-border/70 bg-card/60 p-4">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("mood.hint")}
          </p>
        </div>
      </div>

      <div className="border-t border-border/60 bg-background/90 px-5 pb-safe pt-3 backdrop-blur">
        <Button
          onClick={() => void save()}
          disabled={!selected || saving}
          className="h-13 w-full rounded-full vybe-gradient text-base font-bold text-white shadow-glow disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="size-5 animate-spin" />
          ) : selected ? (
            <motion.span
              key={selected}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              {MOOD_EMOJI[selected]} {t("mood.set")}
            </motion.span>
          ) : (
            t("mood.set")
          )}
        </Button>
      </div>
    </div>
  );
}
