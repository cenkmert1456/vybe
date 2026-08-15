import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { ScreenHeader, EmptyState } from "@/components/mobile/ui";
import { ImageWithFallback } from "@/components/mobile/ImageWithFallback";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Check,
  Flame,
  Loader2,
  MessageCircle,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Suggestion = {
  _id: string;
  firstName: string;
  photos: string[];
  verified: boolean;
  bio: string;
  interests: string[];
};

export default function DailyVibe() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const streak = useQuery(api.streaks.myStreak);
  const question = useQuery(api.dailyQuestions.todayQuestion);
  const suggestions = useQuery(api.swipes.discover, { limit: 3 as any });

  const saveAnswer = useMutation(api.dailyQuestions.saveDailyAnswer);

  const [answer, setAnswer] = useState("");
  const [share, setShare] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!question || saving) return;
    if (!answer.trim()) {
      toast.error(t("daily.answerError"));
      return;
    }
    setSaving(true);
    try {
      await saveAnswer({
        date: question.date,
        question: question.question,
        answer: answer.trim(),
        shareOnProfile: share,
      });
      haptic("success");
      toast.success(t("daily.answerSaved"));
      setAnswer("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const current = streak?.current ?? 0;
  const tasks = [
    {
      key: "answer",
      done: streak?.tasks.answer ?? false,
      label: t("daily.taskAnswer"),
    },
    {
      key: "message",
      done: streak?.tasks.message ?? false,
      label: t("daily.taskMessage"),
    },
    {
      key: "open",
      done: streak?.tasks.open ?? false,
      label: t("daily.taskOpen"),
    },
  ];

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ScreenHeader title={t("daily.title")} onBack={() => navigate(-1)} />

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
        {/* Streak hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mt-3 overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-violet-500/15 via-transparent to-pink-500/15 p-5"
        >
          <div className="pointer-events-none absolute -right-8 -top-8 size-36 rounded-full bg-primary/15 blur-3xl" />
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 2.4 }}
              className="flex size-16 shrink-0 items-center justify-center rounded-2xl vybe-gradient shadow-glow"
            >
              <Flame className="size-8 text-white" />
            </motion.div>
            <div className="min-w-0">
              <p className="font-display text-3xl font-bold leading-none">
                {current > 0 ? t("daily.streakDays", { days: current }) : t("daily.streakZero")}
              </p>
              <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                {t("daily.streakLongest", { days: streak?.longest ?? 0 })} ·{" "}
                {streak?.alive ? t("daily.streakAlive") : t("daily.streakBroken")}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-primary">
            <TrendingUp className="size-4" />
            {t("daily.streakHint")}
          </div>
        </motion.div>

        {/* Daily tasks */}
        <div className="mt-4 rounded-3xl border border-border/60 bg-card/60 p-4">
          <p className="text-sm font-bold">{t("daily.tasksTitle")}</p>
          <div className="mt-3 flex flex-col gap-2">
            {tasks.map((task) => (
              <div key={task.key} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                    task.done
                      ? "border-transparent bg-emerald-500/20 text-emerald-400"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {task.done && <Check className="size-3.5" />}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    task.done ? "text-muted-foreground line-through" : "font-medium",
                  )}
                >
                  {task.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Question of the day */}
        <div className="mt-4 rounded-3xl border border-border/60 bg-card/60 p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold">
            <Sparkles className="size-4 text-primary" />
            {t("daily.questionTitle")}
          </p>
          {!question ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("common.loading")}
            </div>
          ) : (
            <>
              <p className="mt-2 font-display text-lg font-bold leading-snug">
                {question.question}
              </p>
              {question.answered ? (
                <p className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-400">
                  {t("daily.answered", { answer: question.answer || "✓" })}
                </p>
              ) : (
                <>
                  <Textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value.slice(0, 300))}
                    placeholder={t("daily.answerPlaceholder")}
                    maxLength={300}
                    className="mt-3 min-h-24 rounded-2xl border-input bg-background p-3.5 text-sm leading-relaxed"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Switch checked={share} onCheckedChange={setShare} />
                      {t("daily.shareOnProfile")}
                    </label>
                    <Button
                      onClick={() => void submit()}
                      disabled={saving || !answer.trim()}
                      className="h-10 rounded-full vybe-gradient px-5 text-sm font-bold text-white shadow-glow"
                    >
                      {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                      {t("common.save")}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* New profile suggestions */}
        <div className="mt-4">
          <p className="mb-2.5 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t("daily.suggestions")}
          </p>
          {suggestions === undefined ? (
            <div className="flex gap-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-40 w-28 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : suggestions.profiles.length === 0 ? (
            <EmptyState
              icon={<MessageCircle className="size-6" />}
              title={t("daily.noSuggestions")}
              hint={t("discover.emptyHint")}
            />
          ) : (
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
              {(suggestions.profiles as unknown as Suggestion[]).map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => navigate(`/app/profile/${p._id}`)}
                  className="w-32 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-card text-left active:opacity-80"
                >
                  <div className="aspect-[3/4] w-full overflow-hidden">
                    <ImageWithFallback src={p.photos[0]} name={p.firstName} className="h-full w-full" />
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-[13px] font-bold">
                      {p.firstName}
                      {p.verified && <span className="ml-1 text-sky-400">✓</span>}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                      {p.bio || (p.interests ?? []).slice(0, 2).join(" · ")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
