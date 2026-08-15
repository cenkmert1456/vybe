import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { ImageWithFallback } from "@/components/mobile/ImageWithFallback";
import { ScreenHeader, VerifiedBadge } from "@/components/mobile/ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { EyeOff, Loader2, Play, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type BlindItem = {
  _id: string;
  status: string;
  createdAt: number;
  updatedAt: number;
  other: {
    _id: string;
    firstName: string;
    age: number;
    bio: string;
    interests: string[];
    city?: string;
    verified: boolean;
    voiceIntro?: { durationSec: number } | null;
    sharedInterests: number;
  } | null;
  canReveal: boolean;
  revealed: boolean;
  revealedByMe: boolean;
};

export default function BlindMatch() {
  const { t, formatRelativeTime } = useI18n();
  const navigate = useNavigate();
  const list = useQuery(api.blindMatches.myBlindMatches) as BlindItem[] | undefined;
  const start = useMutation(api.blindMatches.startBlindMatch);
  const respond = useMutation(api.blindMatches.respondToReveal);

  const [starting, setStarting] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const startNew = async () => {
    if (starting) return;
    setStarting(true);
    try {
      await start();
      haptic("success");
      toast.success(t("blind.started"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setStarting(false);
    }
  };

  const reveal = async (item: BlindItem, accept: boolean) => {
    if (acting) return;
    setActing(item._id);
    try {
      const res = await respond({ blindMatchId: item._id as any, accept });
      haptic(accept ? "success" : "light");
      if (res.status === "revealed") toast.success(t("blind.revealed"));
      else if (res.status === "declined") toast(t("blind.passed"));
      else toast(t("blind.waiting"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setActing(null);
    }
  };

  const items = list ?? [];

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ScreenHeader title={t("blind.title")} onBack={() => navigate(-1)} />
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-4">
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-primary/25 bg-gradient-to-br from-violet-500/10 via-transparent to-pink-500/10 p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl vybe-gradient text-white shadow-glow">
            <EyeOff className="size-5" />
          </span>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("blind.desc")}
          </p>
        </div>

        <Button
          onClick={() => void startNew()}
          disabled={starting}
          className="mt-4 h-12 w-full rounded-full vybe-gradient text-base font-bold text-white shadow-glow"
        >
          {starting ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <>
              <Sparkles className="size-4" />
              {t("blind.new")}
            </>
          )}
        </Button>

        {items.length === 0 && !list ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <EyeOff className="size-7" />
            </span>
            <p className="mt-3 text-sm font-semibold">{t("blind.emptyTitle")}</p>
            <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
              {t("blind.emptyDesc")}
            </p>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <motion.div
                  key={item._id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="overflow-hidden rounded-3xl border border-border/70 bg-card/60"
                >
                  {/* Hidden-photo card */}
                  <div className="relative flex aspect-[4/5] w-full items-center justify-center bg-gradient-to-br from-violet-500/20 via-card to-pink-500/20">
                    {item.revealed && item.other ? (
                      <ImageWithFallback
                        src={undefined}
                        name={item.other.firstName}
                        className="absolute inset-0 h-full w-full"
                      />
                    ) : (
                      <motion.div
                        animate={{ scale: [1, 1.04, 1] }}
                        transition={{ repeat: Infinity, duration: 3.5 }}
                        className="flex flex-col items-center"
                      >
                        <span className="flex size-16 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur">
                          <EyeOff className="size-7" />
                        </span>
                        <p className="mt-3 text-sm font-bold text-white/90">
                          {item.other?.firstName}, {item.other?.age}
                        </p>
                        <p className="text-[11px] text-white/60">{t("blind.hidden")}</p>
                      </motion.div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>

                  {/* Hidden info (bio/interests) */}
                  <div className="p-4">
                    {item.other && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold">{item.other.firstName}</p>
                          {item.other.verified && (
                            <VerifiedBadge verified status="verified" />
                          )}
                        </div>
                        {item.other.city && (
                          <p className="text-[11px] text-muted-foreground">
                            📍 {item.other.city}
                          </p>
                        )}
                        <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                          {item.other.bio || t("profile.noBio")}
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {item.other.interests.slice(0, 5).map((i) => (
                            <span
                              key={i}
                              className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground"
                            >
                              {i}
                            </span>
                          ))}
                        </div>
                        {item.other.sharedInterests > 0 && (
                          <p className="mt-2 text-[11px] font-semibold text-primary">
                            {t("blind.shared", { count: item.other.sharedInterests })}
                          </p>
                        )}
                        {item.other.voiceIntro && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            🎙 {t("blind.voiceHint")}
                          </p>
                        )}
                      </>
                    )}

                    {/* Actions */}
                    <div className="mt-3.5 flex items-center gap-2">
                      {item.status === "declined" ? (
                        <p className="flex-1 text-center text-xs font-semibold text-muted-foreground">
                          {t("blind.passedLabel")}
                        </p>
                      ) : item.revealed ? (
                        <Button
                          onClick={() =>
                            item.other && navigate(`/app/profile/${item.other._id}`)
                          }
                          className="h-11 flex-1 rounded-full vybe-gradient text-sm font-bold text-white shadow-glow"
                        >
                          <Play className="size-4" />
                          {t("blind.viewProfile")}
                        </Button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={acting === item._id}
                            onClick={() => void reveal(item, false)}
                            aria-label={t("blind.pass")}
                            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground active:scale-95 disabled:opacity-50"
                          >
                            <X className="size-5" />
                          </button>
                          <Button
                            disabled={acting === item._id || !item.canReveal}
                            onClick={() => void reveal(item, true)}
                            className={cn(
                              "h-11 flex-1 rounded-full text-sm font-bold",
                              item.revealedByMe
                                ? "border border-border bg-card text-muted-foreground"
                                : "vybe-gradient text-white shadow-glow",
                            )}
                          >
                            {acting === item._id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : item.revealedByMe ? (
                              t("blind.waiting")
                            ) : (
                              t("blind.reveal")
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
