#!/usr/bin/env python3
"""Generate src/data/geo.ts from the downloaded world datasets."""
import json
import re

countries = json.load(open("/tmp/countries.json"))
places = json.load(open("/tmp/places.geojson"))


def norm(s):
    if not s:
        return ""
    s = s.lower()
    for a, b in [("ı", "i"), ("İ", "i"), ("ß", "ss"), ("ø", "o"), ("đ", "d"), ("æ", "ae"), ("ő", "o"), ("ű", "u")]:
        s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


countries_out = []
for c in countries:
    code = c.get("iso2")
    if not code:
        continue
    countries_out.append(
        {
            "code": code,
            "name": c.get("name", ""),
            "native": c.get("native") or c.get("name", ""),
            "capital": c.get("capital") or "",
            "emoji": c.get("emoji") or "",
            "lat": c.get("latitude"),
            "lng": c.get("longitude"),
        }
    )
countries_out.sort(key=lambda c: c["name"])

by_country = {}
for f in places["features"]:
    p = f["properties"]
    code = p.get("iso_a2")
    name = p.get("name")
    lat = p.get("latitude")
    lng = p.get("longitude")
    if not code or not name or lat is None or lng is None:
        continue
    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        continue
    coords = f.get("geometry", {}).get("coordinates")
    if coords and len(coords) >= 2:
        try:
            lng, lat = float(coords[0]), float(coords[1])
        except (TypeError, ValueError):
            pass
    pop = p.get("pop_max") or 0
    try:
        pop = float(pop)
    except (TypeError, ValueError):
        pop = 0
    by_country.setdefault(code, []).append((name, lat, lng, pop))

CAP = 14
city_rows = []
for c in countries_out:
    code = c["code"]
    items = by_country.get(code, [])
    seen = {}
    for name, lat, lng, pop in items:
        key = norm(name)
        if not key:
            continue
        if key not in seen or pop > seen[key][3]:
            seen[key] = (name, lat, lng, pop)
    lst = sorted(seen.values(), key=lambda x: -x[3])[:CAP]
    cap = c["capital"]
    if cap:
        ck = norm(cap)
        if ck and not any(norm(x[0]) == ck for x in lst):
            found = next((x for x in seen.values() if norm(x[0]) == ck), None)
            if found:
                lst.append(found)
            elif c.get("lat") is not None and c.get("lng") is not None:
                lst.append((cap, float(c["lat"]), float(c["lng"]), 0))
    lst.sort(key=lambda x: -x[3])
    for name, lat, lng, pop in lst:
        city_rows.append((code, name, round(lat, 4), round(lng, 4)))

city_rows.sort(key=lambda r: (r[0], r[1]))


def ts(s):
    return json.dumps(s, ensure_ascii=False)


lines = []
lines.append("// Auto-generated worldwide geography data (ISO 3166-1 countries + populated places).")
lines.append("// Do not edit by hand. Sources: countries-states-cities-database (MIT) + Natural Earth (public domain).")
lines.append("")
lines.append("export type Country = { code: string; name: string; native: string; capital: string; emoji: string };")
lines.append("export type GeoCity = { name: string; code: string; lat: number; lng: number };")
lines.append("")
lines.append("export const COUNTRIES: Country[] = [")
for c in countries_out:
    lines.append(
        "  { code: %s, name: %s, native: %s, capital: %s, emoji: %s },"
        % (ts(c["code"]), ts(c["name"]), ts(c["native"]), ts(c["capital"]), ts(c["emoji"]))
    )
lines.append("];")
lines.append("")
lines.append("export const COUNTRIES_BY_CODE: Record<string, Country> = Object.fromEntries(")
lines.append("  COUNTRIES.map((c) => [c.code, c]),")
lines.append(");")
lines.append("")
lines.append("export const CITIES: GeoCity[] = [")
for code, name, lat, lng in city_rows:
    lines.append("  { name: %s, code: %s, lat: %s, lng: %s }," % (ts(name), ts(code), lat, lng))
lines.append("];")
lines.append("")
lines.append("/** Cities grouped by country code (drives the dependent country → city select). */")
lines.append("export const CITIES_BY_COUNTRY: Record<string, GeoCity[]> = CITIES.reduce(")
lines.append("  (acc, city) => {")
lines.append("    (acc[city.code] ??= []).push(city);")
lines.append("    return acc;")
lines.append("  },")
lines.append("  {} as Record<string, GeoCity[]>,")
lines.append(");")
lines.append("")
lines.append("/** Nearest city to given coordinates (used for the optional GPS autofill). */")
lines.append("export function nearestCity(lat: number, lng: number): GeoCity | null {")
lines.append("  let best: GeoCity | null = null;")
lines.append("  let bestDist = Infinity;")
lines.append("  for (const c of CITIES) {")
lines.append("    const dLat = (c.lat - lat) * 111.32;")
lines.append("    const dLng = (c.lng - lng) * 111.32 * Math.cos((lat * Math.PI) / 180);")
lines.append("    const d = Math.sqrt(dLat * dLat + dLng * dLng);")
lines.append("    if (d < bestDist) {")
lines.append("      bestDist = d;")
lines.append("      best = c;")
lines.append("    }")
lines.append("  }")
lines.append("  return bestDist <= 350 ? best : null;")
lines.append("}")
lines.append("")
lines.append("/** Flag emoji from an ISO 3166-1 alpha-2 code (no asset downloads needed). */")
lines.append("export function flagEmoji(code: string): string {")
lines.append('  if (!/^[A-Za-z]{2}$/.test(code)) return "";')
lines.append(
    "  return String.fromCodePoint(...[...code.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));"
)
lines.append("}")

with open("src/data/geo.ts", "w", encoding="utf-8") as fh:
    fh.write("\n".join(lines) + "\n")

print("countries:", len(countries_out), "cities:", len(city_rows))
print("TR:", [r for r in city_rows if r[0] == "TR"][:8])
print("JP:", [r for r in city_rows if r[0] == "JP"][:8])
print("with zero cities:", [c["code"] for c in countries_out if not any(r[0] == c["code"] for r in city_rows)])
