import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { nowMs } from "./helpers";

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

export const PHOTO = {
  w1: img("photo-1494790108377-be9c29b29330"),
  w2: img("photo-1438761681033-6461ffad8d80"),
  w3: img("photo-1544005313-94ddf0286df2"),
  w4: img("photo-1534528741775-53994a69daeb"),
  w5: img("photo-1524504388940-b1c1722653e1"),
  w6: img("photo-1517841905240-472988babdf9"),
  w7: img("photo-1529626455594-4ff0802cfb7e"),
  w8: img("photo-1580489944761-15a19d654956"),
  w9: img("photo-1573496359142-b8d87734a5a2"),
  w10: img("photo-1519345182560-3f2917c472ef"),
  m1: img("photo-1507003211169-0a1dd7228f2d"),
  m2: img("photo-1500648767791-00dcc994a43e"),
  m3: img("photo-1506794778202-cad84cf45f1d"),
  m4: img("photo-1539571696357-5a69c17a67c6"),
  m5: img("photo-1519085360753-af0119f7cbe7"),
  m6: img("photo-1521119989659-a83eee488004"),
  m7: img("photo-1547425260-76bcadfb4f2c"),
  m8: img("photo-1472099645785-5658abf4ff4e"),
  m9: img("photo-1560250097-0b93528c311a"),
  m10: img("photo-1492562080023-ab3db95bfbce"),
};

const CITY_CODES: Record<string, string> = {
  Istanbul: "TR",
  Ankara: "TR",
  "İzmir": "TR",
  Berlin: "DE",
  London: "GB",
  Paris: "FR",
  "New York": "US",
  "Los Angeles": "US",
  Dubai: "AE",
  Tokyo: "JP",
  Seoul: "KR",
  Barcelona: "ES",
  Amsterdam: "NL",
  "São Paulo": "BR",
  Sydney: "AU",
  "Cape Town": "ZA",
  Lisbon: "PT",
  "Mexico City": "MX",
};

type DemoProfile = {
  firstName: string;
  dateOfBirth: number;
  gender: "woman" | "man" | "nonbinary" | "other";
  interestedIn: ("woman" | "man" | "nonbinary" | "other")[];
  bio: string;
  photos: string[];
  interests: string[];
  languages: string[];
  city: string;
  approxLat: number;
  approxLng: number;
  lifestyle: string[];
  verified: boolean;
  prompts: { question: string; answer: string }[];
};

const y = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day)).getTime();

export const DEMO_PROFILES: DemoProfile[] = [
  {
    firstName: "Maya",
    dateOfBirth: y(1998, 4, 12),
    gender: "woman",
    interestedIn: ["man", "nonbinary"],
    bio: "Photographer chasing golden hour around Istanbul. Coffee first, then adventures. Ask me about the best hidden rooftops 🏙️",
    photos: [PHOTO.w1, PHOTO.w3, PHOTO.w5],
    interests: ["Photography", "Coffee", "Travel", "Vinyl", "Hiking"],
    languages: ["English", "Turkish"],
    city: "Istanbul",
    approxLat: 41.0082,
    approxLng: 28.9784,
    lifestyle: ["Non-smoker", "Occasional drinks", "Early riser"],
    verified: true,
    prompts: [
      { question: "My simple pleasure", answer: "A quiet ferry ride at sunset" },
      { question: "I'm weirdly attracted to", answer: "People who know their city's best bakery" },
    ],
  },
  {
    firstName: "Elif",
    dateOfBirth: y(2000, 9, 3),
    gender: "woman",
    interestedIn: ["woman", "nonbinary"],
    bio: "Design student who collects stamps in her passport. Sunday yoga, weeknight films, forever planning the next trip.",
    photos: [PHOTO.w2, PHOTO.w7, PHOTO.w10],
    interests: ["Yoga", "Films", "Design", "Languages", "Travel"],
    languages: ["Turkish", "English", "French"],
    city: "Istanbul",
    approxLat: 41.0151,
    approxLng: 28.9339,
    lifestyle: ["Non-smoker", "Vegan-ish", "Night owl"],
    verified: false,
    prompts: [
      { question: "Together we could", answer: "Pick a random movie and roast it gently" },
    ],
  },
  {
    firstName: "Deniz",
    dateOfBirth: y(1995, 1, 22),
    gender: "man",
    interestedIn: ["woman", "nonbinary"],
    bio: "Software engineer by day, indie musician by night. I'll cook you dinner if you bring the playlist.",
    photos: [PHOTO.m1, PHOTO.m3, PHOTO.m8],
    interests: ["Music", "Guitar", "Cooking", "Football", "Tech"],
    languages: ["Turkish", "English"],
    city: "Istanbul",
    approxLat: 41.0408,
    approxLng: 29.0013,
    lifestyle: ["Non-smoker", "Occasional drinks", "Social"],
    verified: true,
    prompts: [
      { question: "A life goal of mine", answer: "Record an album before 35" },
      { question: "Best travel story", answer: "Got lost in Kyoto, found the best ramen of my life" },
    ],
  },
  {
    firstName: "Emma",
    dateOfBirth: y(1998, 6, 30),
    gender: "woman",
    interestedIn: ["woman"],
    bio: "Illustrator and proud techno-nerd. Berlin summers are my love language. Looking for someone to cycle to the lake with.",
    photos: [PHOTO.w4, PHOTO.w9],
    interests: ["Techno", "Cycling", "Illustration", "Museums"],
    languages: ["German", "English", "Spanish"],
    city: "Berlin",
    approxLat: 52.52,
    approxLng: 13.405,
    lifestyle: ["Non-smoker", "Occasional drinks", "Night owl"],
    verified: true,
    prompts: [{ question: "I'm looking for", answer: "Deep talks that last until sunrise" }],
  },
  {
    firstName: "Liam",
    dateOfBirth: y(1994, 11, 8),
    gender: "man",
    interestedIn: ["woman"],
    bio: "Runner, startup founder, terrible dancer (great confidence). Sunday = park + pastries + you?",
    photos: [PHOTO.m2, PHOTO.m5],
    interests: ["Running", "Startups", "Travel", "Books"],
    languages: ["English", "French"],
    city: "London",
    approxLat: 51.5074,
    approxLng: -0.1278,
    lifestyle: ["Non-smoker", "Occasional drinks", "Early riser"],
    verified: true,
    prompts: [{ question: "My love language", answer: "Bringing you coffee without being asked" }],
  },
  {
    firstName: "Sofia",
    dateOfBirth: y(1999, 3, 17),
    gender: "woman",
    interestedIn: ["man", "woman", "nonbinary"],
    bio: "Flamenco dancer who cooks like abuela. Life's too short for boring food and quiet nights.",
    photos: [PHOTO.w5, PHOTO.w8],
    interests: ["Dance", "Cooking", "Art", "Live music"],
    languages: ["Spanish", "English", "Catalan"],
    city: "Barcelona",
    approxLat: 41.3874,
    approxLng: 2.1686,
    lifestyle: ["Non-smoker", "Social", "Night owl"],
    verified: false,
    prompts: [{ question: "A perfect day", answer: "Market in the morning, beach at noon, dancing at night" }],
  },
  {
    firstName: "Kenji",
    dateOfBirth: y(1996, 7, 25),
    gender: "man",
    interestedIn: ["woman"],
    bio: "Game designer. Ramen connoisseur. I can beat you at Mario Kart but I'll let you win the first round.",
    photos: [PHOTO.m4, PHOTO.m10],
    interests: ["Gaming", "Ramen", "Photography", "Anime"],
    languages: ["Japanese", "English"],
    city: "Tokyo",
    approxLat: 35.6762,
    approxLng: 139.6503,
    lifestyle: ["Non-smoker", "Occasional drinks", "Night owl"],
    verified: true,
    prompts: [{ question: "Weirdest talent", answer: "I can name any Pokemon by silhouette" }],
  },
  {
    firstName: "Aaliyah",
    dateOfBirth: y(2001, 12, 5),
    gender: "woman",
    interestedIn: ["woman", "nonbinary"],
    bio: "Music producer in the making. I write poems on napkins and play them on synths. Brooklyn forever.",
    photos: [PHOTO.w6, PHOTO.w2, PHOTO.w7],
    interests: ["Music production", "Poetry", "Fashion", "Art galleries"],
    languages: ["English", "Yoruba"],
    city: "New York",
    approxLat: 40.7128,
    approxLng: -74.006,
    lifestyle: ["Non-smoker", "Occasional drinks", "Night owl"],
    verified: false,
    prompts: [{ question: "I geek out on", answer: "Analog synthesizers and their 800 knobs" }],
  },
  {
    firstName: "Mateo",
    dateOfBirth: y(1993, 8, 14),
    gender: "man",
    interestedIn: ["woman"],
    bio: "Surfer, samba drummer, street-food hunter. If you can eat 10 pastéis, we're soulmates.",
    photos: [PHOTO.m6, PHOTO.m9],
    interests: ["Surfing", "Samba", "Street food", "Beach"],
    languages: ["Portuguese", "English", "Spanish"],
    city: "São Paulo",
    approxLat: -23.5505,
    approxLng: -46.6333,
    lifestyle: ["Non-smoker", "Social", "Early riser"],
    verified: false,
    prompts: [{ question: "My happy place", answer: "Any beach at 6am with a surfboard" }],
  },
  {
    firstName: "Zeynep",
    dateOfBirth: y(2002, 5, 19),
    gender: "woman",
    interestedIn: ["man"],
    bio: "UI designer who thinks cats > people (don't @ me). Café-hopping is my cardio. Will match your chaos.",
    photos: [PHOTO.w7, PHOTO.w10, PHOTO.w1],
    interests: ["Design", "Cats", "Cafés", "Photography"],
    languages: ["Turkish", "English"],
    city: "Istanbul",
    approxLat: 41.0422,
    approxLng: 28.9869,
    lifestyle: ["Non-smoker", "Occasional drinks", "Night owl"],
    verified: false,
    prompts: [{ question: "Together we could", answer: "Rate every café in Kadıköy" }],
  },
  {
    firstName: "Noah",
    dateOfBirth: y(1997, 2, 11),
    gender: "man",
    interestedIn: ["woman", "nonbinary"],
    bio: "Bicycle mechanic, jazz head, very serious about pancakes. Let's find a canal-side bench and talk.",
    photos: [PHOTO.m3, PHOTO.m7],
    interests: ["Cycling", "Jazz", "Sustainability", "Cooking"],
    languages: ["Dutch", "English", "German"],
    city: "Amsterdam",
    approxLat: 52.3676,
    approxLng: 4.9041,
    lifestyle: ["Non-smoker", "Occasional drinks", "Early riser"],
    verified: true,
    prompts: [{ question: "My simple pleasure", answer: "Fresh stroopwafels on a cold morning" }],
  },
  {
    firstName: "Luna",
    dateOfBirth: y(2000, 10, 2),
    gender: "woman",
    interestedIn: ["woman", "man"],
    bio: "K-beauty obsessed illustrator. I draw small worlds and sing off-key in noraebang rooms.",
    photos: [PHOTO.w8, PHOTO.w4],
    interests: ["K-pop", "Illustration", "K-beauty", "Gaming"],
    languages: ["Korean", "English"],
    city: "Seoul",
    approxLat: 37.5665,
    approxLng: 126.978,
    lifestyle: ["Non-smoker", "Occasional drinks", "Night owl"],
    verified: false,
    prompts: [{ question: "I'm weirdly attracted to", answer: "People with excellent playlist taste" }],
  },
  {
    firstName: "Omar",
    dateOfBirth: y(1994, 4, 28),
    gender: "man",
    interestedIn: ["woman"],
    bio: "Fitness coach who travels for food. Desert sunsets > everything. Gym time is non-negotiable, brunch is negotiable.",
    photos: [PHOTO.m5, PHOTO.m8, PHOTO.m2],
    interests: ["Fitness", "Travel", "Cars", "Food"],
    languages: ["Arabic", "English"],
    city: "Dubai",
    approxLat: 25.2048,
    approxLng: 55.2708,
    lifestyle: ["Non-smoker", "Non-drinker", "Early riser"],
    verified: true,
    prompts: [{ question: "A life goal of mine", answer: "Run a marathon in every desert city" }],
  },
  {
    firstName: "Chloe",
    dateOfBirth: y(1998, 1, 9),
    gender: "woman",
    interestedIn: ["man"],
    bio: "Film critic with a wine habit and a vintage shopping addiction. I cry at good trailers.",
    photos: [PHOTO.w9, PHOTO.w6],
    interests: ["Cinema", "Wine", "Vintage fashion", "Books"],
    languages: ["French", "English"],
    city: "Paris",
    approxLat: 48.8566,
    approxLng: 2.3522,
    lifestyle: ["Non-smoker", "Occasional drinks", "Night owl"],
    verified: true,
    prompts: [{ question: "Best date ever", answer: "A midnight film, then arguing about it over wine" }],
  },
  {
    firstName: "Berk",
    dateOfBirth: y(1997, 9, 27),
    gender: "man",
    interestedIn: ["woman"],
    bio: "Architect who sketches everything I see. Bosphorus walks, vinyls, and very strong opinions about coffee.",
    photos: [PHOTO.m9, PHOTO.m6],
    interests: ["Architecture", "Coffee", "Vinyl", "Hiking", "Films"],
    languages: ["Turkish", "English"],
    city: "Ankara",
    approxLat: 39.9334,
    approxLng: 32.8597,
    lifestyle: ["Non-smoker", "Occasional drinks", "Early riser"],
    verified: true,
    prompts: [
      { question: "My happy place", answer: "Any quiet spot with a view of water" },
    ],
  },
  {
    firstName: "Selin",
    dateOfBirth: y(1999, 12, 8),
    gender: "woman",
    interestedIn: ["man", "nonbinary"],
    bio: "Ceramic artist from İzmir. I make mugs, listen to old Anatolian rock, and can find the best seafood anywhere.",
    photos: [PHOTO.w10, PHOTO.w5],
    interests: ["Art", "Ceramics", "Seafood", "Beach", "Live music"],
    languages: ["Turkish", "English"],
    city: "İzmir",
    approxLat: 38.4192,
    approxLng: 27.1287,
    lifestyle: ["Non-smoker", "Occasional drinks", "Night owl"],
    verified: false,
    prompts: [
      { question: "Together we could", answer: "Road trip down the Aegean coast, zero plan" },
    ],
  },
  {
    firstName: "Alex",
    dateOfBirth: y(1996, 6, 6),
    gender: "nonbinary",
    interestedIn: ["nonbinary", "woman"],
    bio: "Climber and film photographer. I develop my own film, grow my own basil, and fall for people who ask questions.",
    photos: [PHOTO.m7, PHOTO.m1, PHOTO.w3],
    interests: ["Climbing", "Film photography", "Zines", "Plants"],
    languages: ["English", "Spanish"],
    city: "London",
    approxLat: 51.5123,
    approxLng: -0.0909,
    lifestyle: ["Non-smoker", "Occasional drinks", "Early riser"],
    verified: true,
    prompts: [{ question: "I'm looking for", answer: "Someone to belay me (and my ego)" }],
  },
];

const DAY = 24 * 60 * 60 * 1000;

/** Idempotently insert the demo profiles (development data). */
export const seedDemoProfiles = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
      .first();
    if (existing) return { seeded: false };

    const now = nowMs();
    for (const p of DEMO_PROFILES) {
      await ctx.db.insert("profiles", {
        userId: undefined,
        firstName: p.firstName,
        dateOfBirth: p.dateOfBirth,
        gender: p.gender,
        interestedIn: p.interestedIn,
        bio: p.bio,
        photos: p.photos,
        interests: p.interests,
        languages: p.languages,
        city: p.city,
        countryCode: CITY_CODES[p.city],
        countryName: undefined,
        cityId: p.city,
        approxLat: p.approxLat,
        approxLng: p.approxLng,
        lifestyle: p.lifestyle,
        relationshipIntentions: [],
        prompts: p.prompts,
        verified: p.verified,
        verificationStatus: p.verified ? "verified" : "none",
        showInDiscovery: true,
        profileHidden: false,
        onboardingCompleted: true,
        completedAt: now - 60 * DAY,
        lastActiveAt: now - Math.floor(Math.random() * 12) * 60 * 60 * 1000,
        isDemo: true,
        discoveryPrefs: {
          ageMin: 18,
          ageMax: 45,
          distanceKm: 200,
          genders: ["woman", "man", "nonbinary", "other"],
        },
        notificationPrefs: {
          matches: true,
          messages: true,
          likes: true,
          activity: true,
          events: true,
          promotions: false,
          push: true,
        },
        privacyPrefs: {
          readReceipts: true,
          onlineStatus: true,
          locationPrivacy: true,
          verificationPrivacy: true,
        },
      });
    }
    return { seeded: true };
  },
});

/**
 * Seed a new user's social graph: incoming likes from demo profiles, one
 * ready-made match with a conversation, and activity entries. Idempotent.
 */
export const seedInitialSocial = mutation({
  args: { profileId: v.id("profiles") },
  handler: async (ctx, { profileId }) => {
    const me = await ctx.db.get(profileId);
    if (!me) return;

    const demos = await ctx.db
      .query("profiles")
      .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
      .collect();
    if (demos.length === 0) return;

    const now = nowMs();

    // 1. Incoming likes from a handful of demo profiles (excluding Maya, who
    //    gets the ready-made match).
    const maya = demos.find((d) => d.firstName === "Maya");
    const likeCandidates = demos
      .filter((d) => d._id !== maya?._id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 6);

    for (const demo of likeCandidates) {
      const existingSwipe = await ctx.db
        .query("swipes")
        .withIndex("by_from_to", (q) =>
          q.eq("fromProfileId", demo._id).eq("toProfileId", profileId),
        )
        .first();
      if (existingSwipe) continue;
      const t = now - Math.floor(Math.random() * 3) * DAY - Math.floor(Math.random() * 20) * 60 * 60 * 1000;
      await ctx.db.insert("swipes", {
        fromProfileId: demo._id,
        toProfileId: profileId,
        action: "like",
        createdAt: t,
      });
      await ctx.db.insert("activity", {
        profileId,
        type: "like",
        fromProfileId: demo._id,
        title: `${demo.firstName} liked you`,
        createdAt: t,
      });
    }

    // 2. Ready-made match with Maya + conversation.
    if (maya) {
      const existingMatch = await ctx.db
        .query("matches")
        .withIndex("by_participants", (q) => q.eq("participants", [profileId]))
        .collect();
      const already = existingMatch.find(
        (m) => m.status === "active" && m.participants.includes(maya._id),
      );
      if (!already) {
        const matchId = await ctx.db.insert("matches", {
          participants: [profileId, maya._id],
          status: "active",
          createdAt: now - 2 * DAY,
          lastMessageAt: now - 5 * 60 * 60 * 1000,
          lastMessagePreview: "So, what's your favorite spot for a first date? ☕",
          lastMessageSender: maya._id,
        });

        const t1 = now - 2 * DAY + 3 * 60 * 60 * 1000;
        await ctx.db.insert("messages", {
          matchId,
          senderProfileId: maya._id,
          type: "text",
          content: "Heyyy finally matched with you! 🎉",
          createdAt: t1,
          deliveredAt: t1,
          readAt: t1 + 2 * 60 * 1000,
        });
        const t2 = now - 5 * 60 * 60 * 1000;
        await ctx.db.insert("messages", {
          matchId,
          senderProfileId: maya._id,
          type: "text",
          content: "Your profile gave me such good vibes 😄 So, what's your favorite spot for a first date? ☕",
          createdAt: t2,
          deliveredAt: t2,
        });

        await ctx.db.insert("activity", {
          profileId,
          type: "match",
          fromProfileId: maya._id,
          matchId,
          title: `You and ${maya.firstName} caught the same VYBE`,
          createdAt: now - 2 * DAY,
          readAt: now - 2 * DAY + 60 * 1000,
        });
        await ctx.db.insert("activity", {
          profileId,
          type: "message",
          fromProfileId: maya._id,
          matchId,
          title: `${maya.firstName} sent you a message`,
          createdAt: t2,
        });
      }
    }

    // 3. Touch "Maya" profile with a like swipe toward the user for realism.
    if (maya) {
      const existingSwipe = await ctx.db
        .query("swipes")
        .withIndex("by_from_to", (q) =>
          q.eq("fromProfileId", maya._id).eq("toProfileId", profileId),
        )
        .first();
      if (!existingSwipe) {
        await ctx.db.insert("swipes", {
          fromProfileId: maya._id,
          toProfileId: profileId,
          action: "like",
          createdAt: now - 3 * DAY,
        });
      }
    }
  },
});

/** Dev utility: reset demo data (delete demo profiles + their swipes). */
export const resetDemo = mutation({
  args: {},
  handler: async (ctx) => {
    const demos = await ctx.db
      .query("profiles")
      .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
      .collect();
    for (const d of demos) {
      const swipes = await ctx.db
        .query("swipes")
        .withIndex("by_from", (q) => q.eq("fromProfileId", d._id))
        .collect();
      for (const s of swipes) await ctx.db.delete(s._id);
      const matches = await ctx.db
        .query("matches")
        .withIndex("by_participants", (q) => q.eq("participants", [d._id]))
        .collect();
      for (const m of matches) {
        const msgs = await ctx.db
          .query("messages")
          .withIndex("by_match", (q) => q.eq("matchId", m._id))
          .collect();
        for (const msg of msgs) await ctx.db.delete(msg._id);
        await ctx.db.delete(m._id);
      }
      await ctx.db.delete(d._id);
    }
    return { reset: demos.length };
  },
});
