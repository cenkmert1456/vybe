import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { ScreenHeader, SectionTitle } from "@/components/mobile/ui";
import { ImageWithFallback } from "@/components/mobile/ImageWithFallback";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/mobile/ConfirmDialog";
import { toast } from "sonner";
import {
  Check,
  Eye,
  EyeOff,
  Flag,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

const REPORT_STATUS_KEYS = {
  open: "safety.reportStatus_open",
  reviewed: "safety.reportStatus_reviewed",
  resolved: "safety.reportStatus_resolved",
} as const;

export default function SafetyCenter() {
  const { t, formatRelativeTime } = useI18n();
  const navigate = useNavigate();
  const myProfile = useQuery(api.profiles.myProfile);
  const blocked = useQuery(api.reports.blockedUsers);
  const reports = useQuery(api.reports.myReports);
  const setShowInDiscovery = useMutation(api.profiles.setShowInDiscovery);
  const unblock = useMutation(api.reports.unblockUser);
  const [pendingUnblock, setPendingUnblock] = useState<string | null>(null);
  const [hideOpen, setHideOpen] = useState(false);

  const hidden = myProfile ? !myProfile.showInDiscovery : false;

  const toggleHidden = async () => {
    try {
      await setShowInDiscovery({ show: !!hidden });
      haptic("light");
      toast(
        hidden ? t("safety.profileShown") : t("safety.profileHiddenToast"),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setHideOpen(false);
    }
  };

  const handleUnblock = async (id: string) => {
    setPendingUnblock(id);
    try {
      await unblock({ blockedProfileId: id as any });
      toast(t("settings.unblockedToast"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setPendingUnblock(null);
    }
  };

  const statusKey = (s: string): string =>
    REPORT_STATUS_KEYS[s as keyof typeof REPORT_STATUS_KEYS] ??
    "safety.reportStatus_open";

  const rules = [t("safety.rule1"), t("safety.rule2"), t("safety.rule3")];

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ScreenHeader
        title={t("safety.title")}
        onBack={() => navigate(-1)}
      />
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
        {/* Hero */}
        <div className="mt-4 rounded-2xl border border-border/70 bg-card/60 p-5">
          <ShieldCheck className="size-8 text-primary" />
          <h2 className="mt-2 font-display text-lg font-bold">
            {t("safety.title")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t("safety.desc")}
          </p>
        </div>

        {/* Hide profile */}
        <div className="mt-5">
          <SectionTitle className="px-3">{t("safety.hideProfile")}</SectionTitle>
          <div className="flex flex-col rounded-2xl border border-border/60 bg-card/50">
            <div className="flex items-center gap-3 px-3 py-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {hidden ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">
                  {t("safety.hideProfile")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("safety.hideProfileDesc")}
                </span>
              </span>
              <Switch
                checked={hidden}
                onCheckedChange={() => setHideOpen(true)}
              />
            </div>
          </div>
        </div>

        {/* Blocked users */}
        <div className="mt-5">
          <SectionTitle className="px-3">{t("safety.blocked")}</SectionTitle>
          <div className="flex flex-col rounded-2xl border border-border/60 bg-card/50">
            {blocked === undefined ? (
              <div className="space-y-3 p-4">
                {[0, 1].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : blocked.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                {t("settings.blockedEmpty")}
              </p>
            ) : (
              blocked.map((b) => (
                <div
                  key={b._id}
                  className="flex items-center gap-3 border-b border-border/50 px-3 py-3 last:border-b-0"
                >
                  <div className="size-11 shrink-0 overflow-hidden rounded-full">
                    <ImageWithFallback
                      src={b.photos[0]}
                      name={b.firstName}
                      className="h-full w-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold">{b.firstName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatRelativeTime(b.blockedAt)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pendingUnblock === b._id}
                    onClick={() => void handleUnblock(b._id)}
                    className="h-9 rounded-full text-xs font-semibold"
                  >
                    {pendingUnblock === b._id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      t("settings.unblock")
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* My reports */}
        <div className="mt-5">
          <SectionTitle className="px-3">{t("safety.reports")}</SectionTitle>
          <div className="flex flex-col rounded-2xl border border-border/60 bg-card/50">
            {reports === undefined ? (
              <div className="space-y-3 p-4">
                {[0, 1].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />
                ))}
              </div>
            ) : reports.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                {t("safety.reportsEmpty")}
              </p>
            ) : (
              reports.map((r) => (
                <div
                  key={r._id}
                  className="flex items-center gap-3 border-b border-border/50 px-4 py-3.5 last:border-b-0"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                    <Flag className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">
                      {t(`safety.cat_${r.category}` as any)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatRelativeTime(r.createdAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                    {t(statusKey(r.status) as any)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* How it works */}
        <div className="mt-5 rounded-2xl border border-border/70 bg-card/60 p-5">
          <h3 className="text-sm font-bold">{t("safety.howItWorks")}</h3>
          <ul className="mt-3 space-y-2.5">
            {rules.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ConfirmDialog
        open={hideOpen}
        onOpenChange={setHideOpen}
        title={hidden ? t("safety.showProfile") : t("safety.hideProfile")}
        description={
          hidden
            ? t("safety.showProfileDesc")
            : t("safety.hideProfileDesc")
        }
        confirmLabel={hidden ? t("safety.showProfile") : t("safety.hideProfile")}
        onConfirm={toggleHidden}
      />
    </div>
  );
}
