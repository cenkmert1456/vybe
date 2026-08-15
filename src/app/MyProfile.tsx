import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { useI18n } from "@/lib/i18n";
import { ageFromDateOfBirth, profileCompletion } from "@/lib/format";
import { usePhotoUpload } from "@/components/mobile/PhotoUpload";
import { PhotoCarousel } from "@/components/mobile/PhotoCarousel";
import { ImageWithFallback } from "@/components/mobile/ImageWithFallback";
import { VerifiedBadge, SectionTitle } from "@/components/mobile/ui";
import { VoiceIntroRecorder } from "@/components/mobile/VoiceIntroRecorder";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  BadgeCheck,
  Camera,
  Check,
  Clock,
  Copy,
  Crown,
  Flame,
  Gift,
  ImagePlus,
  Loader2,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MOODS } from "@/lib/constants";
import { vibeEmoji } from "@/convex/vibes";

export default function MyProfile() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const myProfile = useQuery(api.profiles.myProfile);
  const ent = useQuery(api.plans.myEntitlements);
  const verification = useQuery(api.verification.myVerification);
  const vibes = useQuery(api.vibes.receivedVibes);
  const myComments = useQuery(api.photoComments.myPhotoComments);
  const deletePhotoComment = useMutation(api.photoComments.deletePhotoComment);

  const removeMyComment = async (id: string) => {
    try {
      await deletePhotoComment({ commentId: id as any });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  };

  if (!myProfile) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const completion = profileCompletion(myProfile);
  const age = ageFromDateOfBirth(myProfile.dateOfBirth);
  const needsVerify = verification?.status === "unverified";

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-5 pt-safe pb-2 pt-4">
        <h1 className="font-display text-[26px] font-bold leading-none">
          {t("nav.profile")}
        </h1>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label={t("profile.settings")}
            onClick={() => navigate("/app/settings")}
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
          >
            <Settings className="size-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-6">
        {/* Photos */}
        <div className="px-4">
          <PhotoCarousel
            photos={myProfile.photos}
            name={myProfile.firstName}
            className="aspect-[4/4.6] w-full rounded-3xl"
          />
        </div>

        <div className="px-5 pt-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-bold">
              {myProfile.firstName}, {age}
            </h2>
            <VerifiedBadge
              verified={myProfile.verified}
              status={myProfile.verificationStatus}
              size="md"
            />
          </div>
          {myProfile.city && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("common.inCity", { city: myProfile.city })}
            </p>
          )}

          {/* Membership */}
          <PremiumCard plan={ent?.plan ?? "free"} planName={ent?.planName ?? t("premium.free")} />

          {/* Completion */}
          {completion < 100 && (
            <button
              type="button"
              onClick={() => navigate("/app/edit")}
              className="mt-3 w-full rounded-2xl border border-primary/25 bg-primary/5 p-4 text-left"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">
                  {t("profile.completion", { pct: completion })}
                </p>
                <Sparkles className="size-4 text-primary" />
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${completion}%` }}
                  transition={{ duration: 0.6 }}
                  className="h-full rounded-full vybe-gradient"
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t("profile.completionHint")}
              </p>
            </button>
          )}

          {/* Verify */}
          {needsVerify && (
            <button
              type="button"
              onClick={() => navigate("/app/verify")}
              className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 text-left active:bg-muted/60"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
                <ShieldCheck className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{t("profile.verify")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("profile.verifyDesc")}
                </p>
              </div>
              <span className="text-xs font-bold text-primary">{t("common.continue")} →</span>
            </button>
          )}

          {/* Verification status */}
          <VerificationCard
            verified={myProfile.verified}
            verificationStatus={myProfile.verificationStatus ?? "unverified"}
            onVerify={() => navigate("/app/verify")}
          />

          {/* Boost */}
          <BoostCard />

          {/* Actions */}
          <div className="mt-4 flex gap-2.5">
            <Button
              onClick={() => navigate("/app/edit")}
              className="h-12 flex-1 rounded-full vybe-gradient text-sm font-bold text-white shadow-glow"
            >
              <SlidersHorizontal className="size-4" />
              {t("profile.edit")}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/app/settings")}
              className="h-12 flex-1 rounded-full border-border bg-card text-sm font-semibold"
            >
              <Settings className="size-4" />
              {t("profile.settings")}
            </Button>
          </div>

          {/* Quick links */}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => navigate("/app/prefs")}
              className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card/60 p-3.5 text-left active:bg-muted/60"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <SlidersHorizontal className="size-4" />
              </span>
              <span className="text-[13px] font-bold">
                {t("profile.discoveryPrefs")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/app/safety")}
              className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card/60 p-3.5 text-left active:bg-muted/60"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="size-4" />
              </span>
              <span className="text-[13px] font-bold">
                {t("profile.safetyCenter")}
              </span>
            </button>
          </div>

          {/* Daily Vibe + Referral */}
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => navigate("/app/daily")}
              className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card/60 p-3.5 text-left active:bg-muted/60"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
                <Flame className="size-4" />
              </span>
              <span className="text-[13px] font-bold">{t("profile.streak")}</span>
            </button>
            <ReferralCard />
          </div>

          {/* Voice intro */}
          <div className="mt-4">
            <VoiceIntroRecorder compact />
          </div>

          {/* My vibe — incoming vibes */}
          <VibesSection vibes={vibes ?? []} />

          {/* Question of the day */}
          <QotdCard />

          {/* Moments */}
          <MomentsSection />

          {/* Bio */}
          <div className="mt-6">
            <SectionTitle>{t("profile.bio")}</SectionTitle>
            <p className="mt-2 text-[15px] leading-relaxed">
              {myProfile.bio || (
                <span className="text-muted-foreground">{t("profile.bioEmpty")}</span>
              )}
            </p>
          </div>

          {/* Interests */}
          <div className="mt-6">
            <SectionTitle>{t("profile.interests")}</SectionTitle>
            {myProfile.interests.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {myProfile.interests.map((i) => (
                  <span
                    key={i}
                    className="rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary"
                  >
                    {i}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("profile.interestsEmpty")}
              </p>
            )}
          </div>

          {/* Languages */}
          {myProfile.languages.length > 0 && (
            <div className="mt-6">
              <SectionTitle>{t("profile.languages")}</SectionTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                {myProfile.languages.join(" · ")}
              </p>
            </div>
          )}

          {/* Prompts */}
          <div className="mt-6 space-y-3">
            <SectionTitle>{t("profile.prompts")}</SectionTitle>
            {myProfile.prompts.length ? (
              myProfile.prompts.map((p, i) => (
                <div key={i} className="rounded-2xl border border-border/70 bg-card/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">
                    {p.question}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed">{p.answer}</p>
                </div>
              ))
            ) : (
              <button
                type="button"
                onClick={() => navigate("/app/edit")}
                className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground active:bg-muted/60"
              >
                {t("profile.promptsEmpty")}
              </button>
            )}
          </div>

          {/* Comments on my photos (matches only) */}
          {myComments !== undefined && myComments.length > 0 && (
            <div className="mt-6">
              <SectionTitle>{t("photoComments.title")}</SectionTitle>
              <div className="mt-2 flex flex-col gap-2">
                {myComments.slice(0, 6).map((c) => (
                  <div
                    key={c._id}
                    className="flex items-start gap-2.5 rounded-2xl border border-border/60 bg-card/50 p-3"
                  >
                    <div className="size-9 shrink-0 overflow-hidden rounded-full">
                      <ImageWithFallback
                        src={c.commenter.photos[0]}
                        name={c.commenter.firstName}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-bold">{c.commenter.firstName}</p>
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                          {t("photoComments.photoLabel", { n: c.photoIndex + 1 })}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[13px] leading-snug">{c.text}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void removeMyComment(c._id)}
                      className="shrink-0 text-[10px] font-semibold text-muted-foreground"
                    >
                      {t("photoComments.delete")}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReferralCard() {
  const { t } = useI18n();
  const info = useQuery(api.referrals.myReferral);
  const ensure = useMutation(api.referrals.ensureReferralCode);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!info?.code) return;
    try {
      await navigator.clipboard.writeText(info.code);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  useEffect(() => {
    if (info && !info.code) void ensure();
  }, [info, ensure]);

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card/60 p-3.5 text-left active:bg-muted/60"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
        <Gift className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold">{t("referral.title")}</span>
        <span className="block truncate text-[10px] font-bold tabular-nums text-primary">
          {info?.code ?? "VYBE-•••••"}
        </span>
        {info && info.inviteCount > 0 && (
          <span className="block text-[10px] text-muted-foreground">
            {t("referral.invites", { n: info.inviteCount })}
          </span>
        )}
      </span>
      {copied ? (
        <Check className="size-4 shrink-0 text-emerald-400" />
      ) : (
        <Copy className="size-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

function VerificationCard({
  verified,
  verificationStatus,
  onVerify,
}: {
  verified: boolean;
  verificationStatus: string;
  onVerify: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const statusKey = verified
    ? "verify.status.approved"
    : verificationStatus === "in_progress"
      ? "verify.status.pending"
      : verificationStatus === "failed"
        ? "verify.status.failed"
        : "verify.status.unverified";

  const statusColor = verified
    ? "text-emerald-400 bg-emerald-500/15"
    : verificationStatus === "in_progress"
      ? "text-sky-400 bg-sky-500/15"
      : verificationStatus === "failed"
        ? "text-destructive bg-destructive/10"
        : "text-muted-foreground bg-muted";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (verified) return;
          setOpen(true);
        }}
        className="mt-3 w-full rounded-2xl border border-border/70 bg-card/60 p-4 text-left active:bg-muted/60"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-full",
              verified ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/10 text-primary",
            )}
          >
            {verified ? <BadgeCheck className="size-5" /> : <ShieldCheck className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{t("profile.verification")}</p>
            <span
              className={cn(
                "mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold",
                statusColor,
              )}
            >
              {t(statusKey as any)}
            </span>
          </div>
          {!verified && (
            <span className="text-xs font-bold text-primary">{t("common.continue")} →</span>
          )}
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("verify.title")}</DialogTitle>
            <DialogDescription>{t("verify.live.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {[
              { icon: <MailCheckIcon />, label: t("verify.step.email"), done: true },
              { icon: <Camera className="size-4" />, label: t("verify.step.photo"), done: verified },
              { icon: <BadgeCheck className="size-4" />, label: t("verify.step.identity"), done: false },
            ].map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 px-3.5 py-3"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    s.done ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground",
                  )}
                >
                  {s.done ? <Check className="size-4" /> : s.icon}
                </span>
                <span className="flex-1 text-sm font-semibold">{s.label}</span>
                {i === 2 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {t("verify.comingSoon")}
                  </span>
                )}
              </div>
            ))}
            <Button
              onClick={() => {
                setOpen(false);
                onVerify();
              }}
              className="mt-2 h-12 rounded-full vybe-gradient font-bold text-white shadow-glow"
            >
              <Camera className="size-4" />
              {t("verify.consent.start")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MailCheckIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      <path d="m16 19 2 2 4-4" />
    </svg>
  );
}

function VibesSection({
  vibes,
}: {
  vibes: {
    type: string;
    createdAt: number;
    from: { _id: string; firstName: string; photos: string[] } | null;
  }[];
}) {
  const { t, formatRelativeTime } = useI18n();
  if (vibes.length === 0) return null;
  const recent = vibes.slice(0, 6);
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <SectionTitle>{t("profile.myVibe")}</SectionTitle>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {t("profile.vibesReceived", { n: vibes.length })}
        </span>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {recent.map((v, i) => (
          <div
            key={`${v.type}-${v.createdAt}-${i}`}
            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/50 px-3.5 py-2.5"
          >
            <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full">
              {v.from?.photos?.[0] ? (
                <img src={v.from.photos[0]} alt={v.from.firstName} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-primary/10 text-xs font-bold text-primary">
                  {v.from?.firstName?.[0] ?? "?"}
                </span>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">
                {v.from?.firstName ?? "Someone"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatRelativeTime(v.createdAt)}
              </p>
            </div>
            <span className="text-lg">{vibeEmoji(v.type)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PremiumCard({ plan, planName }: { plan: string; planName: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const paid = plan !== "free";
  return (
    <button
      type="button"
      onClick={() => navigate("/app/premium")}
      className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 text-left active:bg-muted/60"
    >
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full",
          paid ? "vybe-gradient shadow-glow" : "bg-primary/10 text-primary",
        )}
      >
        {paid ? <Crown className="size-5 text-white" /> : <Sparkles className="size-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{t("profile.premium")}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {paid ? planName : t("profile.premiumDesc")}
        </p>
      </div>
      <span className="text-xs font-bold text-primary">
        {paid ? t("premium.manage") : t("profile.goPremium")} →
      </span>
    </button>
  );
}

function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function BoostCard() {
  const { t } = useI18n();
  const boost = useQuery(api.boosts.boostStatus);
  const activate = useMutation(api.boosts.activateBoost);
  const sweep = useMutation(api.boosts.sweepExpiredBoost);
  useNow(15000);
  const sweptRef = useRef(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (sweptRef.current) return;
    sweptRef.current = true;
    void sweep();
  }, [sweep]);

  if (!boost) return null;

  const active = boost.active ? Math.max(0, Math.ceil(boost.active.remainingMs / 60000)) : 0;
  const hasCredits = boost.credits > 0;

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-rose-500/10 p-4">
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            active > 0 ? "bg-orange-500 text-white shadow-glow" : "bg-orange-500/15 text-orange-400",
          )}
        >
          <Flame className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{t("boost.title")}</p>
          {active > 0 ? (
            <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-orange-400">
              <Clock className="size-3" />
              {t("boost.remaining", { min: active })}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("boost.credits", { n: boost.credits })}
            </p>
          )}
        </div>
        <Button
          size="sm"
          disabled={pending || active > 0 || !hasCredits}
          onClick={async () => {
            setPending(true);
            try {
              await activate();
              toast.success(t("boost.activeNow"));
            } catch (e) {
              toast.error(e instanceof Error ? e.message : t("common.error"));
            } finally {
              setPending(false);
            }
          }}
          className="h-9 rounded-full bg-orange-500 px-4 text-xs font-bold text-white shadow-glow hover:bg-orange-500/90"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : active > 0 ? (
            t("boost.active")
          ) : (
            t("boost.activate")
          )}
        </Button>
      </div>

      {boost.lastResult && (
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-black/10 p-3 dark:bg-white/5">
          <Metric label={t("boost.views")} value={boost.lastResult.views} />
          <Metric label={t("boost.likes")} value={boost.lastResult.likes} />
          <Metric label={t("boost.matches")} value={boost.lastResult.matches} />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-base font-bold">{value}</p>
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function QotdCard() {
  const { t } = useI18n();
  const qotd = useQuery(api.dailyQuestions.todayQuestion);
  const save = useMutation(api.dailyQuestions.saveDailyAnswer);
  const track = useMutation(api.analytics.track);
  const [answer, setAnswer] = useState("");
  const [share, setShare] = useState(true);
  const [pending, setPending] = useState(false);

  if (!qotd) return null;

  const submit = async () => {
    if (!answer.trim() || pending) return;
    setPending(true);
    try {
      await save({
        date: qotd.date,
        question: qotd.question,
        answer: answer.trim(),
        shareOnProfile: share,
      });
      await track({ event: "daily_question_answered" });
      toast.success(t("qotd.answered"));
      setAnswer("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("qotd.error"));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-primary">
        <Sparkles className="size-3.5" />
        {t("qotd.title")}
      </p>
      <p className="mt-1.5 text-sm font-semibold leading-relaxed">{qotd.question}</p>

      {qotd.answered ? (
        <p className="mt-2 rounded-xl bg-background/60 px-3 py-2.5 text-sm">
          {qotd.answer}
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {t("qotd.answered")}
          </span>
        </p>
      ) : (
        <>
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={t("qotd.placeholder")}
            maxLength={300}
            className="mt-2.5 min-h-20 rounded-xl border-input bg-card px-3.5 py-2.5 text-sm"
          />
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShare((s) => !s)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all",
                share
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              <Check className="size-3" />
              {t("qotd.shareOnProfile")}
            </button>
            <Button
              size="sm"
              disabled={pending || !answer.trim()}
              onClick={() => void submit()}
              className="h-9 rounded-full vybe-gradient px-4 text-xs font-bold text-white shadow-glow"
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : t("qotd.submit")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function MomentsSection() {
  const { t } = useI18n();
  const moments = useQuery(api.moments.myMoments);
  const create = useMutation(api.moments.createMoment);
  const remove = useMutation(api.moments.deleteMoment);
  const track = useMutation(api.analytics.track);
  const { uploading, uploadAndGetUrl } = usePhotoUpload();

  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [mood, setMood] = useState<string>(MOODS[0]);
  const [visibility, setVisibility] = useState<"matches" | "public">("matches");
  const [pending, setPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (moments === undefined) return null;

  const pick = async (file: File) => {
    try {
      const url = await uploadAndGetUrl(file);
      setPhoto(url);
    } catch {
      toast.error(t("common.error"));
    }
  };

  const submit = async () => {
    if (!photo || pending) return;
    setPending(true);
    try {
      await create({
        image: photo,
        caption: caption.trim() || undefined,
        mood,
        visibility,
      });
      await track({ event: "moment_created" });
      toast.success(t("moment.added"));
      setOpen(false);
      setPhoto(null);
      setCaption("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("moment.photoRequired"));
    } finally {
      setPending(false);
    }
  };

  const removeMoment = async (id: string) => {
    try {
      await remove({ momentId: id as any });
      toast(t("moment.deleted"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <SectionTitle>{t("moment.title")}</SectionTitle>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary active:bg-primary/20"
        >
          <ImagePlus className="size-3.5" />
          {t("moment.add")}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t("moment.desc")}</p>

      {moments.length === 0 ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 w-full rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground active:bg-muted/60"
        >
          {t("moment.empty")}
        </button>
      ) : (
        <div className="mt-3 flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {moments.map((m) => (
            <div key={m._id} className="relative w-28 shrink-0 overflow-hidden rounded-2xl">
              <img src={m.image} alt={m.caption || "Moment"} className="aspect-[3/4] w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
              <span className="absolute left-1.5 top-1.5 text-sm">{m.mood}</span>
              {m.caption && (
                <p className="absolute inset-x-1.5 bottom-1.5 line-clamp-2 text-[10px] font-semibold text-white">
                  {m.caption}
                </p>
              )}
              <span className="absolute right-1.5 top-1.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] font-bold text-white/80">
                {Math.max(1, Math.ceil((m.expiresAt - Date.now()) / 3600000))}h
              </span>
              <button
                type="button"
                aria-label={t("moment.delete")}
                onClick={() => void removeMoment(m._id)}
                className="absolute bottom-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-black/50 text-white active:bg-black/70"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t("moment.add")}</DialogTitle>
            <DialogDescription>{t("moment.desc")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {photo ? (
              <div className="relative overflow-hidden rounded-2xl border border-border/60">
                <img src={photo} alt="Moment" className="aspect-[4/3] w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhoto(null)}
                  className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground"
              >
                {uploading ? (
                  <Loader2 className="size-6 animate-spin" />
                ) : (
                  <Camera className="size-7" />
                )}
                <span className="text-sm font-medium">{t("moment.addPhoto")}</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pick(f);
                e.target.value = "";
              }}
            />
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={t("moment.captionPlaceholder")}
              maxLength={160}
              className="min-h-16 rounded-xl border-input bg-card px-3.5 py-2.5 text-sm"
            />
            <div>
              <p className="text-xs font-semibold text-muted-foreground">{t("moment.mood")}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(m)}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full border text-lg transition-all",
                      mood === m
                        ? "border-primary bg-primary/15"
                        : "border-border bg-card",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">{t("moment.visibility")}</p>
              <div className="mt-1.5 flex gap-2">
                {(["matches", "public"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    className={cn(
                      "flex-1 rounded-full border py-2 text-xs font-semibold transition-all",
                      visibility === v
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {v === "matches" ? t("moment.vis.matches") : t("moment.vis.public")}
                  </button>
                ))}
              </div>
            </div>
            <Button
              disabled={!photo || pending}
              onClick={() => void submit()}
              className="h-12 rounded-full vybe-gradient font-bold text-white"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : t("moment.add")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
