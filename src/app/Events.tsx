import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import {
  EVENT_CATEGORIES,
  EVENT_CATEGORY_META,
  type EventCategory,
} from "@/lib/constants";
import { ScreenHeader, ListSkeleton, EmptyState } from "@/components/mobile/ui";
import { ImageWithFallback } from "@/components/mobile/ImageWithFallback";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Bookmark,
  CalendarDays,
  Clock,
  Heart,
  Loader2,
  MapPin,
  Send,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type EventItem = {
  _id: string;
  title: string;
  category: string;
  city: string;
  venue?: string;
  startsAt: number;
  imageUrl?: string;
  description: string;
  distanceKm: number | null;
  saved: boolean;
  liked: boolean;
  source: string;
};

type MatchOption = { matchId: string; firstName: string; photo?: string };

export default function Events() {
  const { t, formatClockTime, formatFullDate } = useI18n();
  const navigate = useNavigate();

  const data = useQuery(api.events.listEvents, {});
  const myMatches = useQuery(api.matches.listMatches);
  const save = useMutation(api.events.saveEvent);
  const unsave = useMutation(api.events.unsaveEvent);
  const like = useMutation(api.events.likeEvent);
  const unlike = useMutation(api.events.unlikeEvent);
  const invite = useMutation(api.datePlans.inviteToEvent);

  const [category, setCategory] = useState<string>("all");
  const [sendTarget, setSendTarget] = useState<EventItem | null>(null);
  const [sending, setSending] = useState(false);

  const events = data?.events ?? [];
  const filtered = useMemo(
    () =>
      category === "all"
        ? events
        : events.filter((e) => e.category === category),
    [events, category],
  );

  const matches = useMemo(() => {
    const opts: MatchOption[] = [];
    for (const m of myMatches ?? []) {
      if (m.status !== "active" && m.status !== "unmatched") continue;
      opts.push({ matchId: m.matchId, firstName: m.other.firstName, photo: m.other.photos[0] });
    }
    return opts;
  }, [myMatches]);

  const toggleSave = async (e: EventItem) => {
    try {
      if (e.saved) await unsave({ eventId: e._id as any });
      else await save({ eventId: e._id as any });
      haptic("light");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  };

  const toggleLike = async (e: EventItem) => {
    try {
      if (e.liked) await unlike({ eventId: e._id as any });
      else await like({ eventId: e._id as any });
      haptic("light");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  };

  const doSend = async (matchId: string) => {
    if (!sendTarget || sending) return;
    setSending(true);
    try {
      await invite({
        matchId: matchId as any,
        eventId: sendTarget._id as any,
      });
      haptic("success");
      toast.success(t("events.sentToast", { title: sendTarget.title }));
      setSendTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ScreenHeader title={t("events.title")} subtitle={t("events.subtitle")} onBack={() => navigate(-1)} />

      <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
        {/* Category filter */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-3">
          <CategoryChip
            label={t("events.all")}
            active={category === "all"}
            onClick={() => setCategory("all")}
          />
          {EVENT_CATEGORIES.map((c) => (
            <CategoryChip
              key={c}
              label={EVENT_CATEGORY_META[c].label}
              emoji={EVENT_CATEGORY_META[c].emoji}
              active={category === c}
              onClick={() => setCategory(c)}
            />
          ))}
        </div>

        {data === undefined ? (
          <div className="px-4 pt-4">
            <ListSkeleton rows={4} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 pt-8">
            <EmptyState
              icon={<CalendarDays className="size-7" />}
              title={t("events.emptyTitle")}
              hint={t("events.emptyHint")}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-4 pt-4">
            {filtered.map((e, i) => (
              <motion.article
                key={e._id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
                className="overflow-hidden rounded-3xl border border-border/60 bg-card/60"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden">
                  <ImageWithFallback
                    src={e.imageUrl}
                    name={e.title}
                    className="h-full w-full"
                    sizes="(max-width: 430px) 100vw, 382px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                  <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
                    <span>{EVENT_CATEGORY_META[e.category as EventCategory]?.emoji ?? "✨"}</span>
                    {EVENT_CATEGORY_META[e.category as EventCategory]?.label ?? e.category}
                  </span>
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-lg font-bold text-white">
                        {e.title}
                      </h2>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-white/80">
                        <MapPin className="size-3.5 shrink-0" />
                        {[e.venue, e.city].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        aria-label={t("events.like")}
                        onClick={() => void toggleLike(e)}
                        className={cn(
                          "flex size-9 items-center justify-center rounded-full backdrop-blur transition-transform active:scale-90",
                          e.liked ? "bg-pink-500 text-white" : "bg-black/40 text-white",
                        )}
                      >
                        <Heart className="size-4" fill={e.liked ? "currentColor" : "none"} />
                      </button>
                      <button
                        type="button"
                        aria-label={t("events.save")}
                        onClick={() => void toggleSave(e)}
                        className={cn(
                          "flex size-9 items-center justify-center rounded-full backdrop-blur transition-transform active:scale-90",
                          e.saved ? "bg-primary text-white" : "bg-black/40 text-white",
                        )}
                      >
                        <Bookmark className="size-4" fill={e.saved ? "currentColor" : "none"} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3.5 text-primary" />
                      {formatFullDate(e.startsAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5 text-primary" />
                      {formatClockTime(e.startsAt)}
                    </span>
                    {e.distanceKm !== null && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5 text-primary" />
                        {t("common.kmAway", { km: e.distanceKm })}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                    {e.description}
                  </p>
                  <Button
                    onClick={() => {
                      if (matches.length === 0) {
                        toast(t("events.noMatches"));
                        return;
                      }
                      setSendTarget(e);
                    }}
                    className="mt-3 h-10 w-full rounded-full vybe-gradient text-sm font-bold text-white shadow-glow"
                  >
                    <Send className="size-4" />
                    {t("events.sendToMatch")}
                  </Button>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>

      {/* Send-to-match sheet */}
      <AnimatePresence>
        {sendTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setSendTarget(null)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-[1.75rem] border-t border-border/70 bg-card p-5 pb-safe shadow-2xl"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
              <h3 className="font-display text-xl font-bold">{t("events.sendTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("events.sendSubtitle")}</p>
              <div className="mt-4 flex max-h-[45dvh] flex-col gap-2 overflow-y-auto no-scrollbar">
                {matches.map((m) => (
                  <button
                    key={m.matchId}
                    type="button"
                    disabled={sending}
                    onClick={() => void doSend(m.matchId)}
                    className="flex min-h-14 items-center gap-3 rounded-2xl border border-border/70 bg-muted/30 px-3.5 py-2.5 text-left transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <span className="size-10 shrink-0 overflow-hidden rounded-full border border-border/60">
                      <ImageWithFallback src={m.photo} name={m.firstName} className="h-full w-full" />
                    </span>
                    <span className="flex-1 text-sm font-bold">{m.firstName}</span>
                    {sending ? (
                      <Loader2 className="size-4 animate-spin text-primary" />
                    ) : (
                      <Send className="size-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CategoryChip({
  label,
  emoji,
  active,
  onClick,
}: {
  label: string;
  emoji?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95",
        active
          ? "border-transparent vybe-gradient text-white shadow-glow"
          : "border-border bg-card text-muted-foreground",
      )}
    >
      {emoji && <span>{emoji}</span>}
      {label}
    </button>
  );
}
