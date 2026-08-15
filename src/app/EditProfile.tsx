import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { useI18n } from "@/lib/i18n";
import {
  INTERESTS,
  LANGUAGES,
  LIFESTYLE,
  MAX_BIO_LENGTH,
  PROMPT_QUESTIONS,
  MAX_PHOTOS,
} from "@/lib/constants";
import { usePhotoUpload } from "@/components/mobile/PhotoUpload";
import { Chip, ScreenHeader, SectionTitle } from "@/components/mobile/ui";
import { AiAssistant } from "@/components/mobile/AiAssistant";
import { VoiceIntroRecorder } from "@/components/mobile/VoiceIntroRecorder";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeftCircle,
  ArrowRightCircle,
  Camera,
  Check,
  Loader2,
  Plus,
  X,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";

type Prompt = { question: string; answer: string };

export default function EditProfile() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const myProfile = useQuery(api.profiles.myProfile);
  const updateProfile = useMutation(api.profiles.updateProfile);
  const updateMusic = useMutation(api.profiles.updateMusic);
  const removeProfilePhoto = useMutation(api.upload.removeProfilePhoto);
  const reorderPhotos = useMutation(api.upload.reorderPhotos);
  const { uploading, uploadProfilePhoto } = usePhotoUpload();

  const [photos, setPhotos] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [lifestyle, setLifestyle] = useState<string[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [artists, setArtists] = useState<string[]>([]);
  const [tracks, setTracks] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [artistInput, setArtistInput] = useState("");
  const [trackInput, setTrackInput] = useState("");
  const [genreInput, setGenreInput] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!myProfile) return;
    setPhotos(myProfile.photos);
    setBio(myProfile.bio);
    setInterests(myProfile.interests);
    setLanguages(myProfile.languages);
    setLifestyle(myProfile.lifestyle);
    setPrompts(myProfile.prompts);
    setArtists(myProfile.music?.topArtists ?? []);
    setTracks(myProfile.music?.topTracks ?? []);
    setGenres(myProfile.music?.genres ?? []);
  }, [myProfile]);

  if (myProfile === undefined) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const addPhoto = async (file: File) => {
    try {
      await uploadProfilePhoto(file);
      toast(t("profile.savedToast"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("verify.error"));
    }
  };

  const removePhoto = async (url: string) => {
    try {
      await removeProfilePhoto({ url });
      setPhotos((p) => p.filter((x) => x !== url));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("profile.saveError"));
    }
  };

  const movePhoto = async (index: number, dir: -1 | 1) => {
    const next = [...photos];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setPhotos(next);
    try {
      await reorderPhotos({ orderedUrls: next });
    } catch {
      toast.error(t("profile.saveError"));
    }
  };

  const toggle = (
    list: string[],
    setList: (v: string[]) => void,
    value: string,
    max?: number,
  ) => {
    if (list.includes(value)) setList(list.filter((x) => x !== value));
    else if (!max || list.length < max) setList([...list, value]);
  };

  const addItem = (
    list: string[],
    setList: (v: string[]) => void,
    value: string,
    setInput: (v: string) => void,
    max = 20,
  ) => {
    const v = value.trim();
    if (!v || list.includes(v)) return;
    setList([...list, v].slice(0, max));
    setInput("");
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateProfile({
        bio: bio.trim(),
        interests,
        languages,
        lifestyle,
        prompts: prompts.filter((p) => p.question && p.answer.trim()),
      });
      await updateMusic({ topArtists: artists, topTracks: tracks, genres });
      toast(t("profile.savedToast"));
      navigate(-1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("profile.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ScreenHeader
        title={t("edit.title")}
        right={
          <Button
            onClick={() => void save()}
            disabled={saving}
            size="sm"
            className="h-9 rounded-full vybe-gradient px-4 text-xs font-bold text-white"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            {t("edit.save")}
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-8">
        {/* Photos */}
        <section className="mt-4">
          <SectionTitle>{t("edit.photosTitle")}</SectionTitle>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {photos.map((p, i) => (
              <motion.div
                key={p}
                layout
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-border/60"
              >
                <img src={p} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold text-white">
                    MAIN
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/70 to-transparent p-1.5">
                  <button
                    type="button"
                    aria-label="Move earlier"
                    disabled={i === 0}
                    onClick={() => void movePhoto(i, -1)}
                    className="flex size-7 items-center justify-center rounded-full bg-white/20 text-white disabled:opacity-30"
                  >
                    <ArrowLeftCircle className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("profile.removePhoto")}
                    onClick={() => void removePhoto(p)}
                    className="flex size-7 items-center justify-center rounded-full bg-white/20 text-white"
                  >
                    <X className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move later"
                    disabled={i === photos.length - 1}
                    onClick={() => void movePhoto(i, 1)}
                    className="flex size-7 items-center justify-center rounded-full bg-white/20 text-white disabled:opacity-30"
                  >
                    <ArrowRightCircle className="size-4" />
                  </button>
                </div>
              </motion.div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 text-muted-foreground"
              >
                {uploading ? (
                  <Loader2 className="size-6 animate-spin" />
                ) : (
                  <Camera className="size-6" />
                )}
                <span className="text-xs font-medium">{t("profile.addPhoto")}</span>
              </button>
            )}
          </div>
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
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t("profile.reorderHint")}
          </p>
        </section>

        {/* Bio */}
        <section className="mt-6">
          <SectionTitle>{t("edit.bioTitle")}</SectionTitle>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
            placeholder={t("onboard.bioPlaceholder")}
            className="mt-2 min-h-28 rounded-2xl border-input bg-card p-4 text-[15px] leading-relaxed"
            maxLength={MAX_BIO_LENGTH}
          />
          <p className="mt-1 text-right text-[11px] text-muted-foreground">
            {MAX_BIO_LENGTH - bio.length}
          </p>
        </section>

        {/* AI Assistant */}
        <section className="mt-6">
          <SectionTitle>{t("edit.aiTitle")}</SectionTitle>
          <div className="mt-2">
            <AiAssistant
              selectedInterests={interests}
              bio={bio}
              onApplyBio={(text) => setBio(text.slice(0, MAX_BIO_LENGTH))}
              onApplyPrompts={(p) => setPrompts(p.slice(0, 3))}
            />
          </div>
        </section>

        {/* Voice intro */}
        <section className="mt-6">
          <SectionTitle>{t("edit.voiceTitle")}</SectionTitle>
          <div className="mt-2">
            <VoiceIntroRecorder />
          </div>
        </section>

        {/* Interests */}
        <section className="mt-6">
          <SectionTitle>{t("edit.interestsTitle")}</SectionTitle>
          <div className="mt-2 flex flex-wrap gap-2">
            {INTERESTS.map((i) => (
              <Chip
                key={i}
                selected={interests.includes(i)}
                onClick={() => toggle(interests, setInterests, i, 12)}
              >
                {i}
              </Chip>
            ))}
          </div>
        </section>

        {/* Lifestyle */}
        <section className="mt-6">
          <SectionTitle>{t("profile.lifestyleEdit")}</SectionTitle>
          <div className="mt-2 flex flex-wrap gap-2">
            {LIFESTYLE.map((l) => (
              <Chip
                key={l}
                selected={lifestyle.includes(l)}
                onClick={() => toggle(lifestyle, setLifestyle, l)}
              >
                {l}
              </Chip>
            ))}
          </div>
        </section>

        {/* Languages */}
        <section className="mt-6">
          <SectionTitle>{t("edit.languagesTitle")}</SectionTitle>
          <div className="mt-2 flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <Chip
                key={l}
                selected={languages.includes(l)}
                onClick={() => toggle(languages, setLanguages, l, 6)}
              >
                {l}
              </Chip>
            ))}
          </div>
        </section>

        {/* Music */}
        <section className="mt-6">
          <SectionTitle>{t("edit.musicTitle")}</SectionTitle>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {t("edit.musicHint")}
          </p>
          <div className="mt-3 space-y-3">
            <MusicRow
              label={t("music.artists")}
              value={artistInput}
              onChange={setArtistInput}
              onAdd={() => addItem(artists, setArtists, artistInput, setArtistInput)}
              onRemove={(v) => setArtists((l) => l.filter((x) => x !== v))}
              items={artists}
            />
            <MusicRow
              label={t("music.tracks")}
              value={trackInput}
              onChange={setTrackInput}
              onAdd={() => addItem(tracks, setTracks, trackInput, setTrackInput)}
              onRemove={(v) => setTracks((l) => l.filter((x) => x !== v))}
              items={tracks}
            />
            <MusicRow
              label={t("music.genres")}
              value={genreInput}
              onChange={setGenreInput}
              onAdd={() => addItem(genres, setGenres, genreInput, setGenreInput)}
              onRemove={(v) => setGenres((l) => l.filter((x) => x !== v))}
              items={genres}
            />
          </div>
        </section>

        {/* Prompts */}
        <section className="mt-6">
          <SectionTitle>{t("edit.promptsTitle")}</SectionTitle>
          <div className="mt-2 space-y-3">
            {prompts.map((p, idx) => (
              <div key={idx} className="rounded-2xl border border-border/70 bg-card/60 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={p.question}
                    onChange={(e) =>
                      setPrompts((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, question: e.target.value } : x)),
                      )
                    }
                    className="min-w-0 flex-1 rounded-xl border border-input bg-card px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary"
                  >
                    {PROMPT_QUESTIONS.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setPrompts((prev) => prev.filter((_, i) => i !== idx))}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
                    aria-label={t("edit.removePrompt")}
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <textarea
                  value={p.answer}
                  onChange={(e) =>
                    setPrompts((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, answer: e.target.value } : x)),
                    )
                  }
                  placeholder={t("edit.promptAnswer")}
                  maxLength={200}
                  className="mt-2 min-h-16 w-full resize-none rounded-xl border border-input bg-card p-3 text-sm outline-none focus:border-primary"
                />
              </div>
            ))}
            {prompts.length < 3 && (
              <button
                type="button"
                onClick={() =>
                  setPrompts((prev) => [
                    ...prev,
                    { question: PROMPT_QUESTIONS[0], answer: "" },
                  ])
                }
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-sm font-semibold text-muted-foreground active:bg-muted/60"
              >
                <Plus className="size-4" />
                {t("edit.addPrompt")}
              </button>
            )}
          </div>
        </section>

        <div className="pb-4" />
      </div>
    </div>
  );
}

function MusicRow({
  label,
  value,
  onChange,
  onAdd,
  onRemove,
  items,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (v: string) => void;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 p-3.5">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <div className="mt-2 flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder={label}
          className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        <button
          type="button"
          onClick={onAdd}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl vybe-gradient text-white active:scale-95"
          aria-label={`Add ${label}`}
        >
          <Plus className="size-4" />
        </button>
      </div>
      {items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item}
              className="flex items-center gap-1 rounded-full border border-border/70 bg-background/60 py-1 pl-3 pr-1.5 text-xs font-semibold"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(item)}
                className="flex size-5 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
                aria-label={`Remove ${item}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
