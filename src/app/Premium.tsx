import { api } from "@/convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { useNavigate, useSearchParams } from "react-router";
import { useI18n, type TKey } from "@/lib/i18n";
import { ScreenHeader } from "@/components/mobile/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  BadgeCheck,
  Check,
  Crown,
  Loader2,
  RefreshCw,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type PlanId = "free" | "silver" | "gold" | "platinum";

const PLAN_ACCENT: Record<string, string> = {
  silver: "from-slate-200/90 via-slate-300/70 to-slate-400/60 text-slate-900",
  gold: "from-amber-200/90 via-amber-300/70 to-yellow-400/60 text-amber-950",
  platinum: "vybe-gradient text-white",
};

function formatPrice(usd: number) {
  return Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    usd,
  );
}

export default function Premium() {
  const { t, formatFullDate } = useI18n();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const plans = useQuery(api.plans.getPlans);
  const ent = useQuery(api.plans.myEntitlements);
  const mySub = useQuery(api.subscriptions.mySubscription);

  const startPurchase = useAction(api.subscriptions.startPurchase);
  const refresh = useMutation(api.subscriptions.refreshSubscription);
  const restore = useMutation(api.subscriptions.restorePurchases);
  const manage = useMutation(api.subscriptions.manageSubscription);
  const track = useMutation(api.analytics.track);

  const [period, setPeriod] = useState<"monthly" | "annual">("monthly");
  const [purchasing, setPurchasing] = useState<PlanId | null>(null);
  const [busy, setBusy] = useState<"restore" | "manage" | null>(null);
  const [storeNote, setStoreNote] = useState<string | null>(null);
  const bannerRef = useRef(false);

  // Refresh state + track screen view once per visit.
  useEffect(() => {
    void refresh();
    if (!bannerRef.current) {
      bannerRef.current = true;
      void track({ event: "subscription_screen_viewed" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const purchaseResult = params.get("purchase");
  useEffect(() => {
    if (purchaseResult === "success") {
      void refresh();
      void track({ event: "purchase_completed", metadata: { plan: ent?.plan ?? "" } });
      toast.success(
        t("premium.purchaseSuccess", { plan: ent?.planName ?? "VYBE" }),
      );
      const next = new URLSearchParams(params);
      next.delete("purchase");
      setParams(next, { replace: true });
    } else if (purchaseResult === "cancelled") {
      void track({ event: "purchase_failed", metadata: { reason: "cancelled" } });
      toast(t("premium.purchaseCancelled"));
      const next = new URLSearchParams(params);
      next.delete("purchase");
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseResult]);

  const buy = async (plan: PlanId) => {
    if (plan === "free" || purchasing) return;
    setPurchasing(plan);
    setStoreNote(null);
    try {
      await track({ event: "purchase_started", metadata: { plan } });
      const res = await startPurchase({ plan: plan as "silver" | "gold" | "platinum", period });
      if (!res.available) {
        if (res.reason === "pricing_not_configured") {
          setStoreNote(t("premium.storeUnavailable"));
        } else {
          setStoreNote(t("premium.storeUnavailable"));
        }
        return;
      }
      // Platform store checkout (Stripe). Server-side webhook confirms the
      // purchase and grants entitlements — never a client-side fake success.
      window.location.href = res.url;
    } catch {
      toast.error(t("premium.purchaseError"));
    } finally {
      setPurchasing(null);
    }
  };

  const doRestore = async () => {
    setBusy("restore");
    try {
      const res = await restore();
      if (res.restored) {
        toast.success(t("premium.restored"));
      } else if (res.reason === "platform_restore_required") {
        toast(res.note ?? t("premium.restored"));
      } else {
        toast(t("premium.restoredDesc"));
      }
      await refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(null);
    }
  };

  const doManage = async () => {
    setBusy("manage");
    try {
      const res = await manage();
      if (res.available && res.url) {
        window.location.href = res.url;
      } else {
        toast(res.reason ?? t("premium.storeUnavailable"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(null);
    }
  };

  const currentPlan = (ent?.plan ?? "free") as PlanId;
  const savingsPct = (monthly: number, annual: number) =>
    monthly > 0 ? Math.round((1 - annual / (monthly * 12)) * 100) : 0;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ScreenHeader title={t("premium.title")} onBack={() => navigate(-1)} />

      <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
        {/* Hero */}
        <div className="relative overflow-hidden px-5 pt-4">
          <div className="pointer-events-none absolute -right-16 -top-10 size-52 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 top-20 size-44 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl vybe-gradient shadow-glow">
              <Crown className="size-6 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">
                {t("premium.subtitle")}
              </h1>
              <p className="text-xs text-muted-foreground">
                {t("premium.currentPlan")}:{" "}
                <span className="font-semibold text-foreground">
                  {ent?.planName ?? t("premium.free")}
                </span>
              </p>
            </div>
          </div>

          {mySub?.expiresAt && (
            <p className="mt-3 rounded-2xl border border-border/60 bg-card/50 px-4 py-2.5 text-xs text-muted-foreground">
              {mySub.status === "grace_period"
                ? t("premium.expiresOn", { date: formatFullDate(mySub.expiresAt) })
                : t("premium.renewsOn", { date: formatFullDate(mySub.expiresAt) })}
            </p>
          )}

          {/* Period toggle */}
          <div className="mt-5 flex rounded-full border border-border/70 bg-card/60 p-1">
            {(["monthly", "annual"] as const).map((p) => {
              const active = period === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "relative flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-bold transition-all",
                    active ? "vybe-gradient text-white shadow-glow" : "text-muted-foreground",
                  )}
                >
                  {p === "monthly" ? t("premium.monthly") : t("premium.annual")}
                  {p === "annual" && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                        active ? "bg-white/20 text-white" : "bg-emerald-500/15 text-emerald-400",
                      )}
                    >
                      −{plans ? savingsPct(plans.plans[1]?.monthlyPrice ?? 9.99, plans.plans[1]?.annualPrice ?? 69.99) : 40}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Plan cards */}
        <div className="mt-4 flex flex-col gap-3 px-5">
          {plans === undefined ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-3xl bg-muted" />
              ))}
            </div>
          ) : (
            plans.plans
              .filter((p) => p.id !== "free")
              .map((p) => {
                const active = currentPlan === p.id;
                const price = period === "monthly" ? p.monthlyPrice : p.annualPrice;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "relative overflow-hidden rounded-3xl border p-4 transition-all",
                      active
                        ? "border-primary/60 bg-card shadow-glow"
                        : "border-border/60 bg-card/50",
                    )}
                  >
                    <div
                      className={cn(
                        "absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r",
                        PLAN_ACCENT[p.id].split(" ").slice(0, 3).join(" "),
                      )}
                    />
                    <div className="mt-1 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-lg font-bold">{p.name}</h3>
                          {p.bestValue && (
                            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
                              {t("premium.popular")}
                            </span>
                          )}
                          {active && (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                              <BadgeCheck className="size-3" />
                              {t("premium.currentBadge")}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{p.tagline}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-display text-lg font-bold leading-tight sm:text-xl">
                          {price === 0 ? t("premium.free") : formatPrice(price)}
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {period === "monthly" ? "/mo" : "/yr"}
                          </span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {period === "monthly"
                            ? `${t("premium.or")} ${formatPrice(p.annualPrice)}/yr`
                            : `${t("premium.or")} ${formatPrice(p.monthlyPrice)}/mo`}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {period === "monthly"
                            ? t("premium.billedMonthly")
                            : t("premium.billedAnnually")}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.features.slice(0, 4).map((f) => (
                        <span
                          key={f}
                          className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                        >
                          {f}
                        </span>
                      ))}
                      {p.features.length > 4 && (
                        <span className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                          +{p.features.length - 4}
                        </span>
                      )}
                    </div>

                    <Button
                      onClick={() => void buy(p.id as PlanId)}
                      disabled={active || purchasing !== null}
                      className={cn(
                        "mt-3.5 h-12 w-full rounded-full font-bold",
                        active
                          ? "border border-border bg-card text-muted-foreground"
                          : "vybe-gradient text-white shadow-glow",
                      )}
                    >
                      {purchasing === p.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : active ? (
                        t("premium.currentBadge")
                      ) : currentPlan === "free" ? (
                        t("premium.upgrade")
                      ) : (
                        t("premium.choose", { plan: p.name })
                      )}
                    </Button>
                  </div>
                );
              })
          )}

          {storeNote && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-200">
              <X className="mt-0.5 size-3.5 shrink-0" />
              {storeNote}
            </div>
          )}
        </div>

        {/* Feature comparison */}
        <div className="mt-6 px-5">
          <h3 className="flex items-center gap-2 font-display text-base font-bold">
            <Sparkles className="size-4 text-primary" />
            {t("premium.compare")}
          </h3>
          <div className="mt-3 overflow-x-auto rounded-3xl border border-border/60">
            <table className="w-full min-w-[440px] table-auto text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-card/60">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground" />
                  {(["free", "silver", "gold", "platinum"] as const).map((pid) => (
                    <th key={pid} className="px-2 py-3 text-center">
                      <span
                        className={cn(
                          "text-xs font-bold",
                          pid === "free"
                            ? "text-muted-foreground"
                            : pid === "platinum"
                              ? "text-primary"
                              : "text-foreground",
                        )}
                      >
                        {pid === "free"
                          ? t("premium.free")
                          : pid.charAt(0).toUpperCase() + pid.slice(1)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plans?.features.map((f, i) => (
                  <tr
                    key={f.key}
                    className={cn(
                      "border-b border-border/40 last:border-b-0",
                      i % 2 === 1 && "bg-card/40",
                    )}
                  >
                    <td className="min-w-0 px-3 py-2.5 text-[11px] font-medium leading-snug sm:text-xs">
                      {t(`premium.f.${f.key}` as TKey)}
                    </td>
                    {(Object.keys(f.plans) as PlanId[]).map((pid) => {
                      const v = f.plans[pid];
                      return (
                        <td key={pid} className="px-2 py-2.5 text-center">
                          {typeof v === "boolean" ? (
                            v ? (
                              <Check className="mx-auto size-4 text-emerald-400" />
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )
                          ) : (
                            <span className="text-[11px] font-semibold text-muted-foreground">
                              {v}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Billing actions */}
        <div className="mt-6 flex flex-col gap-2.5 px-5">
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() => void doRestore()}
            className="h-12 w-full rounded-full border-border bg-card text-sm font-semibold"
          >
            {busy === "restore" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {t("premium.restore")}
          </Button>
          <Button
            variant="outline"
            disabled={busy !== null}
            onClick={() => void doManage()}
            className="h-12 w-full rounded-full border-border bg-card text-sm font-semibold"
          >
            {busy === "manage" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Settings2 className="size-4" />
            )}
            {t("premium.manage")}
          </Button>
          <p className="mt-1 px-2 text-center text-[11px] leading-relaxed text-muted-foreground">
            {t("premium.terms")}
          </p>
        </div>
      </div>
    </div>
  );
}
