import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { distanceKm, getMyProfile, nowMs } from "./helpers";

/**
 * Nearby events + date ideas.
 *
 * External integration is opt-in via the EVENTS_API_URL / EVENTS_API_KEY env
 * vars (see fetchExternalEvents below). Without them the app shows curated
 * demo events seeded server-side — the UI never crashes or goes empty because
 * of a missing third-party key.
 */

type EventRow = {
  _id: Id<"events">;
  title: string;
  category: string;
  city: string;
  countryCode: string;
  venue?: string;
  lat?: number;
  lng?: number;
  startsAt: number;
  endsAt?: number;
  imageUrl?: string;
  description: string;
  source: string;
  externalId?: string;
};

const EVENT_IMG = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

/** Curated demo events across the supported city list. */
export const DEMO_EVENTS: {
  title: string;
  category: "coffee" | "dinner" | "walk" | "concert" | "exhibition" | "cinema" | "park" | "activity";
  city: string;
  countryCode: string;
  venue: string;
  lat: number;
  lng: number;
  imageUrl: string;
  description: string;
}[] = [
  {
    title: "Golden Hour Rooftop Coffee",
    category: "coffee",
    city: "Istanbul",
    countryCode: "TR",
    venue: "Süreyya Terrace, Kadıköy",
    lat: 40.9906,
    lng: 29.0303,
    imageUrl: EVENT_IMG("photo-1495474472287-4d71bcdd2085"),
    description: "Third-wave coffee with a Bosphorus view. Perfect first-date energy — low pressure, great light.",
  },
  {
    title: "İKSV Film Festival Screening",
    category: "cinema",
    city: "Istanbul",
    countryCode: "TR",
    venue: "Atlas Sineması, Beyoğlu",
    lat: 41.034,
    lng: 28.977,
    imageUrl: EVENT_IMG("photo-1489599849927-2ee91cede3ba"),
    description: "Independent cinema night. Arrive early, argue about the ending over tea afterwards.",
  },
  {
    title: "Sunset Walk: Bebek to Rumeli Hisarı",
    category: "walk",
    city: "Istanbul",
    countryCode: "TR",
    venue: "Bebek Park",
    lat: 41.0752,
    lng: 29.0435,
    imageUrl: EVENT_IMG("photo-1477959858617-67f85cf4f1df"),
    description: "A slow waterfront stroll as the city lights come on. Zero pressure, easy conversation.",
  },
  {
    title: "Jazz Night at Nardis",
    category: "concert",
    city: "Istanbul",
    countryCode: "TR",
    venue: "Nardis Jazz Club, Galata",
    lat: 41.0246,
    lng: 28.9734,
    imageUrl: EVENT_IMG("photo-1415201364774-f6f0bb35f28f"),
    description: "Live jazz in an intimate cellar club. The kind of night you remember.",
  },
  {
    title: "Modern Art at Pera Museum",
    category: "exhibition",
    city: "Istanbul",
    countryCode: "TR",
    venue: "Pera Museum, Tepebaşı",
    lat: 41.0325,
    lng: 28.9742,
    imageUrl: EVENT_IMG("photo-1577083552431-6e5fd01aa342"),
    description: "Contemporary exhibitions followed by the museum café. Culture + coffee in one move.",
  },
  {
    title: "Emirgan Park Picnic",
    category: "park",
    city: "Istanbul",
    countryCode: "TR",
    venue: "Emirgan Korusu",
    lat: 41.1053,
    lng: 29.0509,
    imageUrl: EVENT_IMG("photo-1505142468610-359e7d316be0"),
    description: "Bring snacks, a blanket and good questions. Tulips in spring, golden leaves in autumn.",
  },
  {
    title: "Pottery Workshop for Two",
    category: "activity",
    city: "Istanbul",
    countryCode: "TR",
    venue: "Studio Kadıköy",
    lat: 40.9906,
    lng: 29.0239,
    imageUrl: EVENT_IMG("photo-1565193566173-7a0ee3dbe261"),
    description: "Hands-on pottery class — get messy together, keep the good pieces.",
  },
  {
    title: "Street Food Tour: Karaköy",
    category: "dinner",
    city: "Istanbul",
    countryCode: "TR",
    venue: "Karaköy backstreets",
    lat: 41.0227,
    lng: 28.9772,
    imageUrl: EVENT_IMG("photo-1414235077428-338989a2e8c0"),
    description: "Bite-sized tour of the best balık ekmek, midye and baklava corners.",
  },
  {
    title: "Leyton Sunday Market Brunch",
    category: "dinner",
    city: "London",
    countryCode: "GB",
    venue: "Leyton High Road",
    lat: 51.557,
    lng: -0.009,
    imageUrl: EVENT_IMG("photo-1521017432531-fbd92d768814"),
    description: "Sunday market stroll with coffee, vinyl and street food stalls.",
  },
  {
    title: "Open-Air Cinema: Regent's Park",
    category: "cinema",
    city: "London",
    countryCode: "GB",
    venue: "Regent's Park Open Air Theatre",
    lat: 51.5287,
    lng: -0.1548,
    imageUrl: EVENT_IMG("photo-1485846234645-a62644f84728"),
    description: "Classic films under the stars. Blankets recommended, popcorn essential.",
  },
  {
    title: "Seine Sunset Cruise",
    category: "walk",
    city: "Paris",
    countryCode: "FR",
    venue: "Pont Neuf",
    lat: 48.857,
    lng: 2.339,
    imageUrl: EVENT_IMG("photo-1502602898657-3e91760cbb34"),
    description: "A relaxed evening walk along the river — the Eiffel Tower does the talking.",
  },
  {
    title: "Museum Mile Afternoon",
    category: "exhibition",
    city: "Berlin",
    countryCode: "DE",
    venue: "Museum Island",
    lat: 52.519,
    lng: 13.401,
    imageUrl: EVENT_IMG("photo-1554907984-15263bfd63bd"),
    description: "Pick two museums, wander between them, compare favourite pieces over spätkauf drinks.",
  },
  {
    title: "Brooklyn Flea + Coffee",
    category: "coffee",
    city: "New York",
    countryCode: "US",
    venue: "Brooklyn Flea, Fort Greene",
    lat: 40.6913,
    lng: -73.9736,
    imageUrl: EVENT_IMG("photo-1445116572660-236099ec97a0"),
    description: "Vintage finds and cold brew — a classic low-key first outing.",
  },
  {
    title: "Yoyogi Park Picnic Jam",
    category: "park",
    city: "Tokyo",
    countryCode: "JP",
    venue: "Yoyogi Park",
    lat: 35.6717,
    lng: 139.695,
    imageUrl: EVENT_IMG("photo-1528360983277-13d401cdc186"),
    description: "Riverside picnic with buskers, cherry blossoms and people-watching.",
  },
  {
    title: "K-Pop Dance Class",
    category: "activity",
    city: "Seoul",
    countryCode: "KR",
    venue: "Hongdae Studio",
    lat: 37.5573,
    lng: 126.9257,
    imageUrl: EVENT_IMG("photo-1508700115892-45ecd05ae2ad"),
    description: "Learn a routine together, laugh at yourselves, grab tteokbokki after.",
  },
  {
    title: "La Boqueria Food Stroll",
    category: "dinner",
    city: "Barcelona",
    countryCode: "ES",
    venue: "Mercat de la Boqueria",
    lat: 41.3817,
    lng: 2.171,
    imageUrl: EVENT_IMG("photo-1513635269975-59663e0ac1ad"),
    description: "Tapas crawl through the market — taste everything, share everything.",
  },
];

/** Seed curated demo events (idempotent). Runs on onboarding completion. */
export const seedDemoEvents = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("events").first();
    if (existing) return { seeded: 0 };

    const now = nowMs();
    const DAY = 24 * 60 * 60 * 1000;
    let seeded = 0;
    for (let i = 0; i < DEMO_EVENTS.length; i++) {
      const e = DEMO_EVENTS[i];
      const base = now + (i % 14) * DAY + 2 * DAY;
      // Spread across upcoming weekends + weekday evenings.
      const d = new Date(base);
      const day = d.getDay();
      const weekendOffset = day === 0 || day === 6 ? 0 : 6 - day;
      d.setDate(d.getDate() + weekendOffset);
      d.setHours(18 + (i % 3) * 2, 30, 0, 0);
      await ctx.db.insert("events", {
        title: e.title,
        category: e.category,
        city: e.city,
        countryCode: e.countryCode,
        venue: e.venue,
        lat: e.lat,
        lng: e.lng,
        startsAt: d.getTime(),
        endsAt: d.getTime() + 2.5 * 60 * 60 * 1000,
        imageUrl: e.imageUrl,
        description: e.description,
        source: "demo",
        createdAt: now,
      });
      seeded++;
    }
    return { seeded };
  },
});

/** Try an external events provider when configured. Never throws. */
async function fetchExternalEvents(): Promise<EventRow[] | null> {
  const url = process.env.EVENTS_API_URL;
  if (!url) return null;
  const key = process.env.EVENTS_API_KEY;
  if (!key) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { events?: unknown[] } | unknown[];
    const list = Array.isArray(data) ? data : (data as { events?: unknown[] }).events;
    if (!Array.isArray(list)) return null;
    const mapped: EventRow[] = [];
    for (const raw of list.slice(0, 40)) {
      const r = raw as Record<string, unknown>;
      if (typeof r.title !== "string" || typeof r.startsAt !== "number") continue;
      mapped.push({
        _id: `${r.externalId ?? r.title}` as Id<"events">,
        title: r.title,
        category: typeof r.category === "string" ? r.category : "activity",
        city: typeof r.city === "string" ? r.city : "",
        countryCode: typeof r.countryCode === "string" ? r.countryCode : "",
        venue: typeof r.venue === "string" ? r.venue : undefined,
        lat: typeof r.lat === "number" ? r.lat : undefined,
        lng: typeof r.lng === "number" ? r.lng : undefined,
        startsAt: r.startsAt,
        endsAt: typeof r.endsAt === "number" ? r.endsAt : undefined,
        imageUrl: typeof r.imageUrl === "string" ? r.imageUrl : undefined,
        description: typeof r.description === "string" ? r.description : "",
        source: "external",
        externalId: typeof r.externalId === "string" ? r.externalId : undefined,
      });
    }
    return mapped;
  } catch {
    return null;
  }
}

/**
 * Events feed for the signed-in user. Filters by discovery prefs city/country
 * when set (falls back to nearby demo events otherwise), enriches with saved +
 * liked state and distance. External provider is consulted when configured.
 */
export const listEvents = query({
  args: { category: v.optional(v.string()) },
  handler: async (ctx, { category }) => {
    const me = await getMyProfile(ctx);
    if (!me) return { events: [], savedIds: [], likedIds: [], external: false };

    const rows = await ctx.db.query("events").order("asc").collect();
    const external = await fetchExternalEvents();

    const originLat = me.approxLat;
    const originLng = me.approxLng;
    const prefsCountry = me.countryCode;
    const prefsCity = me.city;

    const mySaves = await ctx.db
      .query("eventSaves")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .collect();
    const savedIds = new Set(mySaves.map((s) => s.eventId.toString()));

    const myLikes = await ctx.db
      .query("eventLikes")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .collect();
    const likedIds = new Set(myLikes.map((l) => l.eventId.toString()));

    const now = nowMs();
    const out: {
      _id: string;
      title: string;
      category: string;
      city: string;
      venue?: string;
      startsAt: number;
      endsAt?: number;
      imageUrl?: string;
      description: string;
      distanceKm: number | null;
      saved: boolean;
      liked: boolean;
      source: string;
    }[] = [];

    const push = (e: EventRow, saved: boolean, liked: boolean) => {
      if (e.startsAt < now - 6 * 60 * 60 * 1000) return; // skip long-past events
      if (category && e.category !== category) return;
      if (prefsCountry && e.countryCode && e.countryCode !== prefsCountry) return;
      let dist: number | null = null;
      if (
        originLat !== undefined &&
        originLng !== undefined &&
        e.lat !== undefined &&
        e.lng !== undefined
      ) {
        dist = Math.round(distanceKm(originLat, originLng, e.lat, e.lng));
      }
      out.push({
        _id: e._id.toString(),
        title: e.title,
        category: e.category,
        city: e.city,
        venue: e.venue,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        imageUrl: e.imageUrl,
        description: e.description,
        distanceKm: dist,
        saved,
        liked,
        source: e.source,
      });
    };

    for (const e of rows) {
      push(e, savedIds.has(e._id.toString()), likedIds.has(e._id.toString()));
    }
    if (external) {
      for (const e of external) {
        push(e, false, false);
      }
    }

    // Same-city first, then nearest, then soonest.
    const isSameCity = (city: string) => prefsCity !== undefined && city === prefsCity;
    out.sort((a, b) => {
      const aSame = isSameCity(a.city);
      const bSame = isSameCity(b.city);
      if (aSame !== bSame) return aSame ? -1 : 1;
      if (a.distanceKm !== null && b.distanceKm !== null && a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      if (a.distanceKm !== null && b.distanceKm === null) return -1;
      if (b.distanceKm !== null && a.distanceKm === null) return 1;
      return a.startsAt - b.startsAt;
    });

    return {
      events: out.slice(0, 60),
      savedIds: [...savedIds],
      likedIds: [...likedIds],
      external: external !== null,
    };
  },
});

export const saveEvent = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error("Event not found");
    const existing = await ctx.db
      .query("eventSaves")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .filter((q) => q.eq(q.field("eventId"), eventId))
      .first();
    if (existing) return { saved: true };
    await ctx.db.insert("eventSaves", {
      profileId: me._id,
      eventId,
      createdAt: nowMs(),
    });
    return { saved: true };
  },
});

export const unsaveEvent = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    const existing = await ctx.db
      .query("eventSaves")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .filter((q) => q.eq(q.field("eventId"), eventId))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return { saved: false };
  },
});

export const likeEvent = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error("Event not found");
    const existing = await ctx.db
      .query("eventLikes")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .filter((q) => q.eq(q.field("eventId"), eventId))
      .first();
    if (!existing) {
      await ctx.db.insert("eventLikes", {
        profileId: me._id,
        eventId,
        createdAt: nowMs(),
      });
    }
    return { liked: true };
  },
});

export const unlikeEvent = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, { eventId }) => {
    const me = await getMyProfile(ctx);
    if (!me) throw new Error("Not found");
    const existing = await ctx.db
      .query("eventLikes")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .filter((q) => q.eq(q.field("eventId"), eventId))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    return { liked: false };
  },
});

/** My saved events (used by the Events screen "Saved" filter). */
export const mySavedEvents = query({
  args: {},
  handler: async (ctx) => {
    const me = await getMyProfile(ctx);
    if (!me) return [];
    const saves = await ctx.db
      .query("eventSaves")
      .withIndex("by_profile", (q) => q.eq("profileId", me._id))
      .order("desc")
      .collect();
    const out: EventRow[] = [];
    for (const s of saves) {
      const e = await ctx.db.get(s.eventId);
      if (e) out.push(e);
    }
    return out;
  },
});
