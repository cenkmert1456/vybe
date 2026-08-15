import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { ScreenHeader } from "@/components/mobile/ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Gift, Loader2, Share2 } from "lucide-react";
import { useState } from "react";

type ReferralInfo = {
  code: string | null;
  inviteCount: number;
  rewardedCount: number;
  rewardActive: boolean;
  link: string | null;
  referredBy: string | null;
};

export default function Referral() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const info = useQuery(api.referrals.myReferral) as ReferralInfo | undefined;
  const ensure = useMutation(api.referrals.ensureReferralCode);
  const apply = useMutation(api.referrals.applyReferral);

  const [codeInput, setCodeInput] = useState("");
  const [applying, setApplying] = useState(false);
  const [busy, setBusy] = useState(false);

  const getCode = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await ensure();
      haptic("success");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!info?.code) return;
    try {
      await navigator.clipboard.writeText(info.code);
      toast.success(t("referral.copied"));
    } catch {
      /* clipboard unavailable */
    }
  };

  const share = async () => {
    if (!info?.code) return;
    const text = `Join me on VYBE with my code ${info.code} — let's find our people.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "VYBE", text, url: info.link ?? undefined });
      } else {
        await navigator.clipboard.writeText(info.code);
        toast.success(t("referral.copied"));
      }
    } catch {
      /* user dismissed share sheet */
    }
  };

  const applyCode = async () => {
    if (!codeInput.trim() || applying) return;
    setApplying(true);
    try {
      await apply({ code: codeInput.trim() });
      haptic("success");
      toast.success(t("referral.applied"));
      setCodeInput("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ScreenHeader title={t("referral.title")} onBack={() => navigate(-1)} />
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-4">
        <div className="mt-4 rounded-3xl border border-primary/25 bg-gradient-to-br from-violet-500/10 via-transparent to-pink-500/10 p-5">
          <span className="flex size-12 items-center justify-center rounded-2xl vybe-gradient text-white shadow-glow">
            <Gift className="size-6" />
          </span>
          <h2 className="mt-3 font-display text-lg font-bold">{t("referral.desc")}</h2>

          {!info ? (
            <Loader2 className="mt-4 size-5 animate-spin text-primary" />
          ) : info.code ? (
            <>
              <div className="mt-4 rounded-2xl border border-border/60 bg-card/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t("referral.yourCode")}
                </p>
                <p className="mt-1 font-mono text-xl font-bold tracking-widest text-primary">
                  {info.code}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void copy()}
                    className="h-10 flex-1 rounded-full border-border bg-card text-xs font-semibold"
                  >
                    <Copy className="size-3.5" />
                    {t("referral.share")}
                  </Button>
                  <Button
                    onClick={() => void share()}
                    className="h-10 flex-1 rounded-full vybe-gradient text-xs font-bold text-white shadow-glow"
                  >
                    <Share2 className="size-3.5" />
                    {t("referral.share")}
                  </Button>
                </div>
              </div>

              {info.referredBy && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {t("referral.referredBy", { code: info.referredBy })}
                </p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl border border-border/60 bg-card/60 p-3.5 text-center">
                  <p className="font-display text-2xl font-bold">{info.inviteCount}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground">
                    {t("referral.invites")}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/60 p-3.5 text-center">
                  <p className="font-display text-2xl font-bold">{info.rewardedCount}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground">
                    {t("referral.rewarded")}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                {t("referral.rewardNote")}
              </p>
            </>
          ) : (
            <Button
              onClick={() => void getCode()}
              disabled={busy}
              className="mt-4 h-12 w-full rounded-full vybe-gradient text-sm font-bold text-white shadow-glow"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : t("referral.noCode")}
            </Button>
          )}
        </div>

        {/* Apply a friend's code */}
        <div className="mt-5 rounded-2xl border border-border/70 bg-card/60 p-4">
          <p className="text-sm font-bold">{t("referral.enterCode")}</p>
          <div className="mt-2.5 flex gap-2">
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder={t("referral.enterPlaceholder")}
              className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-card px-3.5 text-sm font-mono outline-none placeholder:font-sans placeholder:text-muted-foreground focus:border-primary"
            />
            <Button
              onClick={() => void applyCode()}
              disabled={!codeInput.trim() || applying}
              className="h-11 shrink-0 rounded-xl vybe-gradient px-5 text-sm font-bold text-white shadow-glow disabled:opacity-50"
            >
              {applying ? <Loader2 className="size-4 animate-spin" /> : t("referral.apply")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
