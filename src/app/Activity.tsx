import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { ImageWithFallback } from "@/components/mobile/ImageWithFallback";
import { EmptyState, ListSkeleton, SectionTitle } from "@/components/mobile/ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, Heart, Loader2, MessageCircle, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type ActivityItem = {
  _id: string;
  type: "like" | "match" | "message" | "verify" | "system";
  title: string;
  createdAt: number;
  readAt: number | null;
  matchId: string | null;
  from: {
    _id: string;
    firstName: string;
    photos: string[];
    verified: boolean;
    city?: string;
  } | null;
};

const DAY = 24 * 60 * 60 * 1000;

export default function Activity() {
  const { t, formatRelativeTime } = useI18n();
  const navigate = useNavigate();
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const page = useQuery(api.activity.listActivity, { cursor: cursor as any });
  const markAllRead = useMutation(api.activity.markAllRead);
  const swipe = useMutation(api.swipes.swipe);

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [likedBack, setLikedBack] = useState<Set<string>>(new Set());
  const mergedFor = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!page) return;
    if (mergedFor.current === cursor) return;
    mergedFor.current = cursor;
    setItems((prev) => {
      const existing = new Set(prev.map((i) => i._id));
      const fresh = page.items.filter((i) => !existing.has(i._id));
      return [...prev, ...fresh];
    });
    setHasMore(page.hasMore);
  }, [page, cursor]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void markAllRead();
    }, 600);
    return () => clearTimeout(timer);
  }, [markAllRead]);

  const groups = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = now - 7 * DAY;
    const today: ActivityItem[] = [];
    const week: ActivityItem[] = [];
    const earlier: ActivityItem[] = [];
    for (const it of items) {
      if (it.createdAt >= todayStart.getTime()) today.push(it);
      else if (it.createdAt >= weekStart) week.push(it);
      else earlier.push(it);
    }
    const out: { key: string; label: string; items: ActivityItem[] }[] = [];
    if (today.length) out.push({ key: "today", label: t("activity.today"), items: today });
    if (week.length) out.push({ key: "week", label: t("activity.thisWeek"), items: week });
    if (earlier.length) out.push({ key: "earlier", label: t("activity.earlier"), items: earlier });
    return out;
  }, [items, t]);

  const likeBack = async (item: ActivityItem) => {
    const from = item.from;
    if (!from) return;
    const fromId = from._id;
    if (likedBack.has(fromId)) return;
    haptic("medium");
    setLikedBack((s) => new Set(s).add(fromId));
    try {
      const result = await swipe({
        toProfileId: fromId as any,
        action: "like",
      });
      if (result.matched && result.matchId) {
        setTimeout(() => navigate(`/app/match/${result.matchId}`), 300);
      } else {
        toast(t("activity.likedYou"));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
      setLikedBack((s) => {
        const next = new Set(s);
        next.delete(fromId);
        return next;
      });
    }
  };

  const openItem = (item: ActivityItem) => {
    if (item.matchId) navigate(`/app/chat/${item.matchId}`);
    else if (item.from) navigate(`/app/profile/${item.from._id}`);
  };

  if (page === undefined && items.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <Header />
        <ListSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6">
        {groups.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-7" />}
            title={t("activity.emptyTitle")}
            hint={t("activity.emptyHint")}
          />
        ) : (
          groups.map((g) => (
            <section key={g.key} className="mt-2">
              <SectionTitle className="mb-1.5">{g.label}</SectionTitle>
              {g.items.map((item) => {
                const isLike = item.type === "like";
                return (
                  <motion.button
                    key={item._id}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => openItem(item)}
                    className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left active:bg-muted/60"
                  >
                    <ActivityIcon type={item.type} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">
                        <span className="font-semibold">{item.title}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatRelativeTime(item.createdAt)}
                      </p>
                    </div>
                    {isLike && item.from && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void likeBack(item);
                        }}
                        disabled={likedBack.has(item.from._id)}
                        className="shrink-0 rounded-full bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary active:scale-95 disabled:opacity-50"
                      >
                        {likedBack.has(item.from._id) ? "✓" : t("activity.likeBack")}
                      </button>
                    )}
                    {item.type === "match" && item.matchId && (
                      <span className="shrink-0 rounded-full vybe-gradient px-3 py-1.5 text-[11px] font-bold text-white">
                        💬
                      </span>
                    )}
                    {item.from && (
                      <div className="size-11 shrink-0 overflow-hidden rounded-full border border-border/60">
                        <ImageWithFallback
                          src={item.from.photos[0]}
                          name={item.from.firstName}
                          className="h-full w-full"
                        />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </section>
          ))
        )}

        {hasMore && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setCursor(page?.cursor as string | undefined)}
            >
              <Loader2 className="size-3.5" />
              {t("common.loadMore")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Header() {
  const { t } = useI18n();
  return (
    <header className="px-5 pt-safe pb-2 pt-4">
      <h1 className="font-display text-[26px] font-bold leading-none">
        {t("activity.title")}
      </h1>
      <p className="mt-1 text-xs font-medium text-muted-foreground">
        {t("app.tagline")}
      </p>
    </header>
  );
}

function ActivityIcon({ type }: { type: ActivityItem["type"] }) {
  const cls = "size-5";
  const box = "flex size-11 shrink-0 items-center justify-center rounded-full";
  if (type === "like")
    return (
      <div className={cn(box, "bg-pink-500/15 text-pink-400")}>
        <Heart className={cls} />
      </div>
    );
  if (type === "match")
    return (
      <div className={cn(box, "vybe-gradient text-white shadow-glow")}>
        <Sparkles className={cls} />
      </div>
    );
  if (type === "message")
    return (
      <div className={cn(box, "bg-sky-500/15 text-sky-400")}>
        <MessageCircle className={cls} />
      </div>
    );
  if (type === "verify")
    return (
      <div className={cn(box, "bg-emerald-500/15 text-emerald-400")}>
        <ShieldCheck className={cls} />
      </div>
    );
  return (
    <div className={cn(box, "bg-muted text-muted-foreground")}>
      <Zap className={cls} />
    </div>
  );
}
