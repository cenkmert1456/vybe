export const INTERESTS = [
  "Photography",
  "Travel",
  "Music",
  "Cooking",
  "Fitness",
  "Yoga",
  "Hiking",
  "Films",
  "Gaming",
  "Art",
  "Design",
  "Books",
  "Coffee",
  "Wine",
  "Dance",
  "Surfing",
  "Football",
  "Running",
  "Fashion",
  "Cats",
  "Dogs",
  "Languages",
  "Tech",
  "Sustainability",
  "Live music",
  "Concerts",
  "Street food",
  "Brunch",
  "Climbing",
  "Beach",
  "Skiing",
  "Reading",
  "Podcasts",
  "Board games",
  "Karaoke",
  "Vintage",
  "Cars",
  "Poetry",
  "Meditation",
  "Vinyl",
] as const;

export const LIFESTYLE = [
  "Non-smoker",
  "Smoker",
  "Occasional drinks",
  "Non-drinker",
  "Social",
  "Early riser",
  "Night owl",
  "Vegetarian",
  "Vegan",
  "Fitness-focused",
  "Homebody",
  "Adventurous",
] as const;

export const LANGUAGES = [
  "English",
  "Turkish",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Japanese",
  "Korean",
  "Arabic",
  "Dutch",
  "Russian",
  "Chinese",
  "Hindi",
  "Swedish",
  "Greek",
  "Polish",
  "Hebrew",
] as const;

export const GENDERS = ["woman", "man", "nonbinary", "other"] as const;

export type GenderValue = (typeof GENDERS)[number];

export const REPORT_CATEGORIES = [
  "fake_profile",
  "harassment",
  "inappropriate",
  "spam",
  "underage",
  "other",
] as const;

export const PROMPT_QUESTIONS = [
  "My perfect weekend is…",
  "You can win me over by…",
  "The fastest way to make me laugh is…",
  "My current obsession is…",
  "Let's debate…",
  "My ideal spontaneous plan is…",
  "My simple pleasure",
  "A life goal of mine",
  "I'm weirdly attracted to",
  "Together we could",
  "My love language is",
  "Best travel story",
  "A perfect day",
  "I geek out on",
  "My happy place",
  "I'm looking for",
  "My most irrational fear",
  "Weirdest talent",
] as const;

export const CHAT_EMOJI = [
  "😀", "😂", "🥰", "😍", "😎", "🤔", "😅", "🥲", "😢", "😡",
  "👍", "👎", "👏", "🙌", "🙏", "🤝", "💪", "🫶", "✌️", "👀",
  "❤️", "💜", "💛", "💚", "🔥", "✨", "⭐", "🌹", "🎉", "🥂",
  "☕", "🍕", "🍜", "🍣", "🍦", "🌮", "🍷", "🍺",
  "😴", "🤗", "🤯", "🥳", "😇", "😈", "💯", "🚀", "🌈", "⚡",
] as const;

// Worldwide country + city data lives in src/data/geo.ts (auto-generated from
// ISO 3166-1 + Natural Earth populated places). Re-exported here so existing
// imports keep working.
export {
  COUNTRIES,
  COUNTRIES_BY_CODE,
  CITIES,
  CITIES_BY_COUNTRY,
  nearestCity,
  flagEmoji,
} from "@/data/geo";
export type { Country, GeoCity } from "@/data/geo";

/** Relationship intentions (configurable discovery filter). */
export const INTENTIONS = [
  "Something casual",
  "New friends",
  "Long-term partner",
  "Relationship, open to exploring",
  "Figuring it out",
] as const;

/** Education levels (optional profile field). */
export const EDUCATION = [
  "High school",
  "Associate degree",
  "Bachelor's degree",
  "Master's degree",
  "Doctorate",
  "Trade school",
  "Prefer not to say",
] as const;

/** Distance presets in km (5/10/25/50/100/250/anywhere). */
export const DISTANCE_OPTIONS = [5, 10, 25, 50, 100, 250, 4000] as const;
export const ANYWHERE_KM = 4000;

/** Discovery max-distance picker (the spec's 1–100 km range). */
export const DISTANCE_PRESETS = [1, 5, 10, 25, 50, 75, 100] as const;

/** "Looking for" options (Discovery Preferences). */
export const LOOKING_FOR = [
  "New friends",
  "Dating",
  "Long-term connection",
  "Casual connection",
  "Activity partners",
] as const;

/** Vibe reactions sent from the discovery card (VYBE signature interaction). */
export const VIBES: { type: string; emoji: string; label: string }[] = [
  { type: "energetic", emoji: "🔥", label: "Energetic" },
  { type: "music", emoji: "🎵", label: "Music vibe" },
  { type: "coffee", emoji: "☕", label: "Coffee?" },
  { type: "travel", emoji: "✈️", label: "Travel buddy" },
];

/** Emojis available for message reactions. */
export const MESSAGE_REACTIONS = ["❤️", "😂", "👍", "🔥", "😮", "😢"] as const;

/** Moods for VYBE Moments. */
export const MOODS = ["✨", "🔥", "🌙", "☀️", "🎶", "🏔️", "🌊", "🎉", "☕", "💜"] as const;


export const MAX_BIO_LENGTH = 300;
export const MAX_PHOTOS = 6;
export const SUPER_VYBE_DAILY_LIMIT = 3;

/** Event categories used by the Events screen + demo data. */
export const EVENT_CATEGORIES = [
  "coffee",
  "dinner",
  "walk",
  "concert",
  "exhibition",
  "cinema",
  "park",
  "activity",
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_CATEGORY_META: Record<
  EventCategory,
  { emoji: string; label: string }
> = {
  coffee: { emoji: "☕", label: "Coffee" },
  dinner: { emoji: "🍽️", label: "Dinner" },
  walk: { emoji: "🚶", label: "Walk" },
  concert: { emoji: "🎤", label: "Concert" },
  exhibition: { emoji: "🖼️", label: "Exhibition" },
  cinema: { emoji: "🎬", label: "Cinema" },
  park: { emoji: "🌳", label: "Park" },
  activity: { emoji: "⚡", label: "Activity" },
};

/** Music genres for the profile Music section. */
export const MUSIC_GENRES = [
  "Pop",
  "Rock",
  "Hip-Hop",
  "R&B",
  "Electronic",
  "House",
  "Techno",
  "Indie",
  "Alternative",
  "Jazz",
  "Classical",
  "Folk",
  "Country",
  "Reggaeton",
  "Latin",
  "K-Pop",
  "Metal",
  "Punk",
  "Soul",
  "Ambient",
  "Afrobeat",
  "Turkish pop",
  "Arabesk",
  "Rap",
] as const;

/** Popular artists offered as quick picks in the Music section. */
export const MUSIC_ARTIST_PICKS = [
  "Beyoncé",
  "Drake",
  "Taylor Swift",
  "The Weeknd",
  "Bad Bunny",
  "Billie Eilish",
  "Dua Lipa",
  "Rihanna",
  "Kanye West",
  "Tame Impala",
  "Frank Ocean",
  "Arctic Monkeys",
  "Fred again..",
  "Pink Floyd",
  "Adele",
  "SZA",
  "Kendrick Lamar",
  "Lana Del Rey",
  "Travis Scott",
  "Coldplay",
  "Sezen Aksu",
  "Barış Manço",
] as const;

/** Max duration of a voice intro in seconds. */
export const VOICE_INTRO_MAX_SECONDS = 30;

/** Referral code format: VYBE-XXXXX (alphanumeric, no confusing chars). */
export const REFERRAL_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const REFERRAL_CODE_PREFIX = "VYBE";

/** Daily tasks tracked on the Daily Vibe screen. */
export const DAILY_TASKS = [
  "answer",
  "message",
  "open",
] as const;
export type DailyTask = (typeof DAILY_TASKS)[number];
