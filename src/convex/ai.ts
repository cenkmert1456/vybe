import { v } from "convex/values";
import { action } from "./_generated/server";

/**
 * AI Profile Assistant + Dating Coach.
 *
 * When OPENAI_API_KEY is configured, these actions call the OpenAI chat API
 * and instruct it to respond entirely in the user's selected app language
 * (passed as `lang`). Without a key (or on any provider error) they fall back
 * to deterministic local templates — the feature always works, never crashes,
 * and never pretends an external AI was used.
 */

const FALLBACK_OPENERS = [
  "I'll make you laugh, I'll make you think, and I'll always show up with snacks.",
  "First round's on me if you can guess my favorite travel story.",
  "Professional over-thinker. Ask me about the time I almost missed my flight.",
];

const FALLBACK_PROMPTS = [
  { question: "My perfect weekend is…", answer: "" },
  { question: "You can win me over by…", answer: "" },
  { question: "Together we could…", answer: "" },
];

const TR_FALLBACK_OPENERS = [
  "Seni güldürürüm, düşündürürüm ve her zaman atıştırmalıklarla gelirim.",
  "En sevdiğim seyahat hikayemi tahmin edebilirsen ilk tur benden.",
  "Profesyonel bir düşünürüm. Uçağı kaçırdığım zamanı bana sor.",
];

const TR_FALLBACK_PROMPTS = [
  { question: "Benim için mükemmel hafta sonu…", answer: "" },
  { question: "Beni kazanmanın yolu…", answer: "" },
  { question: "Birlikte yapabiliriz…", answer: "" },
];

type SuggestionResult = {
  source: "local" | "ai";
  bios: string[];
  prompts: { question: string; answer: string }[];
  openers: string[];
};

type SuggestionInput = {
  interests: string[];
  traits: string[];
  intention: string;
  hobbies: string[];
  tone: "funny" | "cool" | "romantic" | "short";
  lang: string;
};

const isTr = (lang: string) => lang === "tr";

function localSuggestions(input: SuggestionInput): SuggestionResult {
  const topics = [...input.interests, ...input.hobbies].filter(Boolean).slice(0, 5);
  const topicList = topics.length ? topics.slice(0, 3).join(", ") : "good conversation";
  const top = topics[0] ?? "life";
  const intention = input.intention || "meaningful connections";

  if (isTr(input.lang)) {
    const tone = input.tone;
    const bios: string[] = [];
    if (tone === "funny") {
      bios.push(
        `Profesyonel ${top.toLowerCase()} tutkunu. Son ${top.toLowerCase()} maceramı sor — bio'mdan daha iyi bir hikaye, söz.`,
        `${topicList} için geldim, sohbet için kaldım. Uyarı: atıştırmalık ve şüpheli fikirler getiririm.`,
      );
    } else if (tone === "cool") {
      bios.push(
        `${topicList} ve sakin kalmak bende. İyi ${top.toLowerCase()} ve daha iyi sohbet — plan bu kadar.`,
        `${topicList} benim alanım. ${top.toLowerCase()} ve iyi enerji varsa anlaşırız.`,
      );
    } else if (tone === "romantic") {
      bios.push(
        `${topicList} üzerinden ${intention} arıyorum. En iyi sohbetler ${top.toLowerCase()} ile başlar, planla biter.`,
        `${topicList}, yavaş sabahlar ve ne istediğini bilen insanlar. Uyup uymadığımızı görelim.`,
      );
    } else {
      bios.push(
        `${topicList} insanı. ${top.toLowerCase()} ve güzel bir hikaye için her zaman varım.`,
        `Kahve, ${top.toLowerCase()} ve gerçekten bir yere varan sohbetler.`,
      );
    }
    const prompts = TR_FALLBACK_PROMPTS.map((p, i) => ({
      question: p.question,
      answer:
        i === 0
          ? `${topics[0] ?? "Sakin"} bir sabah, ${topics[1] ?? "güzel kahve"} ve plansız bir gün`
          : i === 1
            ? `Gerçek bir ${topics[0]?.toLowerCase() ?? "hikaye"} ve iyi mizah`
            : `${topics[1]?.toLowerCase() ?? "spontane"} bir günü yeni bir yerde planlamak`,
    }));
    return {
      source: "local" as const,
      bios,
      prompts,
      openers: [
        `Hey! İkimizin de ${topicList} sevdiğini fark ettim — şu an favori ${top.toLowerCase()} şeyin ne?`,
        `Tamam, büyük soru: ${topics[0] ?? "senin"} — tek kelimeyle, başla.`,
        ...TR_FALLBACK_OPENERS,
      ].slice(0, 3),
    };
  }

  const tone = input.tone;
  const bios: string[] = [];

  if (tone === "funny") {
    bios.push(
      `Professional ${top.toLowerCase()} enthusiast. Ask me about my last great ${top.toLowerCase()} adventure — I promise it's a better story than my bio.`,
      `I came for the ${topicList} and stayed for the conversation. Warning: I'll bring snacks and questionable opinions.`,
    );
  } else if (tone === "cool") {
    bios.push(
      `Into ${topicList} and keeping it low-key. Good ${top.toLowerCase()} and better company — that's the whole plan.`,
      `${topicList} — that's my lane. If you're about ${top.toLowerCase()} and good energy, we'll get along.`,
    );
  } else if (tone === "romantic") {
    bios.push(
      `Looking for ${intention} over shared ${topicList}. I believe the best conversations start with ${top.toLowerCase()} and end with a plan.`,
      `I'm a sucker for ${topicList}, slow mornings, and people who know what they want. Let's find out if we fit.`,
    );
  } else {
    bios.push(
      `${topicList} person. Always down for ${top.toLowerCase()} and a good story.`,
      `Coffee, ${top.toLowerCase()}, and conversations that actually go somewhere.`,
    );
  }

  const prompts = FALLBACK_PROMPTS.map((p, i) => ({
    question: p.question,
    answer:
      i === 0
        ? `${topics[0] ?? "A slow"} morning, ${topics[1] ?? "great coffee"}, and zero plans`
        : i === 1
          ? `A genuine ${topics[0]?.toLowerCase() ?? "story"} and good humor`
          : `Plan a ${topics[1]?.toLowerCase() ?? "spontaneous"} day somewhere new`,
  }));

  return {
    source: "local" as const,
    bios,
    prompts,
    openers: [
      `Hey! I noticed we both like ${topicList} — what's your favorite ${top.toLowerCase()} thing right now?`,
      `Okay, big question: ${topics[0] ?? "your"} — in one word, go.`,
      ...FALLBACK_OPENERS,
    ].slice(0, 3),
  };
}

export const generateProfileSuggestions = action({
  args: {
    interests: v.array(v.string()),
    traits: v.array(v.string()),
    intention: v.string(),
    hobbies: v.array(v.string()),
    tone: v.union(v.literal("funny"), v.literal("cool"), v.literal("romantic"), v.literal("short")),
    lang: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<SuggestionResult> => {
    const apiKey = process.env.OPENAI_API_KEY;
    const lang = args.lang ?? "en";
    if (!apiKey) return localSuggestions({ ...args, lang });

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.8,
          max_tokens: 600,
          messages: [
            {
              role: "system",
              content:
                `You are a dating-app bio assistant. You must respond entirely in the user's currently selected application language: ${lang}. Do not switch languages unless the user explicitly asks. Return STRICT JSON: { "bios": string[3], "prompts": [{question, answer}][3], "openers": string[3] }. No markdown, no extra text.`,
            },
            {
              role: "user",
              content: `Interests: ${args.interests.join(", ") || "none"}. Traits: ${args.traits.join(", ") || "none"}. Looking for: ${args.intention || "connection"}. Hobbies: ${args.hobbies.join(", ") || "none"}. Tone: ${args.tone}.`,
            },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return localSuggestions({ ...args, lang });
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(
        content.replace(/```json|```/g, "").trim(),
      ) as {
        bios?: string[];
        prompts?: { question: string; answer: string }[];
        openers?: string[];
      };
      if (
        !Array.isArray(parsed.bios) ||
        parsed.bios.length === 0 ||
        !Array.isArray(parsed.prompts)
      ) {
        return localSuggestions({ ...args, lang });
      }
      return {
        source: "ai" as const,
        bios: parsed.bios.slice(0, 3),
        prompts: parsed.prompts.slice(0, 3),
        openers: (parsed.openers ?? []).slice(0, 3),
      };
    } catch {
      return localSuggestions({ ...args, lang });
    }
  },
});

// ---------------------------------------------------------------------------
// Dating Coach
// ---------------------------------------------------------------------------

export type CoachMode =
  | "firstMessage"
  | "reply"
  | "rescue"
  | "bio"
  | "bioImprove"
  | "prompts";

export type CoachTone =
  | "friendly"
  | "flirty"
  | "funny"
  | "confident"
  | "romantic"
  | "casual";

type CoachInput = {
  mode: CoachMode;
  tone: CoachTone;
  context: string; // what's happening (their profile / chat snippet / current bio)
  theirName?: string;
  lang: string;
};

type CoachResult = {
  source: "local" | "ai";
  suggestions: string[];
  explanation: string;
};

const TR_HINTS: Record<CoachMode, { explain: string; stems: Record<string, string[]> }> = {
  firstMessage: {
    explain: "Sohbeti açacak kısa ve kişisel bir ilk mesaj önerisi.",
    stems: {
      friendly: ["Hey {name}! {topic} benim de favorim — en çok neyi seviyorsun?", "Selam {name}, profilindeki {topic} beni çekti. Biraz anlatır mısın?"],
      flirty: ["{name}, {topic} hakkında konuşmak için bir bahanem yok ama iyi bir ilk izlenim bırakmaya çalışıyorum. 😏", "Merhaba {name}, profilinde {topic} görünce gülümsedim. Bunu birlikte yapmalıyız."],
      funny: ["{name}, {topic} konusunda uzman olduğumu iddia ediyorum. Seni ikna etmem için bir şans verir misin?", "Selam {name}! {topic} hakkında kötü bir şaka biliyorum. Risk almaya hazır mısın?"],
      confident: ["{name}, seninle tanışmak için direkt söylüyorum: {topic} benim de dünyam. Hafta sonu planın ne?", "Merhaba {name}, {topic} hakkında konuşmaya değer biri gibi duruyorsun."],
      romantic: ["{name}, {topic} hakkında soracaklarım var ama asıl merak ettiğim seninle bir kahve içmek.", "Selam {name}, profilinde {topic} görünce durdum. Şansımı denemek istiyorum."],
      casual: ["Hey {name}, nasılsın? Profilinde {topic} dikkatimi çekti.", "Merhaba {name}, {topic} senin işin mi? Ben de biraz deniyorum."],
    },
  },
  reply: {
    explain: "Karşı tarafın mesajına doğal bir devam önerisi.",
    stems: {
      friendly: ["Bu harika bir soru! Benim cevabım şöyle olurdu: {topic}. Peki sen?", "Evet, aynen öyle düşünüyorum. {topic} hakkında ne dersin?"],
      flirty: ["Gülümsettin beni. 😊 {topic} hakkında daha çok şey anlat — çok merak ettim.", "Bunu bana söylemen çok hoş. {topic} konusunda devam edelim mi?"],
      funny: ["Bu mesajı okurken güldüm, sonra kahvemi döktüm. Teşekkürler! ☕ {topic}?", "Ciddi cevap vereceğim ama önce {topic} hakkında şaka yapmama izin ver."],
      confident: ["Söylediklerine katılıyorum. {topic} konusunda net bir fikrim var — sor.", "Evet, kesinlikle. {topic} üzerine konuşmak isterim."],
      romantic: ["Mesajını okurken gülümsedim. {topic} hakkında konuşurken daha çok zaman geçirmek isterim.", "Bu çok tatlı. {topic} hakkında seninle konuşmak hoşuma gider."],
      casual: ["Haklısın, {topic} güzel bir konu. Sen ne düşünüyorsun?", "Aynen. {topic} hakkında daha fazla şey öğrenmek isterim."],
    },
  },
  rescue: {
    explain: "Sohbet duraksadığında canlandıracak bir soru önerisi.",
    stems: {
      friendly: ["Sana son sorduğum soruyu unut, şunu sorayım: {topic}?", "Konuyu değiştireyim: {topic} hakkında ne dersin?"],
      flirty: ["Aramızda bir sessizlik var, doldurmam gerek. 😏 {topic} ile başlayalım mı?", "Sıkıldın mı yoksa ben mi öyle hissediyorum? {topic} konusuyla döneyim."],
      funny: ["Bu sohbetin kurtarılması gerekiyor ve ben bu işte iyiyim. {topic}?", "Eğer {topic} hakkında konuşmazsak bu sohbet resmi olarak bitti sayılır."],
      confident: ["Tamam, yeni bir konu: {topic}. Fikrini merak ediyorum.", "Duraksadık, sorun değil. {topic} hakkında ne düşünüyorsun?"],
      romantic: ["Konuyu değiştirmek istiyorum çünkü seninle {topic} hakkında konuşmak hoşuma gider.", "Sessizliği böleyim: {topic} hakkında ne hayal ediyorsun?"],
      casual: ["Bu sohbeti canlandırmanın zamanı geldi. {topic}?", "Ne dersin, {topic} hakkında konuşalım mı?"],
    },
  },
  bio: {
    explain: "Profilin için kısa ve çekici bio önerisi.",
    stems: {
      friendly: ["Kahve, {topic} ve güzel sohbetler. Yeni insanlar tanımaktan keyif alıyorum.", "Merhaba! {topic} benim dünyam. Seninle tanışmayı çok isterim."],
      flirty: ["{topic} tutkum. Bir de iyi kahve. İkisini birlikte paylaşmak ister misin? 😉", "Gülümsemem ve {topic} konusundaki bilgim yeterince çekici, gerisini konuşalım."],
      funny: ["{topic} konusunda profesyonelim, diğer her şeyde amatör. Sormaktan çekinme.", "Bio yazmaktan nefret ediyorum ama {topic} hakkında saatlerce konuşabilirim."],
      confident: ["{topic} benim alanım. Ne istediğimi biliyorum ve iyi sohbeti severim.", "Seninle tanışmak için buradayım. {topic} hakkında konuşmaya hazırım."],
      romantic: ["{topic} hakkında konuşurken en mutlu halimdeyim. Seninle bir hikaye yazmak isterim.", "Gözlerim {topic} görünce parlar, kalbim iyi bir sohbetle atar."],
      casual: ["{topic} seven biri. Günlük kahve, hafta sonu {topic}.", "Sade bir insanım: {topic}, kahve ve iyi müzik."],
    },
  },
  bioImprove: {
    explain: "Mevcut bio'nu daha çekici bir hale getiren sürüm önerileri.",
    stems: {
      friendly: ["Yeni sürüm: \"{topic} ve güzel sohbetler benim için vazgeçilmez. Seninle tanışmak isterim.\"", "Öneri: \"Merhaba, {topic} severim ve yeni hikayeler biriktirmekten hoşlanırım.\""],
      flirty: ["Öneri: \"{topic} hakkında saatlerce konuşabilirim — seninle başlamak isterim. 😉\"", "Yeni bio: \"{topic} tutkum, iyi mizah bonusum. Denemeye değer.\""],
      funny: ["Öneri: \"{topic} konusunda ciddi, geri kalan her şeyde şakacıyım. Risk alan kazanır.\"", "Yeni sürüm: \"Bio yazmak zor, {topic} hakkında konuşmak kolay. Hangisini seçersin?\""],
      confident: ["Öneri: \"{topic} benim alanım ve ne istediğimi biliyorum. Sen de biliyorsan konuşalım.\"", "Yeni bio: \"{topic} hakkında konuşacak birini arıyorum. Başvurular açık.\""],
      romantic: ["Öneri: \"{topic} ile başlayan sohbetlerin güzel şeylere dönüştüğüne inanıyorum.\"", "Yeni sürüm: \"{topic} görünce gözlerim parlar; umarım sen de öylesin.\""],
      casual: ["Öneri: \"{topic} severim, kahve içerim, iyi bir sohbeti kaçırmam.\"", "Yeni bio: \"{topic} ve sade hayat. Konuşmaya hazırım.\""],
    },
  },
  prompts: {
    explain: "Profilin için soru-cevap önerileri.",
    stems: {
      friendly: ["Soru: \"Benimle tanışan biri beni nasıl anlatır?\" Cevap: \"{topic} ve güler yüzlü biri olarak.\"", "Soru: \"Hafta sonu planın?\" Cevap: \"{topic} üzerine bir şeyler, sonrası sohbete kalmış.\""],
      flirty: ["Soru: \"Beni etkilemenin yolu?\" Cevap: \"{topic} hakkında konuşmak ve iyi bir kahve teklifi. 😉\"", "Soru: \"İlk buluşmada beni ne etkiler?\" Cevap: \"{topic} sevgisi ve doğal bir gülümseme.\""],
      funny: ["Soru: \"En iyi hikayem?\" Cevap: \"{topic} hakkında neredeyse uzman sayılırım, gerisi talih.\"", "Soru: \"Benimle sohbet etmek?\" Cevap: \"{topic} konusunu aç, gerisi kendiliğinden gelir.\""],
      confident: ["Soru: \"Neden ben?\" Cevap: \"{topic} konusunda gerçekten iyiyim ve bunu paylaşmak isterim.\"", "Soru: \"Seni farklı kılan?\" Cevap: \"{topic} hakkında net fikirlerim var.\""],
      romantic: ["Soru: \"Aşk hayatım?\" Cevap: \"{topic} hakkında konuşurken en çok kendim oluyorum.\"", "Soru: \"Beni mutlu eden şey?\" Cevap: \"{topic} ve onu paylaşabileceğim biri.\""],
      casual: ["Soru: \"Sıradan bir günüm?\" Cevap: \"Kahve, {topic} ve iyi bir playlist.\"", "Soru: \"Beni tanımanın yolu?\" Cevap: \"{topic} hakkında konuş, gerisini anlatırım.\""],
    },
  },
};

const EN_HINTS: Record<CoachMode, { explain: string; stems: Record<string, string[]> }> = {
  firstMessage: {
    explain: "Short, personal openers that spark a reply.",
    stems: {
      friendly: ["Hey {name}! {topic} is a favorite of mine too — what do you love most about it?", "Hi {name}, your {topic} bit really caught my eye. Tell me more?"],
      flirty: ["{name}, I don't have a reason to bring up {topic}, but I'm trying to make a good first impression. 😏", "Hi {name}, I smiled when I saw {topic} on your profile. We should do that together."],
      funny: ["{name}, I claim to be an expert on {topic}. Care to give me a chance to prove it?", "Hey {name}! I know a terrible joke about {topic}. Feeling brave?"],
      confident: ["{name}, I'll be direct: {topic} is my world too. What's your weekend looking like?", "Hi {name}, you seem like someone worth talking {topic} with."],
      romantic: ["{name}, I have questions about {topic} — but what I really want to ask is whether I could buy you a coffee.", "Hi {name}, I stopped scrolling at {topic}. I wanted to take my shot."],
      casual: ["Hey {name}, how's it going? {topic} on your profile caught my eye.", "Hi {name}, is {topic} your thing? I dabble a little myself."],
    },
  },
  reply: {
    explain: "Natural continuations that keep the conversation moving.",
    stems: {
      friendly: ["That's a great question! My answer would be: {topic}. What about you?", "Yes, I think the same. What do you think about {topic}?"],
      flirty: ["You made me smile. 😊 Tell me more about {topic} — I'm curious now.", "That's lovely of you to say. Shall we keep going on {topic}?"],
      funny: ["I laughed reading this, then spilled my coffee. Thanks! ☕ {topic}?", "I'll give a serious answer, but first let me make a {topic} joke."],
      confident: ["I agree with you. I have a clear take on {topic} — ask me.", "Yes, definitely. I'd love to talk {topic} with you."],
      romantic: ["I smiled reading your message. I'd love more time to talk about {topic}.", "That's sweet. Talking {topic} with you sounds nice."],
      casual: ["You're right, {topic} is a good topic. What do you think?", "Same here. I'd like to learn more about {topic}."],
    },
  },
  rescue: {
    explain: "Revive a stalled conversation with a fresh question.",
    stems: {
      friendly: ["Forget my last question — let me ask this instead: {topic}?", "Changing tack: what do you think about {topic}?"],
      flirty: ["There's a silence between us. Let me fill it. 😏 Shall we start with {topic}?", "Bored, or am I imagining it? Let me switch to {topic}."],
      funny: ["This conversation needs rescuing and I'm great at that. {topic}?", "If we don't talk about {topic}, this chat is officially over."],
      confident: ["Okay, new topic: {topic}. I'm curious what you think.", "We stalled — no problem. What's your take on {topic}?"],
      romantic: ["I want to change the subject because I enjoy talking {topic} with you.", "Let me break the silence: what do you imagine about {topic}?"],
      casual: ["Time to revive this chat. {topic}?", "What do you say we talk about {topic}?"],
    },
  },
  bio: {
    explain: "Short, engaging bios built from your inputs.",
    stems: {
      friendly: ["Coffee, {topic}, and good conversations. I enjoy meeting new people.", "Hi! {topic} is my world. I'd love to meet you."],
      flirty: ["{topic} is my passion. So is good coffee. Care to share both? 😉", "My smile and my {topic} knowledge are attractive enough — let's talk."],
      funny: ["I'm a professional at {topic} and an amateur at everything else. Ask away.", "I hate writing bios but I can talk about {topic} for hours."],
      confident: ["{topic} is my lane. I know what I want and I love a good conversation.", "I'm here to meet you. Ready to talk {topic}."],
      romantic: ["I'm happiest talking about {topic}. I'd like to write a story with you.", "My eyes light up at {topic}, my heart at a great conversation."],
      casual: ["A {topic} lover. Daily coffee, weekend {topic}.", "Simple person: {topic}, coffee, and good music."],
    },
  },
  bioImprove: {
    explain: "Sharper versions of your existing bio.",
    stems: {
      friendly: ["Try: \"{topic} and good conversation are non-negotiables for me. I'd love to meet you.\"", "Rewrite: \"Hi, I love {topic} and collecting new stories.\""],
      flirty: ["Try: \"I could talk about {topic} for hours — I'd like to start with you. 😉\"", "New bio: \"{topic} is my passion, good humor is my bonus. Worth a try.\""],
      funny: ["Try: \"Serious about {topic}, playful about everything else. Risk-takers welcome.\"", "Rewrite: \"Writing bios is hard, talking {topic} is easy. Which do you pick?\""],
      confident: ["Try: \"{topic} is my lane and I know what I want. If you do too, let's talk.\"", "New bio: \"Looking for someone to talk {topic} with. Applications open.\""],
      romantic: ["Try: \"I believe conversations that start with {topic} can turn into something beautiful.\"", "Rewrite: \"My eyes light up at {topic} — I hope yours do too.\""],
      casual: ["Try: \"I love {topic}, drink coffee, and never miss a good conversation.\"", "New bio: \"{topic} and the simple life. Ready to chat.\""],
    },
  },
  prompts: {
    explain: "Question-answer prompts for your profile.",
    stems: {
      friendly: ["Q: \"How would someone describe you?\" A: \"As someone into {topic} with a warm smile.\"", "Q: \"Weekend plans?\" A: \"Something around {topic}, the rest depends on the conversation.\""],
      flirty: ["Q: \"The way to win me over?\" A: \"Talk {topic} with me and offer a great coffee. 😉\"", "Q: \"What impresses you on a first date?\" A: \"A love for {topic} and a natural smile.\""],
      funny: ["Q: \"Best story?\" A: \"I'm almost an expert on {topic}; the rest is luck.\"", "Q: \"Talking to me?\" A: \"Bring up {topic}; the rest takes care of itself.\""],
      confident: ["Q: \"Why me?\" A: \"I'm genuinely great at {topic} and I want to share that.\"", "Q: \"What makes you different?\" A: \"I have strong opinions about {topic}.\""],
      romantic: ["Q: \"Love life?\" A: \"I'm most myself when talking about {topic}.\"", "Q: \"What makes you happy?\" A: \"{topic}, and someone to share it with.\""],
      casual: ["Q: \"A normal day?\" A: \"Coffee, {topic}, and a good playlist.\"", "Q: \"Best way to know me?\" A: \"Talk {topic}; I'll handle the rest.\""],
    },
  },
};

function coachLocal(input: CoachInput): CoachResult {
  const hints = isTr(input.lang) ? TR_HINTS : EN_HINTS;
  const hint = hints[input.mode];
  const stems = hint?.stems[input.tone] ?? hint?.stems.casual ?? [];
  const topic = input.context.trim().slice(0, 80) || "something fun";
  const name = input.theirName?.trim() || "there";
  const suggestions = stems
    .map((s) => s.split("{name}").join(name).split("{topic}").join(topic))
    .slice(0, 3);
  return {
    source: "local",
    suggestions,
    explanation: hint?.explain ?? "",
  };
}

export const coachAdvice = action({
  args: {
    mode: v.union(
      v.literal("firstMessage"),
      v.literal("reply"),
      v.literal("rescue"),
      v.literal("bio"),
      v.literal("bioImprove"),
      v.literal("prompts"),
    ),
    tone: v.union(
      v.literal("friendly"),
      v.literal("flirty"),
      v.literal("funny"),
      v.literal("confident"),
      v.literal("romantic"),
      v.literal("casual"),
    ),
    context: v.string(),
    theirName: v.optional(v.string()),
    lang: v.string(),
  },
  handler: async (_ctx, args): Promise<CoachResult> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return coachLocal(args);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.85,
          max_tokens: 500,
          messages: [
            {
              role: "system",
              content:
                `You are a warm, sharp dating coach. You must respond entirely in the user's currently selected application language: ${args.lang}. Do not switch languages unless the user explicitly asks. Return STRICT JSON: { "suggestions": string[3], "explanation": string (one short sentence) }. No markdown, no extra text.`,
            },
            {
              role: "user",
              content: `Mode: ${args.mode}. Tone: ${args.tone}. Their name: ${args.theirName ?? "unknown"}. Context: ${args.context.slice(0, 600)}`,
            },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return coachLocal(args);
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(
        content.replace(/```json|```/g, "").trim(),
      ) as { suggestions?: string[]; explanation?: string };
      if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
        return coachLocal(args);
      }
      return {
        source: "ai",
        suggestions: parsed.suggestions.slice(0, 3),
        explanation: parsed.explanation ?? "",
      };
    } catch {
      return coachLocal(args);
    }
  },
});
