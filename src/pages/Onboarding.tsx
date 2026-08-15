import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Navigate, useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import {
  GENDERS,
  INTERESTS,
  LANGUAGES,
  CITIES,
  CITIES_BY_COUNTRY,
  COUNTRIES,
  COUNTRIES_BY_CODE,
  flagEmoji,
  MAX_BIO_LENGTH,
} from "@/lib/constants";
import { ageFromDateOfBirth } from "@/lib/format";
import { usePhotoUpload } from "@/components/mobile/PhotoUpload";
import { Chip } from "@/components/mobile/ui";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type GenderValue = "woman" | "man" | "nonbinary" | "other";

type FormState = {
  firstName: string;
  dobMs: number | null;
  gender: GenderValue | null;
  interestedIn: GenderValue[];
  city: string | null;
  countryCode: string | null;
  countryName: string | null;
  lat: number | null;
  lng: number | null;
  photos: string[];
  bio: string;
  interests: string[];
  languages: string[];
};

const STEPS = 10;

function StepShell({
  step,
  children,
  canContinue,
  onContinue,
  onBack,
  submitting,
  error,
}: {
  step: number;
  children: React.ReactNode;
  canContinue: boolean;
  onContinue: () => void;
  onBack?: () => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -32 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-4 pt-2">
            {children}
          </div>
          {error && (
            <p className="px-6 pb-2 text-center text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex items-center gap-3 px-6 pb-safe pb-4 pt-3">
            {onBack && (
              <Button
                type="button"
                variant="ghost"
                onClick={onBack}
                disabled={submitting}
                className="size-12 shrink-0 rounded-full"
                aria-label={t("common.back")}
              >
                <ArrowLeft className="size-5" />
              </Button>
            )}
            <Button
              type="button"
              onClick={onContinue}
              disabled={!canContinue || submitting}
              className="h-13 flex-1 rounded-full vybe-gradient text-base font-bold text-white shadow-glow"
            >
              {submitting ? (
                <Loader2 className="size-5 animate-spin" />
              ) : step === STEPS ? (
                t("onboard.startDiscovering")
              ) : (
                <>
                  {t("common.continue")}
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function StepTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-2xl font-bold leading-tight">{title}</h1>
      {subtitle && (
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function BirthPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (ms: number | null) => void;
}) {
  const now = new Date();
  const day = value ? new Date(value).getDate() : null;
  const month = value ? new Date(value).getMonth() : null;
  const year = value ? new Date(value).getFullYear() : null;
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = now.getFullYear(); y >= 1940; y--) arr.push(y);
    return arr;
  }, [now]);

  const selectCls =
    "h-12 flex-1 rounded-2xl border border-input bg-card px-3 text-sm font-medium text-foreground outline-none focus:border-primary";

  const setDate = (d: number, m: number, y: number) => {
    const dt = new Date(y, m, d);
    if (dt.getMonth() !== m) {
      // e.g. Feb 30 → clamp to last day of month
      dt.setDate(0);
    }
    onChange(dt.getTime());
  };

  return (
    <div className="flex gap-2">
      <select
        aria-label="Day"
        value={day ?? ""}
        onChange={(e) =>
          setDate(Number(e.target.value), month ?? 0, year ?? 2000)
        }
        className={selectCls}
      >
        <option value="" disabled>
          DD
        </option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        aria-label="Month"
        value={month ?? ""}
        onChange={(e) =>
          setDate(day ?? 1, Number(e.target.value), year ?? 2000)
        }
        className={selectCls}
      >
        <option value="" disabled>
          MM
        </option>
        {Array.from({ length: 12 }, (_, i) => i).map((m) => (
          <option key={m} value={m}>
            {new Date(2000, m, 1).toLocaleString("en", { month: "short" })}
          </option>
        ))}
      </select>
      <select
        aria-label="Year"
        value={year ?? ""}
        onChange={(e) => setDate(day ?? 1, month ?? 0, Number(e.target.value))}
        className={selectCls}
      >
        <option value="" disabled>
          YYYY
        </option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

function PhotoGrid({
  photos,
  onAdd,
  onRemove,
  uploading,
}: {
  photos: string[];
  onAdd: () => void;
  onRemove: (url: string) => void;
  uploading: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-3 gap-3">
      {photos.map((p, i) => (
        <motion.div
          key={p}
          layout
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-border/60"
        >
          <img src={p} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
          {i === 0 && (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur">
              MAIN
            </span>
          )}
          <button
            type="button"
            aria-label={t("profile.removePhoto")}
            onClick={() => onRemove(p)}
            className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur active:scale-90"
          >
            <X className="size-3.5" />
          </button>
        </motion.div>
      ))}
      {photos.length < 6 && (
        <button
          type="button"
          onClick={onAdd}
          disabled={uploading}
          className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition-colors active:border-primary"
        >
          {uploading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <Camera className="size-6" />
          )}
          <span className="px-2 text-center text-xs font-medium">
            {uploading ? t("onboard.uploading") : t("profile.addPhoto")}
          </span>
        </button>
      )}
    </div>
  );
}

export default function Onboarding() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const myProfile = useQuery(api.profiles.myProfile);
  const completeOnboarding = useMutation(api.profiles.completeOnboarding);
  const { uploading, uploadAndGetUrl } = usePhotoUpload();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({
    firstName: "",
    dobMs: null,
    gender: null,
    interestedIn: [],
    city: null,
    countryCode: null,
    countryName: null,
    lat: null,
    lng: null,
    photos: [],
    bio: "",
    interests: [],
    languages: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [citySheetOpen, setCitySheetOpen] = useState(false);
  const [countrySheetOpen, setCountrySheetOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const firstName = user?.name ?? "";
  useEffect(() => {
    if (firstName && !form.firstName) {
      setForm((f) => ({ ...f, firstName: firstName.split(" ")[0] ?? "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validateStep = (): string | null => {
    if (step === 1 && !form.firstName.trim()) return t("onboard.nameError");
    if (step === 2) {
      if (!form.dobMs) return t("onboard.birthError");
      if (ageFromDateOfBirth(form.dobMs) < 18) return t("onboard.ageError");
    }
    if (step === 6 && form.photos.length === 0) return t("profile.addPhoto");
    return null;
  };

  const canContinue = (): boolean => {
    if (step === 1) return form.firstName.trim().length > 0;
    if (step === 2) return form.dobMs !== null;
    if (step === 3) return form.gender !== null;
    if (step === 4) return form.interestedIn.length > 0;
    if (step === 6) return form.photos.length > 0;
    return true;
  };

  const handleContinue = () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (step < STEPS) {
      setStep((s) => s + 1);
    } else {
      void handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await completeOnboarding({
        firstName: form.firstName.trim(),
        dateOfBirth: form.dobMs!,
        gender: form.gender!,
        interestedIn: form.interestedIn,
        bio: form.bio.trim(),
        photos: form.photos,
        interests: form.interests,
        languages: form.languages.length ? form.languages : ["English"],
        city: form.city ?? undefined,
        countryCode: form.countryCode ?? undefined,
        countryName: form.countryName ?? undefined,
        approxLat: form.lat ?? undefined,
        approxLng: form.lng ?? undefined,
      });
      navigate("/app/discover", { replace: true });
    } catch (e) {
      console.error("Onboarding error:", e);
      setError(e instanceof Error ? e.message : t("common.error"));
      setSubmitting(false);
    }
  };

  const requestLocation = () => {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError(t("onboard.locationDenied"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set("lat", pos.coords.latitude);
        set("lng", pos.coords.longitude);
        set("city", t("onboard.cityPlaceholder"));
        setError(null);
      },
      () => setError(t("onboard.locationDenied")),
      { timeout: 8000, maximumAge: 60_000 },
    );
  };

  const pickCity = (city: (typeof CITIES)[number]) => {
    set("city", city.name);
    set("lat", city.lat);
    set("lng", city.lng);
    if (!form.countryCode) {
      const country = COUNTRIES_BY_CODE[city.code];
      if (country) {
        set("countryCode", country.code);
        set("countryName", country.name);
      }
    }
  };

  const pickCountry = (code: string) => {
    const c = COUNTRIES_BY_CODE[code];
    set("countryCode", code);
    set("countryName", c?.name ?? null);
    set("city", null);
    set("lat", null);
    set("lng", null);
    setCountryQuery("");
    setCountrySheetOpen(false);
  };

  const addPhoto = async (file: File) => {
    try {
      const url = await uploadAndGetUrl(file);
      set("photos", [...form.photos, url]);
    } catch {
      setError(t("verify.error"));
    }
  };

  const removePhoto = (url: string) => {
    set("photos", form.photos.filter((p) => p !== url));
  };

  if (myProfile?.onboardingCompleted) {
    return <Navigate to="/app/discover" replace />;
  }

  const progress = Math.min(100, Math.round((step / STEPS) * 100));

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Top bar */}
      <header className="px-6 pt-safe pb-3 pt-4">
        <div className="flex items-center justify-between">
          <LogoMark size={30} />
          <span className="text-xs font-semibold text-muted-foreground">
            {t("onboard.step", { current: step, total: STEPS })}
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full vybe-gradient"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <StepShell
          step={step}
          canContinue={canContinue()}
          onContinue={handleContinue}
          onBack={step > 1 ? () => { setError(null); setStep((s) => s - 1); } : undefined}
          submitting={submitting}
          error={error}
        >
          {step === 1 && (
            <>
              <StepTitle title={t("onboard.nameTitle")} subtitle={t("onboard.nameSubtitle")} />
              <Input
                autoFocus
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                placeholder={t("onboard.namePlaceholder")}
                className="h-14 rounded-2xl border-input bg-card px-4 text-lg font-medium"
                maxLength={30}
              />
            </>
          )}

          {step === 2 && (
            <>
              <StepTitle title={t("onboard.birthTitle")} subtitle={t("onboard.birthSubtitle")} />
              <BirthPicker
                value={form.dobMs}
                onChange={(ms) => set("dobMs", ms)}
              />
              {form.dobMs !== null && ageFromDateOfBirth(form.dobMs) >= 18 && (
                <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-emerald-500">
                  <Check className="size-4" />
                  {ageFromDateOfBirth(form.dobMs)} · {t("common.done")}
                </p>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <StepTitle title={t("onboard.genderTitle")} subtitle={t("onboard.genderSubtitle")} />
              <div className="flex flex-col gap-3">
                {GENDERS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => set("gender", g as GenderValue)}
                    className={cn(
                      "flex min-h-14 items-center justify-between rounded-2xl border px-4 text-base font-semibold transition-all active:scale-[0.99]",
                      form.gender === g
                        ? "border-transparent bg-primary text-primary-foreground shadow-glow"
                        : "border-border bg-card text-foreground",
                    )}
                  >
                    {t(`gender.${g}` as any)}
                    {form.gender === g && <Check className="size-5" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <StepTitle title={t("onboard.interestedTitle")} subtitle={t("onboard.interestedSubtitle")} />
              <div className="flex flex-wrap gap-2.5">
                {GENDERS.map((g) => {
                  const selected = form.interestedIn.includes(g as GenderValue);
                  return (
                    <Chip
                      key={g}
                      selected={selected}
                      onClick={() =>
                        set(
                          "interestedIn",
                          selected
                            ? form.interestedIn.filter((x) => x !== g)
                            : [...form.interestedIn, g as GenderValue],
                        )
                      }
                    >
                      {t(`gender.${g}` as any)}
                    </Chip>
                  );
                })}
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <StepTitle title={t("onboard.locationTitle")} subtitle={t("onboard.locationSubtitle")} />
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={requestLocation}
                  className="flex min-h-14 items-center justify-center gap-2 rounded-2xl vybe-gradient px-4 text-base font-bold text-white shadow-glow active:scale-[0.99]"
                >
                  <MapPin className="size-5" />
                  {t("onboard.allowLocation")}
                </button>

                {/* Country (searchable) */}
                <Sheet open={countrySheetOpen} onOpenChange={setCountrySheetOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-13 w-full rounded-2xl border-border bg-card text-base font-semibold"
                    >
                      {form.countryCode ? (
                        <span className="text-lg leading-none">{flagEmoji(form.countryCode)}</span>
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                      <span className="flex-1 truncate text-left">
                        {form.countryName ?? t("onboard.countryPlaceholder")}
                      </span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="rounded-t-3xl">
                    <SheetTitle className="text-center font-display">
                      {t("onboard.countryPlaceholder")}
                    </SheetTitle>
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3">
                      <Search className="size-4 shrink-0 text-muted-foreground" />
                      <input
                        autoFocus
                        value={countryQuery}
                        onChange={(e) => setCountryQuery(e.target.value)}
                        placeholder={t("onboard.searchCountries")}
                        className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="mt-2 max-h-[45dvh] overflow-y-auto pb-safe">
                      {COUNTRIES.filter((c) =>
                        `${c.name} ${c.native}`.toLowerCase().includes(countryQuery.toLowerCase()),
                      ).map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => pickCountry(c.code)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-base font-medium active:bg-muted"
                        >
                          <span className="text-lg leading-none">{flagEmoji(c.code)}</span>
                          <span className="flex-1">{c.name}</span>
                          {form.countryCode === c.code && <Check className="size-4 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </SheetContent>
                </Sheet>

                {/* City (searchable, dependent on country) */}
                <Sheet open={citySheetOpen} onOpenChange={setCitySheetOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={!form.countryCode}
                      className="h-13 w-full rounded-2xl border-border bg-card text-base font-semibold disabled:opacity-40"
                    >
                      <ChevronDown className="size-4" />
                      {form.city ?? t("onboard.cityPlaceholder")}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="rounded-t-3xl">
                    <SheetTitle className="text-center font-display">
                      {t("onboard.cityPlaceholder")}
                    </SheetTitle>
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3">
                      <Search className="size-4 shrink-0 text-muted-foreground" />
                      <input
                        autoFocus
                        value={cityQuery}
                        onChange={(e) => setCityQuery(e.target.value)}
                        placeholder={t("onboard.searchCities")}
                        className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="mt-2 max-h-[45dvh] overflow-y-auto pb-safe">
                      {(form.countryCode
                        ? (CITIES_BY_COUNTRY[form.countryCode] ?? []).filter((c) =>
                            c.name.toLowerCase().includes(cityQuery.toLowerCase()),
                          )
                        : CITIES.filter((c) =>
                            c.name.toLowerCase().includes(cityQuery.toLowerCase()),
                          )
                      ).map((c) => (
                        <button
                          key={`${c.code}-${c.name}`}
                          type="button"
                          onClick={() => {
                            pickCity(c);
                            setCitySheetOpen(false);
                          }}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-3.5 text-left text-base font-medium active:bg-muted"
                        >
                          <span>
                            {c.name}
                            <span className="ml-2 text-xs text-muted-foreground">
                              {COUNTRIES_BY_CODE[c.code]?.name ?? ""}
                            </span>
                          </span>
                          {form.city === c.name && <Check className="size-4 text-primary" />}
                        </button>
                      ))}
                      {(form.countryCode ? CITIES_BY_COUNTRY[form.countryCode] ?? [] : CITIES).length ===
                        0 && (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          {t("onboard.cityPlaceholder")}
                        </p>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
                {form.city && (
                  <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-500">
                    <MapPin className="size-4" />
                    {form.city}
                  </p>
                )}
              </div>
            </>
          )}

          {step === 6 && (
            <>
              <StepTitle title={t("onboard.photosTitle")} subtitle={t("onboard.photosSubtitle")} />
              <PhotoGrid
                photos={form.photos}
                uploading={uploading}
                onAdd={() => fileRef.current?.click()}
                onRemove={removePhoto}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void addPhoto(f);
                  e.target.value = "";
                }}
              />
              <p className="mt-4 text-xs text-muted-foreground">
                {t("onboard.photosHint")}
              </p>
            </>
          )}

          {step === 7 && (
            <>
              <StepTitle title={t("onboard.bioTitle")} subtitle={t("onboard.bioSubtitle")} />
              <Textarea
                value={form.bio}
                onChange={(e) => set("bio", e.target.value.slice(0, MAX_BIO_LENGTH))}
                placeholder={t("onboard.bioPlaceholder")}
                className="min-h-36 rounded-2xl border-input bg-card p-4 text-base leading-relaxed"
                maxLength={MAX_BIO_LENGTH}
              />
              <p className="mt-2 text-right text-xs text-muted-foreground">
                {t("onboard.bioHint", { count: MAX_BIO_LENGTH - form.bio.length })}
              </p>
            </>
          )}

          {step === 8 && (
            <>
              <StepTitle title={t("onboard.interestsTitle")} subtitle={t("onboard.interestsSubtitle")} />
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((interest) => {
                  const selected = form.interests.includes(interest);
                  return (
                    <Chip
                      key={interest}
                      selected={selected}
                      onClick={() =>
                        set(
                          "interests",
                          selected
                            ? form.interests.filter((i) => i !== interest)
                            : form.interests.length < 12
                              ? [...form.interests, interest]
                              : form.interests,
                        )
                      }
                    >
                      {interest}
                    </Chip>
                  );
                })}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                {t("onboard.languagesTitle")}:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {LANGUAGES.slice(0, 10).map((lang) => {
                  const selected = form.languages.includes(lang);
                  return (
                    <Chip
                      key={lang}
                      selected={selected}
                      onClick={() =>
                        set(
                          "languages",
                          selected
                            ? form.languages.filter((l) => l !== lang)
                            : [...form.languages, lang],
                        )
                      }
                    >
                      {lang}
                    </Chip>
                  );
                })}
              </div>
            </>
          )}

          {step === 9 && (
            <>
              <StepTitle title={t("onboard.verifyTitle")} subtitle={t("onboard.verifySubtitle")} />
              <div className="flex flex-col gap-3">
                <div className="flex flex-col items-center rounded-2xl border border-border/70 bg-card/60 px-5 py-6 text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl vybe-gradient shadow-glow">
                    <ShieldCheck className="size-7 text-white" />
                  </div>
                  <p className="mt-3 text-sm font-bold">{t("verify.consent.title")}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {t("verify.consent.desc")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/app/verify")}
                  className="flex min-h-14 items-center justify-center gap-2 rounded-2xl vybe-gradient px-4 text-base font-bold text-white shadow-glow active:scale-[0.99]"
                >
                  <ShieldCheck className="size-5" />
                  {t("verify.consent.start")}
                </button>
                <button
                  type="button"
                  onClick={handleContinue}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card px-4 text-sm font-semibold text-muted-foreground active:scale-[0.99]"
                >
                  {t("common.skip")}
                </button>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("verify.consent.privacy")}
                </p>
              </div>
            </>
          )}

          {step === STEPS && (
            <>
              <StepTitle title={t("onboard.doneTitle")} subtitle={t("onboard.doneSubtitle")} />
              <div className="flex justify-center py-6">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 18 }}
                >
                  <LogoMark size={110} />
                </motion.div>
              </div>
              <div className="rounded-2xl border border-border/80 bg-card/70 p-4 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">
                  {form.firstName}, {form.dobMs ? ageFromDateOfBirth(form.dobMs) : ""} ·
                  {form.city ? ` ${form.city}` : ""}
                </p>
                <p className="mt-1 line-clamp-2">{form.bio || "—"}</p>
              </div>
            </>
          )}
        </StepShell>
      </div>

    </div>
  );
}
