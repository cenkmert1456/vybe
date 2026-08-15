import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { useI18n, type Lang } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { UpgradeSheet, type GateFeature } from "@/components/mobile/UpgradeSheet";
import {
  ANYWHERE_KM,
  DISTANCE_PRESETS,
  GENDERS,
  LOOKING_FOR,
} from "@/lib/constants";
import {
  COUNTRIES,
  CITIES_BY_COUNTRY,
  COUNTRIES_BY_CODE,
  flagEmoji,
  nearestCity,
  type Country,
  type GeoCity,
} from "@/data/geo";
import { ScreenHeader } from "@/components/mobile/ui";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  Loader2,
  LocateFixed,
  Lock,
  MapPin,
  Search,
  Globe,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const DISPLAY_NAMES_CACHE = new Map<string, Intl.DisplayNames | null>();

/** Localized country name via the browser Intl API (fallback: English name). */
function localizedCountryName(code: string, name: string, lang: Lang): string {
  try {
    const key = `${lang}:${code}`;
    if (!DISPLAY_NAMES_CACHE.has(key)) {
      DISPLAY_NAMES_CACHE.set(
        key,
        new Intl.DisplayNames([lang === "zh-CN" ? "zh-CN" : lang], {
          type: "region",
          fallback: "none",
        }),
      );
    }
    const display = DISPLAY_NAMES_CACHE.get(key)?.of(code);
    if (display && display !== code) return display;
  } catch {
    /* fall through to English name */
  }
  return name;
}

function countryLabel(c: Country, lang: Lang): string {
  return localizedCountryName(c.code, c.name, lang);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export default function DiscoveryPrefs() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const myProfile = useQuery(api.profiles.myProfile);
  const entitlements = useQuery(api.plans.myEntitlements);
  const update = useMutation(api.profiles.updateDiscoveryPrefs);

  const [upgradeFeature, setUpgradeFeature] = useState<GateFeature | null>(null);
  const isPremium = entitlements?.entitlements?.locationControls ?? false;

  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [values, setValues] = useState({
    ageMin: 18,
    ageMax: 35,
    distanceKm: 50,
    genders: ["woman", "man", "nonbinary"] as string[],
    lookingFor: [] as string[],
    countryCode: "",
    countryName: "",
    city: "",
    cityId: "",
    approxLat: undefined as number | undefined,
    approxLng: undefined as number | undefined,
  });

  // Hydrate from the backend once (never overwrite while editing).
  useEffect(() => {
    if (!myProfile || loaded) return;
    setLoaded(true);
    setValues((v) => ({
      ...v,
      ageMin: myProfile.discoveryPrefs.ageMin,
      ageMax: myProfile.discoveryPrefs.ageMax,
      distanceKm: myProfile.discoveryPrefs.distanceKm,
      genders: [...myProfile.discoveryPrefs.genders],
      lookingFor: [...(myProfile.relationshipIntentions ?? [])],
      countryCode: myProfile.countryCode ?? "",
      countryName: myProfile.countryName ?? "",
      city: myProfile.city ?? "",
      cityId: myProfile.cityId ?? "",
      approxLat: myProfile.approxLat,
      approxLng: myProfile.approxLng,
    }));
  }, [myProfile, loaded]);

  const cities = useMemo(
    () => CITIES_BY_COUNTRY[values.countryCode] ?? [],
    [values.countryCode],
  );

  const filteredCountries = useMemo(() => {
    const q = normalize(countryQuery);
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => {
      const local = normalize(countryLabel(c, lang));
      return (
        local.includes(q) ||
        normalize(c.name).includes(q) ||
        normalize(c.native).includes(q) ||
        c.code.toLowerCase().includes(q)
      );
    });
  }, [countryQuery, lang]);

  const filteredCities = useMemo(() => {
    const q = normalize(cityQuery);
    if (!q) return cities;
    return cities.filter((c) => normalize(c.name).includes(q));
  }, [cityQuery, cities]);

  const isAnywhere = values.distanceKm >= ANYWHERE_KM;

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error(t("prefs.locationFailed"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const city = nearestCity(latitude, longitude);
        const country = city ? COUNTRIES_BY_CODE[city.code] : undefined;
        setValues((v) => ({
          ...v,
          approxLat: latitude,
          approxLng: longitude,
          countryCode: city?.code ?? v.countryCode,
          countryName: country?.name ?? v.countryName,
          city: city?.name ?? v.city,
          cityId: city?.code ?? v.cityId,
        }));
        setLocating(false);
        haptic("success");
        toast(t("prefs.locationAutofilled"));
      },
      () => {
        setLocating(false);
        toast.error(t("prefs.geoDenied"));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      await update({
        ageMin: values.ageMin,
        ageMax: values.ageMax,
        distanceKm: values.distanceKm,
        genders: values.genders as any,
        ...(values.countryCode
          ? {
              countryCode: values.countryCode,
              countryName: values.countryName,
              city: values.city,
              cityId: values.cityId,
              approxLat: values.approxLat,
              approxLng: values.approxLng,
            }
          : {}),
        ...(values.lookingFor.length > 0
          ? { lookingFor: values.lookingFor }
          : {}),
      });
      haptic("success");
      toast(t("prefs.saved"));
      navigate(-1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: "genders" | "lookingFor", value: string) => {
    setValues((v) => ({
      ...v,
      [key]: v[key].includes(value)
        ? v[key].filter((x) => x !== value)
        : [...v[key], value],
    }));
  };

  const pickCountry = (code: string) => {
    const c = COUNTRIES_BY_CODE[code];
    setValues((v) => ({
      ...v,
      countryCode: code,
      countryName: c?.name ?? "",
      city: "",
      cityId: "",
      approxLat: undefined,
      approxLng: undefined,
    }));
    setCountryOpen(false);
    setCountryQuery("");
  };

  const pickCity = (city: GeoCity) => {
    setValues((v) => ({
      ...v,
      city: city.name,
      cityId: city.code,
      approxLat: city.lat,
      approxLng: city.lng,
    }));
    setCityOpen(false);
    setCityQuery("");
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ScreenHeader
        title={t("prefs.title")}
        onBack={() => navigate(-1)}
      />
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-4">
        {/* Looking for */}
        <div className="mt-4 rounded-2xl border border-border/70 bg-card/60 p-5">
          <p className="text-sm font-bold">{t("prefs.lookingFor")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("prefs.lookingForDesc")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {LOOKING_FOR.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => toggle("lookingFor", l)}
                className={cn(
                  "min-h-10 rounded-full border px-4 py-2 text-sm font-medium transition-all active:scale-95",
                  values.lookingFor.includes(l)
                    ? "border-transparent vybe-gradient text-white shadow-glow"
                    : "border-border bg-card text-foreground",
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Who you want to see */}
        <div className="mt-4 rounded-2xl border border-border/70 bg-card/60 p-5">
          <p className="text-sm font-bold">{t("prefs.whoToSee")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {GENDERS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => toggle("genders", g)}
                className={cn(
                  "min-h-10 rounded-full border px-4 py-2 text-sm font-medium transition-all active:scale-95",
                  values.genders.includes(g)
                    ? "border-transparent vybe-gradient text-white shadow-glow"
                    : "border-border bg-card text-foreground",
                )}
              >
                {t(`gender.${g}` as any)}
              </button>
            ))}
          </div>
        </div>

        {/* Age range */}
        <div className="mt-4 rounded-2xl border border-border/70 bg-card/60 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">{t("prefs.age")}</p>
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

        {/* Distance — premium-gated */}
        <div className="mt-4 rounded-2xl border border-border/70 bg-card/60 p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              {t("prefs.distance")}
              {!isPremium && (
                <Lock className="size-3.5 text-amber-400" aria-label={t("prefs.plusRequired")} />
              )}
            </p>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {isAnywhere ? t("prefs.anywhere") : `${values.distanceKm} km`}
            </span>
          </div>
          <button
            type="button"
            className="mt-4 w-full cursor-pointer"
            onClick={() =>
              isPremium ? undefined : setUpgradeFeature("locationControls")
            }
          >
            <Slider
              className="pointer-events-none w-full"
              disabled={!isPremium}
              min={1}
              max={100}
              step={1}
              value={[isAnywhere ? 100 : values.distanceKm]}
              onValueChange={([d]) =>
                setValues((v) => ({ ...v, distanceKm: d }))
              }
            />
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            {isAnywhere
              ? t("prefs.anywhereDesc")
              : t("prefs.distanceDesc", { km: values.distanceKm })}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {DISTANCE_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() =>
                  isPremium
                    ? setValues((v) => ({ ...v, distanceKm: d }))
                    : setUpgradeFeature("locationControls")
                }
                className={cn(
                  "min-h-9 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
                  !isAnywhere && values.distanceKm === d
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {d} km
              </button>
            ))}
            <button
              type="button"
              onClick={() =>
                isPremium
                  ? setValues((v) => ({ ...v, distanceKm: ANYWHERE_KM }))
                  : setUpgradeFeature("locationControls")
              }
              className={cn(
                "min-h-9 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
                isAnywhere
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              <Globe className="mr-1 inline size-3.5" />
              {t("prefs.anywhere")}
            </button>
          </div>
          {!isPremium && (
            <button
              type="button"
              onClick={() => setUpgradeFeature("locationControls")}
              className="mt-3 flex w-full items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-left"
            >
              <Lock className="size-3.5 shrink-0 text-amber-400" />
              <span className="text-[11px] font-semibold text-amber-300">
                {t("prefs.premiumDistance")} — {t("prefs.plusRequired")}
              </span>
            </button>
          )}
        </div>

        {/* Location — country/city changes are premium-gated */}
        <div className="mt-4 rounded-2xl border border-border/70 bg-card/60 p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              {t("prefs.location")}
              {!isPremium && (
                <Lock className="size-3.5 text-amber-400" aria-label={t("prefs.plusRequired")} />
              )}
            </p>
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary active:scale-95 disabled:opacity-50"
            >
              {locating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <LocateFixed className="size-3.5" />
              )}
              {t("prefs.useCurrentLocation")}
            </button>
          </div>
          {!isPremium && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="size-3 shrink-0 text-amber-400" />
              {t("prefs.locationLocked")}
            </p>
          )}

          {/* Country (searchable) */}
          <div className="relative mt-3">
            <button
              type="button"
              disabled={!isPremium}
              onClick={() => {
                if (!isPremium) {
                  setUpgradeFeature("locationControls");
                  return;
                }
                setCountryOpen((o) => !o);
                setCityOpen(false);
              }}
              className={cn(
                "flex w-full min-h-12 items-center gap-2.5 rounded-xl border border-input bg-card px-3.5 text-left text-sm",
                !isPremium && "opacity-60",
              )}
            >
              {values.countryCode ? (
                <span className="text-base leading-none">
                  {flagEmoji(values.countryCode)}
                </span>
              ) : (
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className={cn("flex-1", !values.countryName && "text-muted-foreground")}>
                {values.countryName
                  ? countryLabel(COUNTRIES_BY_CODE[values.countryCode] ?? ({} as Country), lang) || values.countryName
                  : t("prefs.countryPlaceholder")}
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  countryOpen && "rotate-180",
                )}
              />
            </button>
            {countryOpen && (
              <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
                <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
                  <Search className="size-4 shrink-0 text-muted-foreground" />
                  <input
                    autoFocus
                    value={countryQuery}
                    onChange={(e) => setCountryQuery(e.target.value)}
                    placeholder={t("prefs.searchCountries")}
                    className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <div className="no-scrollbar max-h-60 overflow-y-auto p-1.5">
                  {filteredCountries.length === 0 && (
                    <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                      {t("prefs.noResults")}
                    </p>
                  )}
                  {filteredCountries.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => pickCountry(c.code)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm active:bg-muted"
                    >
                      <span className="text-base leading-none">{flagEmoji(c.code)}</span>
                      <span className="flex-1 truncate">
                        {countryLabel(c, lang)}
                      </span>
                      {values.countryCode === c.code && (
                        <Check className="size-4 shrink-0 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* City (searchable, dependent on country) */}
          <div className="relative mt-2">
            <button
              type="button"
              disabled={!values.countryCode || !isPremium}
              onClick={() => {
                if (!isPremium) {
                  setUpgradeFeature("locationControls");
                  return;
                }
                setCityOpen((o) => !o);
                setCountryOpen(false);
              }}
              className={cn(
                "flex w-full min-h-12 items-center gap-2.5 rounded-xl border border-input bg-card px-3.5 text-left text-sm",
                (!values.countryCode || !isPremium) && "opacity-40",
              )}
            >
              <MapPin className="size-4 shrink-0 text-muted-foreground" />
              <span className={cn("flex-1", !values.city && "text-muted-foreground")}>
                {values.city || t("prefs.cityPlaceholder")}
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  cityOpen && "rotate-180",
                )}
              />
            </button>
            {cityOpen && (
              <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
                <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
                  <Search className="size-4 shrink-0 text-muted-foreground" />
                  <input
                    autoFocus
                    value={cityQuery}
                    onChange={(e) => setCityQuery(e.target.value)}
                    placeholder={t("prefs.searchCities")}
                    className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <div className="no-scrollbar max-h-60 overflow-y-auto p-1.5">
                  {filteredCities.length === 0 && (
                    <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                      {t("prefs.cityPlaceholder")}
                    </p>
                  )}
                  {filteredCities.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => pickCity(c)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm active:bg-muted"
                    >
                      <span className="flex-1 truncate">{c.name}</span>
                      {values.city === c.name && (
                        <Check className="size-4 shrink-0 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border/60 bg-background/90 px-5 pb-safe pt-3 backdrop-blur">
        <Button
          onClick={() => void save()}
          disabled={saving}
          className="h-13 w-full rounded-full vybe-gradient text-base font-bold text-white shadow-glow"
        >
          {saving ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            t("common.save")
          )}
        </Button>
      </div>

      <UpgradeSheet
        open={upgradeFeature !== null}
        onOpenChange={(open) => !open && setUpgradeFeature(null)}
        feature={upgradeFeature ?? "locationControls"}
      />
    </div>
  );
}
