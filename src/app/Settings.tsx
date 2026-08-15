import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { useTheme } from "next-themes";
import { useI18n, LANGUAGE_NAMES, type Lang, type TKey } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { ANYWHERE_KM, GENDERS } from "@/lib/constants";
import { pushEnabled } from "@/lib/mobile";
import { ConfirmDialog } from "@/components/mobile/ConfirmDialog";
import { ScreenHeader, SectionTitle } from "@/components/mobile/ui";
import { ImageWithFallback } from "@/components/mobile/ImageWithFallback";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Accessibility,
  BadgeCheck,
  Ban,
  Bell,
  CalendarDays,
  CalendarHeart,
  Check,
  CheckCheck,
  ChevronRight,
  Crown,
  Download,
  Eye,
  EyeOff,
  Flag,
  Gamepad2,
  Gift,
  Globe,
  HelpCircle,
  Languages,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  MessagesSquare,
  Mic,
  Moon,
  Palette,
  Search,
  ShieldCheck,
  Smile,
  Sparkles,
  Sun,
  Ticket,
  Trash2,
  UserRound,
  Users,
  WalletCards,
  Wand2,
  Wifi,
  Zap,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type View =
  | "root"
  | "discovery"
  | "notifications"
  | "appearance"
  | "accessibility"
  | "account"
  | "password"
  | "privacy"
  | "blocked"
  | "data"
  | "support"
  | "help"
  | "report"
  | "guidelines";

export default function Settings() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("root");

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ScreenHeader
        title={t("settings.title")}
        onBack={() => (view === "root" ? navigate(-1) : setView("root"))}
      />
      {view === "root" && (
        <RootView onOpen={setView} />
      )}
      {view === "discovery" && <DiscoveryView onBack={() => setView("root")} />}
      {view === "notifications" && <NotificationsView />}
      {view === "appearance" && <AppearanceView />}
      {view === "accessibility" && <AccessibilityView />}
      {view === "account" && <AccountView onOpen={setView} />}
      {view === "password" && <PasswordView />}
      {view === "privacy" && <PrivacyView onOpen={setView} />}
      {view === "blocked" && <BlockedView />}
      {view === "data" && <DataView />}
      {view === "support" && <SupportView onOpen={setView} />}
      {view === "help" && <HelpView />}
      {view === "report" && <ReportView />}
      {view === "guidelines" && <GuidelinesView />}
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  onClick,
  destructive,
  right,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  destructive?: boolean;
  right?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left active:bg-muted/60",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          destructive
            ? "bg-destructive/10 text-destructive"
            : "bg-primary/10 text-primary",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[15px] font-medium",
            destructive && "text-destructive",
          )}
        >
          {label}
        </span>
      </span>
      {value && (
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {value}
        </span>
      )}
      {right ?? <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
    </button>
  );
}

function ToggleRow({
  icon,
  label,
  checked,
  onCheckedChange,
}: {
  icon: ReactNode;
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-3.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/* Flags per language — matches the brand reference's language list style. */
const LANG_FLAGS: Record<Lang, string> = {
  en: "🇬🇧",
  tr: "🇹🇷",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
  it: "🇮🇹",
  pt: "🇵🇹",
  ar: "🇸🇦",
  ru: "🇷🇺",
  ja: "🇯🇵",
  ko: "🇰🇷",
  "zh-CN": "🇨🇳",
  "zh-TW": "🇹🇼",
  hi: "🇮🇳",
  id: "🇮🇩",
  nl: "🇳🇱",
  pl: "🇵🇱",
  uk: "🇺🇦",
  sv: "🇸🇪",
  no: "🇳🇴",
  da: "🇩🇰",
  fi: "🇫🇮",
  el: "🇬🇷",
  cs: "🇨🇿",
  ro: "🇷🇴",
  vi: "🇻🇳",
  th: "🇹🇭",
};

function LanguageSheet() {
  const { t, lang, langPref, setLang } = useI18n();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const langs = (Object.keys(LANGUAGE_NAMES) as Lang[]).filter((l) =>
    !q ||
    LANGUAGE_NAMES[l].toLowerCase().includes(q) ||
    l.toLowerCase().includes(q),
  );
  const automaticActive = langPref === "auto";
  return (
    <div className="pb-safe">
      <SheetTitle className="text-center font-display">
        {t("settings.language")}
      </SheetTitle>
      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/40 px-3.5">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("settings.languageSearch")}
          className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
      </div>
      <div className="no-scrollbar mt-3 max-h-[46vh] space-y-1 overflow-y-auto pr-1">
        <button
          type="button"
          onClick={() => setLang("auto")}
          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
            automaticActive ? "bg-primary/10" : "active:bg-muted/70"
          }`}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-primary">
            <Languages className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">
              {t("settings.languageAutomatic")}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t("settings.languageAutomaticDesc")}
            </span>
          </span>
          {automaticActive && <Check className="size-5 shrink-0 text-primary" />}
        </button>
        <div className="mx-3 my-1 h-px bg-border/70" />
        {langs.map((l) => {
          const selected = !automaticActive && lang === l;
          return (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
                selected ? "bg-primary/10" : "active:bg-muted/70"
              }`}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card text-xl leading-none">
                {LANG_FLAGS[l] ?? "🌐"}
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                {LANGUAGE_NAMES[l]}
              </span>
              {selected && <Check className="size-5 shrink-0 text-primary" />}
            </button>
          );
        })}
        {langs.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No languages found
          </p>
        )}
      </div>
    </div>
  );
}

function RootView({ onOpen }: { onOpen: (v: View) => void }) {
  const { t, lang, langPref } = useI18n();
  const navigate = useNavigate();
  const myProfile = useQuery(api.profiles.myProfile);
  const setShowInDiscovery = useMutation(api.profiles.setShowInDiscovery);
  const { user } = useAuth();
  const email = user?.email ?? "";

  const { readReceipts, onlineStatus, locationPrivacy, verificationPrivacy } =
    myProfile?.privacyPrefs ?? {
      readReceipts: true,
      onlineStatus: true,
      locationPrivacy: true,
      verificationPrivacy: true,
    };
  const updatePrivacy = useMutation(api.profiles.updatePrivacyPrefs);
  const togglePrivacy = (patch: Record<string, boolean>) =>
    void updatePrivacy(patch as never);

  const distanceLabel =
    myProfile?.discoveryPrefs.distanceKm === ANYWHERE_KM
      ? t("prefs.anywhere")
      : `${myProfile?.discoveryPrefs.distanceKm ?? 80} km`;
  const locationLabel =
    myProfile?.city || myProfile?.countryName || t("settings.locationPrefs");
  const ageLabel =
    `${myProfile?.discoveryPrefs.ageMin ?? 18}–${myProfile?.discoveryPrefs.ageMax ?? 38}`;

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
      <div className="mt-4 space-y-1.5">
        <SectionTitle className="px-3">{t("settings.sectionProfile")}</SectionTitle>
        <div className="flex flex-col rounded-2xl border border-border/60 bg-card/50">
          <Row
            icon={<UserRound className="size-5" />}
            label={t("settings.editProfile")}
            onClick={() => navigate("/app/edit")}
          />
          <Row
            icon={<BadgeCheck className="size-5" />}
            label={t("settings.profileVerification")}
            value={myProfile?.verified ? t("common.verified") : undefined}
            onClick={() => navigate("/app/verify")}
          />
          <Row
            icon={<Mic className="size-5" />}
            label={t("settings.voiceIntro")}
            onClick={() => navigate("/app/edit")}
          />
        </div>
      </div>

      <div className="mt-5 space-y-1.5">
        <SectionTitle className="px-3">{t("settings.discovery")}</SectionTitle>
        <div className="flex flex-col rounded-2xl border border-border/60 bg-card/50">
          <Row
            icon={<MapPin className="size-5" />}
            label={t("settings.distancePrefs")}
            value={distanceLabel}
            onClick={() => navigate("/app/prefs")}
          />
          <Row
            icon={<Eye className="size-5" />}
            label={t("settings.locationPrefs")}
            value={locationLabel}
            onClick={() => navigate("/app/prefs")}
          />
          <Row
            icon={<Globe className="size-5" />}
            label={t("prefs.country")}
            value={myProfile?.countryName}
            onClick={() => navigate("/app/prefs")}
          />
          <Row
            icon={<MapPin className="size-5" />}
            label={t("prefs.city")}
            value={myProfile?.city}
            onClick={() => navigate("/app/prefs")}
          />
          <Row
            icon={<Users className="size-5" />}
            label={t("settings.agePrefs")}
            value={ageLabel}
            onClick={() => onOpen("discovery")}
          />
          <Row
            icon={<WalletCards className="size-5" />}
            label={t("settings.discoveryPrefs")}
            onClick={() => navigate("/app/prefs")}
          />
          <div className="flex items-center gap-3 px-3 py-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {myProfile?.showInDiscovery ? (
                <Eye className="size-5" />
              ) : (
                <EyeOff className="size-5" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">
                {t("settings.showMe")}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t("settings.showMeDesc")}
              </span>
            </span>
            <Switch
              checked={myProfile?.showInDiscovery ?? true}
              onCheckedChange={(v) => void setShowInDiscovery({ show: v })}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-1.5">
        <SectionTitle className="px-3">{t("settings.sectionPremium")}</SectionTitle>
        <div className="flex flex-col rounded-2xl border border-border/60 bg-card/50">
          <Row
            icon={<Crown className="size-5" />}
            label={t("settings.subscription")}
            onClick={() => navigate("/app/premium")}
          />
          <Row
            icon={<Sparkles className="size-5" />}
            label={t("settings.premiumFeatures")}
            onClick={() => navigate("/app/premium")}
          />
          <Row
            icon={<Zap className="size-5" />}
            label={t("settings.upgrade")}
            onClick={() => navigate("/app/premium")}
          />
        </div>
      </div>

      <div className="mt-5 space-y-1.5">
        <SectionTitle className="px-3">{t("settings.privacy")}</SectionTitle>
        <div className="flex flex-col rounded-2xl border border-border/60 bg-card/50">
          <ToggleRow
            icon={<CheckCheck className="size-5" />}
            label={t("settings.readReceipts")}
            checked={readReceipts}
            onCheckedChange={(v) => togglePrivacy({ readReceipts: v })}
          />
          <ToggleRow
            icon={<Wifi className="size-5" />}
            label={t("settings.onlineStatus")}
            checked={onlineStatus}
            onCheckedChange={(v) => togglePrivacy({ onlineStatus: v })}
          />
          <ToggleRow
            icon={<MapPin className="size-5" />}
            label={t("settings.locationPrivacy")}
            checked={locationPrivacy}
            onCheckedChange={(v) => togglePrivacy({ locationPrivacy: v })}
          />
          <ToggleRow
            icon={<BadgeCheck className="size-5" />}
            label={t("settings.verificationPrivacy")}
            checked={verificationPrivacy}
            onCheckedChange={(v) => togglePrivacy({ verificationPrivacy: v })}
          />
          <Row
            icon={<WalletCards className="size-5" />}
            label={t("settings.dataControls")}
            onClick={() => onOpen("data")}
          />
        </div>
      </div>

      <div className="mt-5 space-y-1.5">
        <SectionTitle className="px-3">{t("settings.sectionAccount")}</SectionTitle>
        <div className="flex flex-col rounded-2xl border border-border/60 bg-card/50">
          <Row
            icon={<Mail className="size-5" />}
            label={t("settings.email")}
            value={email || "—"}
            onClick={() => onOpen("account")}
          />
          <Row
            icon={<Lock className="size-5" />}
            label={t("settings.passwordAndSecurity")}
            onClick={() => onOpen("password")}
          />
          <Row
            icon={<Bell className="size-5" />}
            label={t("settings.notifications")}
            onClick={() => onOpen("notifications")}
          />
          <Row
            icon={<Ban className="size-5" />}
            label={t("settings.blockedUsers")}
            onClick={() => onOpen("blocked")}
          />
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left active:bg-muted/60"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Languages className="size-5" />
                </span>
                <span className="min-w-0 flex-1 text-[15px] font-medium">
                  {t("settings.language")}
                </span>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {langPref === "auto"
                    ? t("settings.languageAutomatic")
                    : LANGUAGE_NAMES[lang]}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl">
              <LanguageSheet />
            </SheetContent>
          </Sheet>
          <Row
            icon={<Palette className="size-5" />}
            label={t("settings.appearance")}
            value={ThemeLabel()}
            onClick={() => onOpen("appearance")}
          />
          <Row
            icon={<Accessibility className="size-5" />}
            label={t("settings.accessibility")}
            onClick={() => onOpen("accessibility")}
          />
        </div>
      </div>

      <div className="mt-5 space-y-1.5">
        <SectionTitle className="px-3">{t("settings.sectionHub")}</SectionTitle>
        <div className="flex flex-col rounded-2xl border border-border/60 bg-card/50">
          <Row
            icon={<Smile className="size-5" />}
            label={t("mood.title")}
            onClick={() => navigate("/app/mood")}
          />
          <Row
            icon={<Wand2 className="size-5" />}
            label={t("coach.title")}
            onClick={() => navigate("/app/coach")}
          />
          <Row
            icon={<EyeOff className="size-5" />}
            label={t("blind.title")}
            onClick={() => navigate("/app/blind")}
          />
          <Row
            icon={<Gamepad2 className="size-5" />}
            label={t("games.title")}
            onClick={() => navigate("/app/games")}
          />
          <Row
            icon={<CalendarDays className="size-5" />}
            label={t("daily.title")}
            onClick={() => navigate("/app/daily")}
          />
          <Row
            icon={<CalendarHeart className="size-5" />}
            label={t("dateplans.title")}
            onClick={() => navigate("/app/dateplans")}
          />
          <Row
            icon={<Ticket className="size-5" />}
            label={t("events.title")}
            onClick={() => navigate("/app/events")}
          />
          <Row
            icon={<MessagesSquare className="size-5" />}
            label={t("rooms.title")}
            onClick={() => navigate("/app/rooms")}
          />
          <Row
            icon={<Gift className="size-5" />}
            label={t("referral.title")}
            onClick={() => navigate("/app/referral")}
          />
        </div>
      </div>

      <div className="mt-5 space-y-1.5">
        <SectionTitle className="px-3">{t("settings.sectionSafety")}</SectionTitle>
        <div className="flex flex-col rounded-2xl border border-border/60 bg-card/50">
          <Row
            icon={<ShieldCheck className="size-5" />}
            label={t("settings.safetyCenter")}
            onClick={() => navigate("/app/safety")}
          />
          <Row
            icon={<Flag className="size-5" />}
            label={t("settings.reports")}
            onClick={() => navigate("/app/safety")}
          />
          <Row
            icon={<BadgeCheck className="size-5" />}
            label={t("settings.profileVerification")}
            onClick={() => navigate("/app/verify")}
          />
        </div>
      </div>

      <div className="mt-5 space-y-1.5">
        <SectionTitle className="px-3">{t("settings.sectionSupport")}</SectionTitle>
        <div className="flex flex-col rounded-2xl border border-border/60 bg-card/50">
          <Row
            icon={<HelpCircle className="size-5" />}
            label={t("settings.helpCenter")}
            onClick={() => onOpen("help")}
          />
          <Row
            icon={<MessageSquare className="size-5" />}
            label={t("settings.feedback")}
            onClick={() => onOpen("report")}
          />
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <SectionTitle className="px-3 text-destructive">
          {t("settings.sectionDangerous")}
        </SectionTitle>
        <div className="flex flex-col gap-2.5 rounded-2xl border border-destructive/25 bg-destructive/5 p-3">
          <LogoutButton />
          <DeleteButton />
        </div>
      </div>
    </div>
  );

  function ThemeLabel() {
    const pref =
      typeof window !== "undefined"
        ? (localStorage.getItem("vybe-theme-pref") ?? "system")
        : "system";
    const key = `settings.theme${pref.charAt(0).toUpperCase() + pref.slice(1)}` as TKey;
    return t(key);
  }
}

function LogoutButton() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [, setPending] = useState(false);

  const handle = async () => {
    setPending(true);
    try {
      await signOut();
      navigate("/", { replace: true });
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-12 w-full rounded-full border-border bg-card font-semibold"
      >
        <LogOut className="size-4" />
        {t("settings.logOut")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("settings.logOutTitle")}
        description={t("settings.logOutDesc")}
        confirmLabel={t("settings.logOut")}
        destructive={false}
        onConfirm={handle}
      />
    </>
  );
}

function DeleteButton() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const deleteAccount = useMutation(api.profiles.deleteAccount);
  const [open, setOpen] = useState(false);
  const [, setPending] = useState(false);

  const handle = async () => {
    setPending(true);
    try {
      await deleteAccount();
      await signOut();
      toast(t("settings.deletedToast"));
      navigate("/", { replace: true });
    } catch {
      toast.error(t("common.error"));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="h-12 w-full rounded-full text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="size-4" />
        {t("settings.deleteAccount")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("settings.deleteTitle")}
        description={t("settings.deleteDesc")}
        confirmLabel={t("settings.deleteConfirm")}
        onConfirm={handle}
      />
    </>
  );
}

function DiscoveryView({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const myProfile = useQuery(api.profiles.myProfile);
  const update = useMutation(api.profiles.updateDiscoveryPrefs);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState(() => ({
    ageMin: 18,
    ageMax: 35,
    distanceKm: 80,
    genders: ["woman", "man", "nonbinary"] as string[],
  }));

  // sync once profile loads
  if (myProfile && values.ageMin === 18 && myProfile.discoveryPrefs.ageMin !== 18) {
    setValues({
      ageMin: myProfile.discoveryPrefs.ageMin,
      ageMax: myProfile.discoveryPrefs.ageMax,
      distanceKm: myProfile.discoveryPrefs.distanceKm,
      genders: [...myProfile.discoveryPrefs.genders],
    });
  }

  const save = async () => {
    setSaving(true);
    try {
      await update({
        ageMin: values.ageMin,
        ageMax: values.ageMax,
        distanceKm: values.distanceKm,
        genders: values.genders as any,
      });
      toast(t("settings.preferencesSaved"));
      onBack();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const toggleGender = (g: string) => {
    setValues((v) => ({
      ...v,
      genders: v.genders.includes(g)
        ? v.genders.filter((x) => x !== g)
        : [...v.genders, g],
    }));
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-4">
        <div className="mt-4 rounded-2xl border border-border/70 bg-card/60 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">{t("settings.ageRange")}</p>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {values.ageMin} – {values.ageMax}
            </span>
          </div>
          <Slider
            className="mt-5"
            min={18}
            max={70}
            step={1}
            value={[values.ageMin, values.ageMax]}
            onValueChange={([a, b]) =>
              setValues((v) => ({ ...v, ageMin: a, ageMax: b }))
            }
          />
        </div>

        <div className="mt-4 rounded-2xl border border-border/70 bg-card/60 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">{t("settings.distance")}</p>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {values.distanceKm} km
            </span>
          </div>
          <Slider
            className="mt-5"
            min={10}
            max={4000}
            step={50}
            value={[values.distanceKm]}
            onValueChange={([d]) =>
              setValues((v) => ({ ...v, distanceKm: d }))
            }
          />
        </div>

        <div className="mt-4 rounded-2xl border border-border/70 bg-card/60 p-5">
          <p className="text-sm font-bold">{t("settings.showMe")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {GENDERS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => toggleGender(g)}
                className={cn(
                  "min-h-10 rounded-full border px-4 py-2 text-sm font-medium transition-all active:scale-95",
                  values.genders.includes(g)
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground",
                )}
              >
                {t(`gender.${g}` as any)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-border/60 bg-background/90 px-5 pb-safe pt-3 backdrop-blur">
        <Button
          onClick={() => void save()}
          disabled={saving || values.genders.length === 0}
          className="h-13 w-full rounded-full vybe-gradient text-base font-bold text-white shadow-glow"
        >
          {saving ? <Loader2 className="size-5 animate-spin" /> : t("common.save")}
        </Button>
      </div>
    </div>
  );
}

function NotificationsView() {
  const { t } = useI18n();
  const myProfile = useQuery(api.profiles.myProfile);
  const update = useMutation(api.profiles.updateNotificationPrefs);
  const prefs = myProfile?.notificationPrefs;

  const toggle = async (
    key: "matches" | "messages" | "likes" | "activity" | "events" | "promotions",
    v: boolean,
  ) => {
    try {
      await update({ [key]: v } as never);
      toast(t("settings.savedToast"));
    } catch {
      toast.error(t("common.error"));
    }
  };

  const rows = [
    { key: "matches" as const, label: t("settings.notifMatches") },
    { key: "messages" as const, label: t("settings.notifMessages") },
    { key: "likes" as const, label: t("settings.notifLikes") },
    { key: "events" as const, label: t("settings.notifEvents") },
    { key: "promotions" as const, label: t("settings.notifPromotions") },
    { key: "activity" as const, label: t("settings.notifActivity") },
  ];

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border/60 bg-card/50 px-4 py-3.5">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            pushEnabled
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-muted text-muted-foreground",
          )}
        >
          <Bell className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium">
            {pushEnabled ? t("push.configured") : t("push.notConfigured")}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {pushEnabled ? t("settings.pushDesc") : t("push.notConfiguredDesc")}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-col rounded-2xl border border-border/60 bg-card/50">
        {rows.map((r, i) => (
          <div
            key={r.key}
            className={cn(
              "flex items-center justify-between px-4 py-4",
              i < rows.length - 1 && "border-b border-border/50",
            )}
          >
            <span className="text-[15px] font-medium">{r.label}</span>
            <Switch
              checked={prefs?.[r.key] ?? true}
              onCheckedChange={(v) => void toggle(r.key, v)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function AppearanceView() {
  const { t } = useI18n();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const options = [
    { key: "system", label: t("settings.themeSystem"), icon: <MonitorIcon /> },
    { key: "light", label: t("settings.themeLight"), icon: <Sun className="size-5" /> },
    { key: "dark", label: t("settings.themeDark"), icon: <Moon className="size-5" /> },
  ] as const;

  const pick = (key: string) => {
    setTheme(key);
    try {
      localStorage.setItem("vybe-theme-pref", key);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
      <div className="mt-4 flex flex-col gap-3">
        {options.map((o) => {
          const active = theme === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => pick(o.key)}
              className={cn(
                "flex min-h-14 items-center gap-3 rounded-2xl border px-4 text-base font-semibold transition-all active:scale-[0.99]",
                active
                  ? "border-transparent bg-primary text-primary-foreground shadow-glow"
                  : "border-border bg-card text-foreground",
              )}
            >
              {o.icon}
              {o.label}
              {active && <Check className="ml-auto size-5" />}
            </button>
          );
        })}
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {resolvedTheme === "dark" ? "🌙" : "☀️"}
        </p>
      </div>
    </div>
  );
}

function MonitorIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

const A11Y_KEYS = {
  reduceMotion: "vybe-a11y-reduce-motion",
  largeText: "vybe-a11y-large-text",
} as const;

function AccessibilityView() {
  const { t } = useI18n();
  const [reduceMotion, setReduceMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      (localStorage.getItem(A11Y_KEYS.reduceMotion) === "1" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches),
  );
  const [largeText, setLargeText] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem(A11Y_KEYS.largeText) === "1",
  );

  useEffect(() => {
    try {
      localStorage.setItem(A11Y_KEYS.reduceMotion, reduceMotion ? "1" : "0");
    } catch {
      /* ignore */
    }
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  useEffect(() => {
    try {
      localStorage.setItem(A11Y_KEYS.largeText, largeText ? "1" : "0");
    } catch {
      /* ignore */
    }
    document.documentElement.style.fontSize = largeText ? "17px" : "";
  }, [largeText]);

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
      <div className="mt-4 flex flex-col rounded-2xl border border-border/60 bg-card/50">
        <ToggleRow
          icon={<Accessibility className="size-5" />}
          label={t("settings.a11yReduceMotion")}
          checked={reduceMotion}
          onCheckedChange={setReduceMotion}
        />
        <div className="border-t border-border/50 px-3 py-3">
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            {t("settings.a11yReduceMotionDesc")}
          </p>
        </div>
        <ToggleRow
          icon={<TypeIcon />}
          label={t("settings.a11yLargeText")}
          checked={largeText}
          onCheckedChange={setLargeText}
        />
        <div className="border-t border-border/50 px-3 py-3">
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            {t("settings.a11yLargeTextDesc")}
          </p>
        </div>
      </div>
    </div>
  );
}

function TypeIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 7V4h16v3M9 20h6M12 4v16" />
    </svg>
  );
}

function AccountView({ onOpen }: { onOpen: (v: View) => void }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const email = user?.email ?? "—";
  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
      <div className="mt-4 rounded-2xl border border-border/60 bg-card/50 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {t("settings.email")}
        </p>
        <p className="mt-1 text-base font-semibold">{email}</p>
      </div>
      <div className="mt-4">
        <Row
          icon={<Lock className="size-5" />}
          label={t("settings.changePassword")}
          onClick={() => onOpen("password")}
        />
      </div>
    </div>
  );
}

function PasswordView() {
  const { t } = useI18n();
  const { user } = useAuth();
  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-8">
      <div className="mt-6 rounded-2xl border border-primary/25 bg-primary/5 p-5 text-center">
        <ShieldCheck className="mx-auto size-10 text-primary" />
        <p className="mt-3 text-sm leading-relaxed text-foreground">
          {t("settings.passwordNote")}
        </p>
        {user?.email && (
          <p className="mt-2 text-xs text-muted-foreground">{user.email}</p>
        )}
      </div>
    </div>
  );
}

function PrivacyView({ onOpen }: { onOpen: (v: View) => void }) {
  const { t } = useI18n();
  const myProfile = useQuery(api.profiles.myProfile);
  const setShowInDiscovery = useMutation(api.profiles.setShowInDiscovery);
  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
      <div className="mt-4 flex flex-col rounded-2xl border border-border/60 bg-card/50">
        <Row
          icon={<Ban className="size-5" />}
          label={t("settings.blockedUsers")}
          onClick={() => onOpen("blocked")}
        />
        <Row
          icon={<MapPin className="size-5" />}
          label={t("settings.locationSettings")}
          onClick={() => onOpen("data")}
        />
        <div className="flex items-center gap-3 px-3 py-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {myProfile?.showInDiscovery ? (
              <Eye className="size-5" />
            ) : (
              <EyeOff className="size-5" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">
              {t("settings.visibility")}
            </span>
          </span>
          <Switch
            checked={myProfile?.showInDiscovery ?? true}
            onCheckedChange={(v) => void setShowInDiscovery({ show: v })}
          />
        </div>
      </div>
    </div>
  );
}

function BlockedView() {
  const { t, formatRelativeTime } = useI18n();
  const blocked = useQuery(api.reports.blockedUsers);
  const unblock = useMutation(api.reports.unblockUser);
  const [pending, setPending] = useState<string | null>(null);

  const handle = async (id: string) => {
    setPending(id);
    try {
      await unblock({ blockedProfileId: id as any });
      toast(t("settings.unblockedToast"));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
      <p className="mt-3 px-2 text-xs text-muted-foreground">{t("blocked.hint")}</p>
      {blocked === undefined ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : blocked.length === 0 ? (
        <div className="mt-10 text-center text-sm text-muted-foreground">
          {t("settings.blockedEmpty")}
        </div>
      ) : (
        <div className="mt-4 flex flex-col rounded-2xl border border-border/60 bg-card/50">
          {blocked.map((b) => (
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
                disabled={pending === b._id}
                onClick={() => void handle(b._id)}
                className="h-9 rounded-full text-xs font-semibold"
              >
                {pending === b._id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  t("settings.unblock")
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DataView() {
  const { t } = useI18n();
  const myProfile = useQuery(api.profiles.myProfile);
  const { user } = useAuth();

  const exportData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      account: { email: user?.email ?? null },
      profile: myProfile
        ? {
            firstName: myProfile.firstName,
            dateOfBirth: new Date(myProfile.dateOfBirth).toISOString(),
            gender: myProfile.gender,
            bio: myProfile.bio,
            interests: myProfile.interests,
            languages: myProfile.languages,
            city: myProfile.city ?? null,
            photos: myProfile.photos.length,
            verified: myProfile.verified,
            showInDiscovery: myProfile.showInDiscovery,
          }
        : null,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vybe-data.json";
    a.click();
    URL.revokeObjectURL(url);
    toast(t("settings.savedToast"));
  };

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-8">
      <div className="mt-4 rounded-2xl border border-border/70 bg-card/60 p-4">
        <div className="flex items-center gap-3">
          <MapPin className="size-5 text-primary" />
          <div>
            <p className="text-sm font-bold">{t("settings.locationSettings")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {t("settings.locationDesc")}
            </p>
          </div>
        </div>
        {myProfile?.city && (
          <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-xs font-medium">
            {myProfile.city}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-border/70 bg-card/60 p-4">
        <p className="text-sm font-bold">{t("settings.dataPrivacy")}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {t("settings.dataNote")}
        </p>
        <Button
          variant="outline"
          onClick={exportData}
          className="mt-4 h-11 w-full rounded-full text-sm font-semibold"
        >
          <Download className="size-4" />
          {t("settings.exportData")}
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {t("settings.exportHint")}
        </p>
      </div>
    </div>
  );
}

function SupportView({ onOpen }: { onOpen: (v: View) => void }) {
  const { t } = useI18n();
  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
      <div className="mt-4 flex flex-col rounded-2xl border border-border/60 bg-card/50">
        <Row
          icon={<HelpCircle className="size-5" />}
          label={t("settings.helpCenter")}
          onClick={() => onOpen("help")}
        />
        <Row
          icon={<Flag className="size-5" />}
          label={t("settings.reportProblem")}
          onClick={() => onOpen("report")}
        />
      </div>
    </div>
  );
}

function HelpView() {
  const faqs = [
    { q: "How does matching work?", a: "When you like someone and they like you back, it's a match. You'll see their conversation appear in Messages." },
    { q: "Is my location shared?", a: "Never exactly. Other people only see an approximate distance in km." },
    { q: "What does the verified badge mean?", a: "Verified profiles have confirmed their identity with a photo. It means they're more likely to be who they say they are." },
    { q: "How do I block or report someone?", a: "Open their profile or chat, tap the ⋯ menu and choose Block or Report. We review reports 24/7." },
    { q: "Can I undo a swipe?", a: "Not yet — but passes and likes stay private until it's a match." },
  ];
  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
      <Accordion type="single" collapsible className="mt-4">
        {faqs.map((f, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border-b border-border/60">
            <AccordionTrigger className="text-left text-[15px] font-semibold">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              {f.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function ReportView() {
  const { t } = useI18n();
  const submit = useMutation(api.feedback.submitFeedback);
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const send = async () => {
    if (!message.trim() || pending) return;
    setPending(true);
    try {
      await submit({ type: "problem", category: category || undefined, message });
      setMessage("");
      setCategory("");
      toast(t("settings.problemDone"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setPending(false);
    }
  };

  const cats = ["Bug", "Billing", "Account issue", "Safety concern", "Other"];

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-8">
      <div className="mt-4 flex flex-col gap-1.5">
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              "flex min-h-11 items-center rounded-xl border px-3.5 text-left text-sm font-medium",
              category === c
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {c}
          </button>
        ))}
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("settings.problemDesc")}
          className="mt-2 min-h-24 rounded-xl border-input bg-card px-4 py-3 text-sm"
          maxLength={3000}
        />
      </div>
      <Button
        onClick={() => void send()}
        disabled={!message.trim() || pending}
        className="mt-4 h-12 w-full rounded-full vybe-gradient font-bold text-white shadow-glow"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : t("settings.problemSubmit")}
      </Button>
    </div>
  );
}

function GuidelinesView() {
  const { t } = useI18n();
  const rules = [
    "Be kind. Respect everyone's boundaries.",
    "No nudity, sexual content, or explicit language in profiles.",
    "No harassment, hate speech, or discrimination of any kind.",
    "Be honest. No fake profiles or impersonation.",
    "Don't share contact info you're not comfortable sharing.",
    "Report anything that feels off — we're here for you 24/7.",
  ];
  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-8">
      <div className="mt-4 rounded-2xl border border-border/70 bg-card/60 p-5">
        <ShieldCheck className="size-8 text-primary" />
        <h2 className="mt-3 font-display text-lg font-bold">
          {t("settings.guidelines")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("safety.sosHint")}
        </p>
        <ul className="mt-4 space-y-2.5">
          {rules.map((r, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              {r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
