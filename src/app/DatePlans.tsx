import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useNavigate, useSearchParams } from "react-router";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { ScreenHeader, EmptyState, ListSkeleton } from "@/components/mobile/ui";
import { ImageWithFallback } from "@/components/mobile/ImageWithFallback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Plus,
  Send,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Plan = {
  _id: string;
  matchId: string;
  status: string;
  title: string;
  venue?: string;
  city?: string;
  dateMs: number;
  notes: string;
  creatorProfileId: string;
  eventId?: string;
  eventImage?: string;
  createdAt: number;
  other: { _id: string; firstName: string; photos: string[] };
};

export default function DatePlans() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const matchParam = params.get("match");

  const plans = useQuery(api.datePlans.myDatePlans, {});
  const myMatches = useQuery(api.matches.listMatches);
  const myProfile = useQuery(api.profiles.myProfile);
  const respond = useMutation(api.datePlans.respondToDatePlan);
  const create = useMutation(api.datePlans.createDatePlan);

  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({
    matchId: matchParam ?? "",
    title: "",
    venue: "",
    city: "",
    date: "",
    time: "",
    notes: "",
  });

  // New-plan sheet opens automatically when arriving with ?match=<id> (from Chat).
  useEffect(() => {
    if (matchParam) setCreating(true);
  }, [matchParam]);

  const matchOptions = useMemo(
    () =>
      (myMatches ?? [])
        .filter((m) => m.status === "active")
        .map((m) => ({
          matchId: m.matchId,
          firstName: m.other.firstName,
          photo: m.other.photos[0],
        })),
    [myMatches],
  );

  const grouped = useMemo(() => {
    if (!plans) return null;
    const pending = plans.filter((p) => p.status === "pending");
    const upcoming = plans.filter((p) => p.status === "accepted");
    const past = plans.filter(
      (p) => p.status === "completed" || p.status === "cancelled" || p.status === "declined",
    );
    return { pending, upcoming, past };
  }, [plans]);

  const act = async (plan: Plan, action: "accept" | "decline" | "complete" | "cancel") => {
    if (busyId) return;
    setBusyId(plan._id);
    try {
      const res = await respond({ planId: plan._id as any, action });
      void res;
      haptic("success");
      toast.success(t(`dateplans.${res.status}Toast`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusyId(null);
    }
  };

  const submit = async () => {
    if (!form.matchId || !form.title.trim() || !form.date) {
      toast.error(t("dateplans.formError"));
      return;
    }
    const dateMs = new Date(`${form.date}T${form.time || "19:00"}`).getTime();
    if (Number.isNaN(dateMs)) {
      toast.error(t("dateplans.formError"));
      return;
    }
    try {
      await create({
        matchId: form.matchId as any,
        title: form.title.trim(),
        venue: form.venue.trim() || undefined,
        city: form.city.trim() || undefined,
        dateMs,
        notes: form.notes.trim() || undefined,
      });
      haptic("success");
      toast.success(t("dateplans.createdToast"));
      setCreating(false);
      setForm({ matchId: "", title: "", venue: "", city: "", date: "", time: "", notes: "" });
      if (matchParam) {
        const next = new URLSearchParams(params);
        next.delete("match");
        setParams(next, { replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ScreenHeader
        title={t("dateplans.title")}
        onBack={() => navigate(-1)}
        right={
          <Button
            onClick={() => setCreating(true)}
            className="flex size-9 items-center justify-center rounded-full vybe-gradient p-0 text-white shadow-glow"
            aria-label={t("dateplans.new")}
          >
            <Plus className="size-4" />
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
        {grouped === null ? (
          <div className="pt-4">
            <ListSkeleton rows={4} />
          </div>
        ) : plans && plans.length === 0 ? (
          <div className="pt-10">
            <EmptyState
              icon={<CalendarDays className="size-7" />}
              title={t("dateplans.emptyTitle")}
              hint={t("dateplans.emptyHint")}
              action={
                <Button
                  onClick={() => setCreating(true)}
                  className="rounded-full vybe-gradient px-6 font-bold text-white shadow-glow"
                >
                  <Plus className="size-4" />
                  {t("dateplans.new")}
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {grouped.pending.length > 0 && (
              <PlanSection label={t("dateplans.pending")}>
                {grouped.pending.map((p) => (
                  <PlanCard
                    key={p._id}
                    plan={p}
                    mine={myProfile?._id === p.creatorProfileId}
                    busy={busyId === p._id}
                    onAccept={() => void act(p, "accept")}
                    onDecline={() => void act(p, "decline")}
                    onCancel={() => void act(p, "cancel")}
                  />
                ))}
              </PlanSection>
            )}
            {grouped.upcoming.length > 0 && (
              <PlanSection label={t("dateplans.upcoming")}>
                {grouped.upcoming.map((p) => (
                  <PlanCard
                    key={p._id}
                    plan={p}
                    mine={myProfile?._id === p.creatorProfileId}
                    busy={busyId === p._id}
                    onComplete={() => void act(p, "complete")}
                    onCancel={() => void act(p, "cancel")}
                  />
                ))}
              </PlanSection>
            )}
            {grouped.past.length > 0 && (
              <PlanSection label={t("dateplans.past")} muted>
                {grouped.past.map((p) => (
                  <PlanCard key={p._id} plan={p} mine={myProfile?._id === p.creatorProfileId} past />
                ))}
              </PlanSection>
            )}
          </>
        )}
      </div>

      {/* Create plan sheet */}
      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setCreating(false)}
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
              <h3 className="font-display text-xl font-bold">{t("dateplans.new")}</h3>
              <div className="mt-4 flex flex-col gap-3">
                <select
                  value={form.matchId}
                  onChange={(e) => setForm((f) => ({ ...f, matchId: e.target.value }))}
                  className="h-12 w-full rounded-xl border border-input bg-card px-3.5 text-sm font-medium outline-none focus:border-primary"
                >
                  <option value="" disabled>
                    {t("dateplans.chooseMatch")}
                  </option>
                  {matchOptions.map((m) => (
                    <option key={m.matchId} value={m.matchId}>
                      {m.firstName}
                    </option>
                  ))}
                </select>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder={t("dateplans.titlePlaceholder")}
                  maxLength={120}
                  className="h-12 rounded-xl border-input bg-card text-sm"
                />
                <div className="grid grid-cols-2 gap-2.5">
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="h-12 rounded-xl border-input bg-card text-sm"
                  />
                  <Input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                    className="h-12 rounded-xl border-input bg-card text-sm"
                  />
                </div>
                <Input
                  value={form.venue}
                  onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                  placeholder={t("dateplans.venuePlaceholder")}
                  maxLength={120}
                  className="h-12 rounded-xl border-input bg-card text-sm"
                />
                <Input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder={t("dateplans.cityPlaceholder")}
                  maxLength={80}
                  className="h-12 rounded-xl border-input bg-card text-sm"
                />
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={t("dateplans.notesPlaceholder")}
                  maxLength={500}
                  className="min-h-20 rounded-xl border-input bg-card text-sm"
                />
                <Button
                  onClick={() => void submit()}
                  className="h-13 w-full rounded-full vybe-gradient text-base font-bold text-white shadow-glow"
                >
                  <Send className="size-4" />
                  {t("dateplans.sendInvite")}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlanSection({
  label,
  children,
  muted,
}: {
  label: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <section className={cn("mt-5", muted && "opacity-70")}>
      <h2 className="mb-2.5 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function PlanCard({
  plan,
  mine,
  busy,
  past,
  onAccept,
  onDecline,
  onComplete,
  onCancel,
}: {
  plan: Plan;
  mine: boolean;
  busy?: boolean;
  past?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onComplete?: () => void;
  onCancel?: () => void;
}) {
  const { t, formatClockTime, formatFullDate } = useI18n();

  return (
    <article className="overflow-hidden rounded-3xl border border-border/60 bg-card/60">
      <div className="flex gap-3 p-3.5">
        <div className="size-[76px] shrink-0 overflow-hidden rounded-2xl border border-border/50">
          {plan.eventImage ? (
            <ImageWithFallback src={plan.eventImage} name={plan.title} className="h-full w-full" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
              <CalendarDays className="size-6" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-bold">{plan.title}</h3>
            <StatusChip status={plan.status} />
          </div>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            {formatFullDate(plan.dateMs)} · {formatClockTime(plan.dateMs)}
          </p>
          {(plan.venue || plan.city) && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              {[plan.venue, plan.city].filter(Boolean).join(" · ")}
            </p>
          )}
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
            <span className="size-5 overflow-hidden rounded-full border border-border/50">
              <ImageWithFallback
                src={plan.other.photos[0]}
                name={plan.other.firstName}
                className="h-full w-full"
              />
            </span>
            {mine ? t("dateplans.sentTo", { name: plan.other.firstName }) : t("dateplans.from", { name: plan.other.firstName })}
          </p>
          {plan.notes && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {plan.notes}
            </p>
          )}
        </div>
      </div>

      {!past && (
        <div className="flex gap-2 border-t border-border/50 px-3.5 py-2.5">
          {onAccept && (
            <Button
              onClick={onAccept}
              disabled={busy}
              className="h-10 flex-1 rounded-full bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {t("dateplans.accept")}
            </Button>
          )}
          {onDecline && (
            <Button
              variant="outline"
              onClick={onDecline}
              disabled={busy}
              className="h-10 flex-1 rounded-full border-border bg-card text-muted-foreground"
            >
              <X className="size-4" />
              {t("dateplans.decline")}
            </Button>
          )}
          {onComplete && (
            <Button
              onClick={onComplete}
              disabled={busy}
              className="h-10 flex-1 rounded-full vybe-gradient text-white shadow-glow"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {t("dateplans.complete")}
            </Button>
          )}
          {onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={busy}
              className="h-10 flex-1 rounded-full border-border bg-card text-muted-foreground"
            >
              <XCircle className="size-4" />
              {t("dateplans.cancel")}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

function StatusChip({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-400",
    accepted: "bg-emerald-500/15 text-emerald-400",
    declined: "bg-destructive/10 text-destructive",
    completed: "bg-primary/10 text-primary",
    cancelled: "bg-muted text-muted-foreground",
  };
  const icons: Record<string, React.ReactNode> = {
    pending: <Clock className="size-3" />,
    accepted: <Check className="size-3" />,
    declined: <X className="size-3" />,
    completed: <CheckCircle2 className="size-3" />,
    cancelled: <XCircle className="size-3" />,
  };
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
        map[status],
      )}
    >
      {icons[status]}
      {t(`dateplans.status_${status}` as any)}
    </span>
  );
}
