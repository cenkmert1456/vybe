import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Tone = "funny" | "cool" | "romantic" | "short";

type Suggestions = {
  source: "local" | "ai";
  bios: string[];
  prompts: { question: string; answer: string }[];
  openers: string[];
};

/**
 * AI Profile Assistant with an honest fallback: when no LLM provider is
 * configured (or the call fails), it returns deterministic smart templates
 * built from the user's own inputs. Never crashes, never fakes an AI result.
 */
export function AiAssistant({
  selectedInterests,
  bio,
  onApplyBio,
  onApplyPrompts,
}: {
  selectedInterests: string[];
  bio: string;
  onApplyBio: (text: string) => void;
  onApplyPrompts: (prompts: { question: string; answer: string }[]) => void;
}) {
  const { t } = useI18n();
  const generate = useAction(api.ai.generateProfileSuggestions);

  const [traits, setTraits] = useState("");
  const [hobbies, setHobbies] = useState("");
  const [intention, setIntention] = useState("");
  const [tone, setTone] = useState<Tone>("funny");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Suggestions | null>(null);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await generate({
        interests: selectedInterests,
        traits: traits.split(",").map((s) => s.trim()).filter(Boolean),
        intention,
        hobbies: hobbies.split(",").map((s) => s.trim()).filter(Boolean),
        tone,
      });
      setResult(res as Suggestions);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const applyBio = (text: string) => {
    onApplyBio(text);
    haptic("light");
    toast.success(t("ai.applied"));
  };

  const applyPrompts = (p: Suggestions["prompts"]) => {
    onApplyPrompts(p.filter((x) => x.question && x.answer.trim()));
    haptic("light");
    toast.success(t("ai.applied"));
  };

  const tones: { id: Tone; label: string }[] = [
    { id: "funny", label: t("ai.tone_funny") },
    { id: "cool", label: t("ai.tone_cool") },
    { id: "romantic", label: t("ai.tone_romantic") },
    { id: "short", label: t("ai.tone_short") },
  ];

  const inputCls =
    "h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary";

  return (
    <div className="rounded-3xl border border-primary/25 bg-gradient-to-br from-violet-500/10 via-transparent to-pink-500/10 p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl vybe-gradient text-white shadow-glow">
          <Wand2 className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold">{t("ai.title")}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t("ai.desc")}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2.5">
        <input
          value={traits}
          onChange={(e) => setTraits(e.target.value)}
          placeholder={t("ai.traits")}
          className={inputCls}
        />
        <input
          value={hobbies}
          onChange={(e) => setHobbies(e.target.value)}
          placeholder={t("ai.hobbies")}
          className={inputCls}
        />
        <select
          value={intention}
          onChange={(e) => setIntention(e.target.value)}
          className={inputCls}
        >
          <option value="">{t("ai.intention")}</option>
          <option value="Dating">Dating</option>
          <option value="New friends">New friends</option>
          <option value="Long-term connection">Long-term connection</option>
          <option value="Casual connection">Casual connection</option>
        </select>
        <div className="flex gap-1.5">
          {tones.map((tn) => (
            <button
              key={tn.id}
              type="button"
              onClick={() => setTone(tn.id)}
              className={cn(
                "min-h-9 flex-1 rounded-full border px-2 py-1.5 text-[11px] font-bold transition-all active:scale-95",
                tone === tn.id
                  ? "border-transparent vybe-gradient text-white shadow-glow"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {tn.label}
            </button>
          ))}
        </div>
        <Button
          onClick={() => void run()}
          disabled={busy || selectedInterests.length === 0}
          className="h-11 w-full rounded-full vybe-gradient text-sm font-bold text-white shadow-glow"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {busy ? t("ai.generating") : t("ai.generate")}
        </Button>
        {selectedInterests.length === 0 && (
          <p className="text-center text-[11px] text-muted-foreground">{t("ai.empty")}</p>
        )}
      </div>

      {result && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {result.source === "ai" ? t("ai.sourceAi") : t("ai.sourceLocal")}
          </p>

          {result.bios.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold">{t("ai.bios")}</p>
              <div className="flex flex-col gap-1.5">
                {result.bios.map((b, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyBio(b)}
                    className="rounded-xl border border-border/70 bg-card/70 p-3 text-left text-xs leading-relaxed active:bg-muted/60"
                  >
                    <span className="line-clamp-3">{b}</span>
                    <span className="mt-1 block text-[10px] font-bold text-primary">
                      {t("ai.apply")} →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {result.prompts.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold">{t("ai.prompts")}</p>
              <button
                type="button"
                onClick={() => applyPrompts(result.prompts)}
                className="w-full rounded-xl border border-border/70 bg-card/70 p-3 text-left text-xs leading-relaxed active:bg-muted/60"
              >
                {result.prompts.map((p, i) => (
                  <span key={i} className="block">
                    <span className="font-semibold">{p.question}</span> {p.answer}
                  </span>
                ))}
                <span className="mt-1 block text-[10px] font-bold text-primary">
                  {t("ai.apply")} →
                </span>
              </button>
            </div>
          )}

          {result.openers.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold">{t("ai.openers")}</p>
              <div className="flex flex-col gap-1.5">
                {result.openers.map((o, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyBio(bio ? `${bio}\n\n${o}` : o)}
                    className="rounded-xl border border-border/70 bg-card/70 p-3 text-left text-xs leading-relaxed active:bg-muted/60"
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
