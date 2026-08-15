import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { useI18n, type TKey } from "@/lib/i18n";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Check, Lock, Sparkles } from "lucide-react";

/** Entitlement keys that can trigger the upgrade sheet. */
export type GateFeature =
  | "dailyLikeLimit"
  | "monthlySuperVybes"
  | "rewindLimit"
  | "boostCreditsPerMonth"
  | "advancedFilters"
  | "likesVisibility"
  | "travelMode"
  | "readReceipts"
  | "priorityDiscovery"
  | "profileThemes"
  | "extendedInsights"
  | "incognito"
  | "profileBoosts"
  | "locationControls";

export function UpgradeSheet({
  open,
  onOpenChange,
  feature,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: GateFeature;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const plans = useQuery(api.plans.getPlans);

  const featureName = t(`upgrade.feature.${feature}` as TKey);
  const paid = plans?.plans.filter((p) => p.id !== "free") ?? [];

  const goPlans = () => {
    onOpenChange(false);
    navigate("/app/premium");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetTitle className="sr-only">{t("upgrade.title")}</SheetTitle>
        <div className="px-2 pb-safe">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10">
            <Lock className="size-6 text-primary" />
          </div>
          <h3 className="mt-4 text-center font-display text-xl font-bold">
            {t("upgrade.title")}
          </h3>
          <p className="mt-1.5 text-center text-sm leading-relaxed text-muted-foreground">
            {t("upgrade.desc", { feature: featureName })}
          </p>

          {paid.length > 0 && (
            <div className="mt-5 flex flex-col gap-2">
              {paid.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-2xl border border-border/70 bg-card/60 px-4 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    {p.id === "platinum" ? (
                      <Sparkles className="size-4 text-primary" />
                    ) : (
                      <Check className="size-4 text-primary" />
                    )}
                    <span className="text-sm font-bold">{p.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground">
                    {Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(p.monthlyPrice)}
                    <span className="text-xs">/mo</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 flex gap-2.5">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-12 flex-1 rounded-full border-border bg-card text-sm font-semibold"
            >
              {t("upgrade.notNow")}
            </Button>
            <Button
              onClick={goPlans}
              className="h-12 flex-1 rounded-full vybe-gradient text-sm font-bold text-white shadow-glow"
            >
              {t("upgrade.viewPlans")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
