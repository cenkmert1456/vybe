import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Hand } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { useI18n, type TKey } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { ageFromDateOfBirth, haversineKm } from "@/lib/format";
import { SUPER_VYBE_DAILY_LIMIT, VIBES } from "@/lib/constants";
import { ImageWithFallback } from "@/components/mobile/ImageWithFallback";
import { VerifiedBadge, CardSkeleton, DotPagination } from "@/components/mobile/ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flame,
  Heart,
  Info,
  RefreshCw,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Profile = {
  _id: string;
  firstName: string;
  dateOfBirth: number;
  gender: string;
  bio: string;
  photos: string[];
  interests: string[];
  languages: string[];
  city?: string;
  approxLat?: number;
  approxLng?: number;
  verified: boolean;
};

type TodayVibe = { question: string; answer: string } | null;

const SWIPE_THRESHOLD = 90;
const SUPER_THRESHOLD = -100;

function superVybeLeftToday(): number {
  try {
    const key = "vybe-super-left";
    const today = new Date().toDateString();
    const raw = localStorage.getItem(key);
    if (raw) {
      const { date, left } = JSON.parse(raw) as { date: string; left: number };
      if (date === today) return left;
    }
    localStorage.setItem(key, JSON.stringify({ date: today, left: SUPER_VYBE_DAILY_LIMIT }));
    return SUPER_VYBE_DAILY_LIMIT;
  } catch {
    return SUPER_VYBE_DAILY_LIMIT;
  }
}

function useSuperLeft() {
  const [left, setLeft] = useState(superVybeLeftToday);
  const consume = () => {
    const next = Math.max(0, left - 1);
    setLeft(next);
    try {
      localStorage.setItem(
        "vybe-super-left",
        JSON.stringify({ date: new Date().toDateString(), left: next }),
      );
    } catch {
      /* ignore */
    }
    return next;
  };
  return { left, consume };
}

export default function Discover() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const myProfile = useQuery(api.profiles.myProfile);
  const swipe = useMutation(api.swipes.swipe);
  const sendVibe = useMutation(api.vibes.sendVibe);
  const { left: superLeft, consume: consumeSuper } = useSuperLeft();

  const [vibeTarget, setVibeTarget] = useState<Profile | null>(null);
  const [vibeBusy, setVibeBusy] = useState(false);

  const [cursor, setCursor] = useState<undefined | string>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);
  const page = useQuery(api.swipes.discover, { cursor: cursor as any });

  const [queue, setQueue] = useState<Profile[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [actionLock, setActionLock] = useState(false);
  const [exiting, setExiting] = useState<{ id: string; dir: "left" | "right" | "up" } | null>(null);
  const [showHint, setShowHint] = useState(() => {
    try {
      return !localStorage.getItem("vybe-swipe-hint-seen");
    } catch {
      return false;
    }
  });
  const prevCursorRef = useRef<string | null | undefined>(undefined);

  const dismissHint = () => {
    setShowHint(false);
    try {
      localStorage.setItem("vybe-swipe-hint-seen", "1");
    } catch {
      /* ignore */
    }
  };

  // Append each fetched page to the queue.
  useEffect(() => {
    if (!page) return;
    if (page.cursor !== prevCursorRef.current) {
      prevCursorRef.current = page.cursor;
      setQueue((q) => {
        const existing = new Set(q.map((p) => p._id));
        const fresh = page.profiles.filter((p) => !existing.has(p._id));
        return [...q, ...fresh];
      });
    }
  }, [page]);

  const visible = useMemo(
    () => queue.filter((p) => !seen.has(p._id.toString())),
    [queue, seen],
  );

  // Fetch more when the deck runs low.
  useEffect(() => {
    if (!page || !page.hasMore || !page.cursor) return;
    if (visible.length < 3) setCursor(page.cursor.toString());
  }, [visible.length, page]);

  const top = visible[0];
  const todayVibe: TodayVibe = page?.todayVibes?.[top?._id ?? ""] ?? null;
  const topMood = page?.moods?.[top?._id ?? ""] ?? "";

  const handleVibe = async (type: string) => {
    if (!vibeTarget || vibeBusy) return;
    setVibeBusy(true);
    try {
      const res = await sendVibe({
        toProfileId: vibeTarget._id as any,
        type,
      });
      toast.success(
        res.alreadySent ? t("vibe.alreadySentToast") : t("vibe.sentToast"),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setVibeBusy(false);
      setVibeTarget(null);
    }
  };

  const doSwipe = async (
    profile: Profile,
    action: "like" | "pass" | "superLike",
    dir: "left" | "right" | "up",
  ) => {
    if (actionLock) return;
    setActionLock(true);
    setExiting({ id: profile._id, dir });
    haptic(action === "like" ? "medium" : action === "superLike" ? "success" : "light");

    try {
      const result = await swipe({
        toProfileId: profile._id as any,
        action,
      });
      setSeen((s) => new Set(s).add(profile._id.toString()));
      if (result.matched && result.matchId) {
        setTimeout(() => {
          navigate(`/app/match/${result.matchId}`, { replace: true });
        }, 350);
      }
    } catch (e) {
      console.error("Swipe failed:", e);
      toast.error(e instanceof Error ? e.message : t("common.error"));
      setExiting(null);
      setActionLock(false);
      return;
    }
    setTimeout(() => {
      setExiting(null);
      setActionLock(false);
    }, 350);
  };

  const handleSuper = (profile: Profile) => {
    if (superLeft <= 0) {
      toast.error(t("discover.likeLimit"));
      return;
    }
    consumeSuper();
    void doSwipe(profile, "superLike", "up");
  };

  const refresh = () => {
    setQueue([]);
    setSeen(new Set());
    prevCursorRef.current = undefined;
    setCursor(undefined);
    setRefreshKey((k) => k + 1);
  };

  const distToMe = (p: Profile): string | null => {
    if (
      myProfile?.approxLat !== undefined &&
      myProfile.approxLng !== undefined &&
      p.approxLat !== undefined &&
      p.approxLng !== undefined
    ) {
      const km = haversineKm(
        myProfile.approxLat,
        myProfile.approxLng,
        p.approxLat,
        p.approxLng,
      );
      return km < 1 ? t("common.inCity", { city: p.city ?? "" }) : t("common.kmAway", { km: Math.round(km) });
    }
    return p.city ? t("common.inCity", { city: p.city }) : null;
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="px-5 pt-safe pb-2 pt-4">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-[26px] font-bold leading-none">
              {t("discover.title")}
            </h1>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {t("app.tagline")}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label={t("nav.daily")}
              onClick={() => navigate("/app/daily")}
              className="flex size-9 items-center justify-center rounded-full border border-border/80 bg-card/70 text-primary active:scale-95"
            >
              <Flame className="size-4" />
            </button>
            <button
              type="button"
              aria-label={t("events.title")}
              onClick={() => navigate("/app/events")}
              className="flex size-9 items-center justify-center rounded-full border border-border/80 bg-card/70 text-primary active:scale-95"
            >
              <CalendarDays className="size-4" />
            </button>
            <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card/70 px-2.5 py-1 text-xs font-bold text-primary">
              <Zap className="size-3.5" />
              {superLeft}/{SUPER_VYBE_DAILY_LIMIT}
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <QuickLink
            label={t("events.title")}
            onClick={() => navigate("/app/events")}
          />
          <QuickLink
            label={t("nav.daily")}
            onClick={() => navigate("/app/daily")}
          />
          <QuickLink
            label={t("nav.dateplans")}
            onClick={() => navigate("/app/dateplans")}
          />
        </div>
      </header>

      {/* Card area */}
      <div className="relative mx-4 mt-2 min-h-0 flex-1">
        {page === undefined && queue.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <CardSkeleton className="w-full max-w-sm" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex size-16 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 text-primary"
            >
              <Sparkles className="size-7" />
            </motion.div>
            <h2 className="font-display text-xl font-bold">{t("discover.emptyTitle")}</h2>
            <p className="max-w-xs text-sm text-muted-foreground">
              {t("discover.emptyHint")}
            </p>
            <Button
              onClick={refresh}
              className="mt-1 rounded-full vybe-gradient px-6 font-bold text-white shadow-glow"
            >
              <RefreshCw className="size-4" />
              {t("discover.refresh")}
            </Button>
          </div>
        ) : (
          <>
            {/* Stack background cards */}
            {visible.slice(1, 3).reverse().map((p, i) => (
              <div
                key={p._id}
                className="absolute inset-0 translate-y-[6px] scale-[0.97] rounded-[1.75rem] border border-border/60 bg-muted/40"
                style={{ zIndex: i + 1 }}
                aria-hidden="true"
              />
            ))}

            <AnimatePresence>
              {top && (
                <ProfileCard
                  key={`${top._id}-${refreshKey}`}
                  profile={top}
                  exiting={exiting?.id === top._id ? exiting : null}
                  distance={distToMe(top)}
                  todayVibe={todayVibe}
                  mood={topMood}
                  sharedCount={
                    myProfile
                      ? myProfile.interests.filter((i) => top.interests.includes(i)).length
                      : 0
                  }
                  onLike={() => void doSwipe(top, "like", "right")}
                  onPass={() => void doSwipe(top, "pass", "left")}
                  onSuper={() => handleSuper(top)}
                  onVibe={() => setVibeTarget(top)}
                  onOpen={() => navigate(`/app/profile/${top._id}`)}
                />
              )}
            </AnimatePresence>

            {/* First-visit swipe hint */}
            <AnimatePresence>
              {top && showHint && (
                <motion.div
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.97 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-x-0 bottom-0 z-20 p-4"
                >
                  <div className="glass rounded-3xl border border-border/70 p-4 shadow-2xl">
                    <div className="flex items-center gap-2">
                      <Hand className="size-4 text-primary" />
                      <p className="text-sm font-bold">{t("discover.swipeHint")}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <HintTile label={t("discover.pass")} icon="←" />
                      <HintTile label={t("discover.superVybe")} icon="↑" />
                      <HintTile label={t("discover.like")} icon="→" />
                    </div>
                    <button
                      type="button"
                      onClick={dismissHint}
                      className="mt-3 h-10 w-full rounded-full vybe-gradient text-sm font-bold text-white shadow-glow"
                    >
                      {t("common.gotIt")}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Action bar */}
      {top && visible.length > 0 && (
        <div className="flex items-center justify-center gap-5 pb-safe px-6 pt-3">
          <ActionButton
            label={t("discover.pass")}
            onClick={() => void doSwipe(top, "pass", "left")}
            disabled={actionLock}
            className="border-red-500/40 bg-card text-red-400"
          >
            <X className="size-6" strokeWidth={2.5} />
          </ActionButton>
          <ActionButton
            label={t("discover.superVybe")}
            onClick={() => handleSuper(top)}
            disabled={actionLock}
            className="vybe-gradient text-white shadow-glow"
            big
          >
            <Sparkles className="size-7" />
          </ActionButton>
          <ActionButton
            label={t("discover.like")}
            onClick={() => void doSwipe(top, "like", "right")}
            disabled={actionLock}
            className="border-emerald-500/40 bg-card text-emerald-400"
          >
            <Heart className="size-6" strokeWidth={2.5} />
          </ActionButton>
        </div>
      )}

      {/* Vibe picker sheet */}
      <AnimatePresence>
        {vibeTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setVibeTarget(null)}
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
              <h3 className="font-display text-xl font-bold">{t("discover.vibeTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("discover.vibeSubtitle")}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {VIBES.map((v) => (
                  <button
                    key={v.type}
                    type="button"
                    disabled={vibeBusy}
                    onClick={() => void handleVibe(v.type)}
                    className="flex min-h-14 items-center gap-2.5 rounded-2xl border border-border/70 bg-muted/40 px-3.5 py-3 text-left transition-all active:scale-[0.97] disabled:opacity-50"
                  >
                    <span className="text-xl">{v.emoji}</span>
                    <span className="text-sm font-bold">{v.label}</span>
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

function QuickLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-8 items-center gap-1 rounded-full border border-border/70 bg-card/50 px-3 text-[11px] font-bold text-muted-foreground active:scale-95"
    >
      {label}
    </button>
  );
}

function HintTile({ label, icon }: { label: string; icon: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border/70 bg-background/60 px-2 py-2.5">
      <span className="text-base leading-none">{icon}</span>
      <span className="text-[10px] font-semibold text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function ActionButton({
  children,
  label,
  onClick,
  disabled,
  className,
  big,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  big?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "flex items-center justify-center rounded-full border-2 transition-all active:scale-90 disabled:opacity-40",
          big ? "size-[68px]" : "size-[60px]",
          className,
        )}
      >
        {children}
      </button>
      <span className="text-[10px] font-semibold text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

const MOOD_EMOJI: Record<string, string> = {
  chill: "🌊",
  social: "🥳",
  romantic: "🌹",
  adventurous: "🧗",
  chatty: "💬",
  quiet: "🌙",
  creative: "🎨",
  active: "⚡",
};

function ProfileCard({
  profile,
  exiting,
  distance,
  todayVibe,
  mood,
  sharedCount,
  onLike,
  onPass,
  onSuper,
  onVibe,
  onOpen,
}: {
  profile: Profile;
  exiting: { id: string; dir: "left" | "right" | "up" } | null;
  distance: string | null;
  todayVibe: TodayVibe;
  mood: string;
  sharedCount: number;
  onLike: () => void;
  onPass: () => void;
  onSuper: () => void;
  onVibe: () => void;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  const [photoIdx, setPhotoIdx] = useState(0);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-14, 14]);
  const likeOpacity = useTransform(x, [40, 110], [0, 1]);
  const passOpacity = useTransform(x, [-110, -40], [1, 0]);
  const superOpacity = useTransform(y, [-110, -50], [1, 0]);

  const photo = profile.photos[photoIdx % Math.max(1, profile.photos.length)];
  const age = ageFromDateOfBirth(profile.dateOfBirth);

  const exitTarget = (() => {
    if (!exiting) return null;
    if (exiting.dir === "left") return { x: -480, y: 0, rotate: -18 };
    if (exiting.dir === "right") return { x: 480, y: 0, rotate: 18 };
    return { x: 0, y: -520, rotate: 0 };
  })();

  return (
    <motion.div
      className="absolute inset-0 z-10 touch-pan-y"
      style={{ x, y, rotate }}
      drag
      dragElastic={0.85}
      dragMomentum={false}
      animate={exitTarget ?? { x: 0, y: 0, rotate: 0 }}
      exit={exitTarget ?? { opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      onDragEnd={(_, info) => {
        const { offset } = info;
        if (offset.x > SWIPE_THRESHOLD) onLike();
        else if (offset.x < -SWIPE_THRESHOLD) onPass();
        else if (offset.y < SUPER_THRESHOLD) onSuper();
      }}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-[1.75rem] border border-border/60 bg-card shadow-xl"
        role="button"
        aria-label={`${profile.firstName}, ${age}`}
        onClick={onOpen}
      >
        <ImageWithFallback
          src={photo}
          name={profile.firstName}
          alt={`${profile.firstName}, ${age}`}
          className="absolute inset-0"
          sizes="(max-width: 430px) 100vw, 382px"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/25" />

        {/* Photo nav */}
        {profile.photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={(e) => {
                e.stopPropagation();
                setPhotoIdx((i) => (i - 1 + profile.photos.length) % profile.photos.length);
              }}
              className="absolute left-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur active:bg-black/50"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={(e) => {
                e.stopPropagation();
                setPhotoIdx((i) => (i + 1) % profile.photos.length);
              }}
              className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur active:bg-black/50"
            >
              <ChevronRight className="size-5" />
            </button>
            <DotPagination
              count={profile.photos.length}
              active={photoIdx % profile.photos.length}
              className="absolute left-1/2 top-3 -translate-x-1/2"
            />
          </>
        )}

        {/* Swipe badges */}
        <motion.div
          style={{ opacity: likeOpacity }}
          className="absolute left-4 top-6 rotate-[-12deg] rounded-xl border-[3px] border-emerald-400 px-3 py-1 font-display text-xl font-bold uppercase tracking-widest text-emerald-300"
        >
          {t("discover.like")}
        </motion.div>
        <motion.div
          style={{ opacity: passOpacity }}
          className="absolute right-4 top-6 rotate-[12deg] rounded-xl border-[3px] border-red-400 px-3 py-1 font-display text-xl font-bold uppercase tracking-widest text-red-300"
        >
          {t("discover.pass")}
        </motion.div>
        <motion.div
          style={{ opacity: superOpacity }}
          className="absolute bottom-40 left-1/2 -translate-x-1/2 rotate-[-6deg] rounded-xl border-[3px] border-sky-300 px-3 py-1 font-display text-xl font-bold uppercase tracking-widest text-sky-300"
        >
          {t("discover.superVybe")}
        </motion.div>

        {/* Info */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-[26px] font-bold leading-none text-white">
              {profile.firstName}, {age}
            </h2>
            <VerifiedBadge verified={profile.verified} />
          </div>
          {distance && (
            <p className="mt-1 text-sm font-medium text-white/70">{distance}</p>
          )}
          {sharedCount > 0 && (
            <p className="mt-0.5 text-[11px] font-bold text-violet-300">
              {t("discover.sharedCount", { count: sharedCount })}
            </p>
          )}
          {mood && (
            <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">
              {MOOD_EMOJI[mood] ?? "✨"} {t(`mood.${mood}` as TKey)}
            </p>
          )}
          {todayVibe && todayVibe.answer && (
            <div className="mt-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-300">
                {t("discover.dailyVibe")}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-white/90">
                "{todayVibe.answer}"
              </p>
            </div>
          )}
          {profile.bio && (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-white/85">
              {profile.bio}
            </p>
          )}
          {profile.interests.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {profile.interests.slice(0, 3).map((i) => (
                <span
                  key={i}
                  className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur"
                >
                  {i}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              className="flex items-center gap-1 text-xs font-semibold text-white/70"
            >
              <Info className="size-3.5" />
              {t("discover.tapHint")}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVibe();
              }}
              className="flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold text-white backdrop-blur transition-all active:scale-95"
            >
              <Sparkles className="size-3.5" />
              {t("discover.vibe")}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
