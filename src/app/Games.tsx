import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { ImageWithFallback } from "@/components/mobile/ImageWithFallback";
import { ScreenHeader } from "@/components/mobile/ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChevronRight, Loader2, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const GAME_TYPES = [
  "this_or_that",
  "twenty_questions",
  "quick_picks",
  "emoji_challenge",
  "fun_questions",
] as const;
type GameType = (typeof GAME_TYPES)[number];

type Match = {
  matchId: string;
  status: string;
  other: {
    _id: string;
    firstName: string;
    photos: string[];
    verified: boolean;
  };
};

type Game = {
  _id: string;
  gameType: GameType;
  status: string;
  questions: string[];
  myAnswers: string[];
  theirAnswers: string[];
  otherAnswered: boolean;
};

const GAME_EMOJI: Record<GameType, string> = {
  this_or_that: "⚖️",
  twenty_questions: "❓",
  quick_picks: "⚡",
  emoji_challenge: "😜",
  fun_questions: "🎉",
};

export default function Games() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const matches = useQuery(api.matches.listMatches) as Match[] | undefined;
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  // Unconditional hook — an impossible id yields an empty list server-side.
  const games = useQuery(api.icebreakers.gamesForMatch, {
    matchId: (selectedMatch ?? "000000000000000000000000") as any,
  }) as Game[] | undefined;
  const startGame = useMutation(api.icebreakers.startGame);
  const submit = useMutation(api.icebreakers.submitAnswer);

  const [starting, setStarting] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const active = useMemo(
    () => (games ?? []).find((g) => g.status === "active"),
    [games],
  );
  const completed = useMemo(() => (games ?? []).filter((g) => g.status === "completed"), [games]);

  const start = async (type: GameType) => {
    if (!selectedMatch || starting) return;
    setStarting(true);
    try {
      await startGame({ matchId: selectedMatch as any, gameType: type });
      haptic("success");
      setAnswers({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setStarting(false);
    }
  };

  const saveAnswers = async () => {
    if (!active || saving) return;
    const filled = active.questions.map((_, i) => answers[i] ?? "").filter(Boolean);
    if (filled.length !== active.questions.length) {
      toast.error(t("games.answerAll"));
      return;
    }
    setSaving(true);
    try {
      const res = await submit({
        gameId: active._id as any,
        answers: active.questions.map((_, i) => answers[i] ?? ""),
      });
      haptic(res.completed ? "success" : "light");
      toast.success(t("games.submit"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const pickedMatch = matches?.find((m) => m.matchId === selectedMatch);
  const matchName = pickedMatch?.other.firstName ?? "";

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ScreenHeader title={t("games.title")} onBack={() => navigate(-1)} />
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-4">
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {t("games.desc")}
        </p>

        {/* Match picker */}
        <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("games.pickMatch")}
        </p>
        <div className="mt-2.5 flex flex-col gap-2">
          {!matches ? (
            <Loader2 className="mx-auto mt-4 size-5 animate-spin text-primary" />
          ) : matches.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("games.noMatches")}
            </p>
          ) : (
            matches.map((m) => (
              <button
                key={m.matchId}
                type="button"
                onClick={() => {
                  setSelectedMatch(m.matchId);
                  setAnswers({});
                }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all active:scale-[0.99]",
                  selectedMatch === m.matchId
                    ? "border-primary/60 bg-primary/10"
                    : "border-border/70 bg-card/60",
                )}
              >
                <div className="size-11 shrink-0 overflow-hidden rounded-full border border-border/60">
                  <ImageWithFallback
                    src={m.other.photos[0]}
                    name={m.other.firstName}
                    className="h-full w-full"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{m.other.firstName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {m.status === "active" ? t("messages.title") : t("matches.unmatched")}
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            ))
          )}
        </div>

        {/* Active game */}
        {active && (
          <div className="mt-6 rounded-3xl border border-primary/25 bg-gradient-to-br from-violet-500/10 via-transparent to-pink-500/10 p-4">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">{GAME_EMOJI[active.gameType]}</span>
              <div>
                <p className="text-sm font-bold">{t(`games.${active.gameType}`)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t("games.inProgress")} · {active.otherAnswered ? t("games.answered") : t("games.notAnswered")}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              {active.questions.map((q, i) => (
                <div key={i} className="rounded-2xl bg-card/70 p-3.5">
                  <p className="text-[13px] font-semibold leading-snug">
                    {i + 1}. {q}
                  </p>
                  <input
                    value={answers[i] ?? ""}
                    onChange={(e) =>
                      setAnswers((a) => ({ ...a, [i]: e.target.value }))
                    }
                    placeholder={t("games.submit")}
                    className="mt-2 h-10 w-full rounded-lg border border-input bg-background/60 px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                  />
                </div>
              ))}
            </div>
            <Button
              onClick={() => void saveAnswers()}
              disabled={saving}
              className="mt-3 h-11 w-full rounded-full vybe-gradient text-sm font-bold text-white shadow-glow"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : t("games.submit")}
            </Button>
          </div>
        )}

        {/* Game type picker (when no active game) */}
        {selectedMatch && !active && matches && matches.length > 0 && (
          <>
            <p className="mt-6 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("games.pickGame")}
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              {GAME_TYPES.map((g) => (
                <button
                  key={g}
                  type="button"
                  disabled={starting}
                  onClick={() => void start(g)}
                  className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card/60 px-4 py-3.5 text-left transition-all active:scale-[0.98] disabled:opacity-60"
                >
                  <span className="text-xl">{GAME_EMOJI[g]}</span>
                  <span className="text-sm font-bold">{t(`games.${g}`)}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Completed games */}
        {completed.length > 0 && (
          <div className="mt-6 flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("games.completed")}
            </p>
            {completed.map((g) => (
              <div key={g._id} className="rounded-2xl border border-border/70 bg-card/60 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{GAME_EMOJI[g.gameType]}</span>
                  <p className="text-sm font-bold">{t(`games.${g.gameType}`)}</p>
                </div>
                {g.myAnswers.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t("games.myAnswers")}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {g.myAnswers.map((a, i) => (
                        <span key={i} className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {g.theirAnswers.length > 0 && (
                  <div className="mt-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t("games.theirAnswers")} · {matchName}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {g.theirAnswers.map((a, i) => (
                        <span key={i} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedMatch && (
                  <Button
                    onClick={() => navigate(`/app/chat/${selectedMatch}`)}
                    className="mt-3 h-10 w-full rounded-full border border-border bg-card text-sm font-semibold"
                    variant="outline"
                  >
                    <MessageCircle className="size-4" />
                    {t("games.chat")}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
