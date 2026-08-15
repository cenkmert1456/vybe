import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useNavigate, useParams } from "react-router";
import { useI18n, type TKey } from "@/lib/i18n";
import { ageFromDateOfBirth, haversineKm } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { REPORT_CATEGORIES } from "@/lib/constants";
import { PhotoCarousel } from "@/components/mobile/PhotoCarousel";
import { ImageWithFallback } from "@/components/mobile/ImageWithFallback";
import { VerifiedBadge, ScreenHeader, SectionTitle } from "@/components/mobile/ui";
import { ConfirmDialog } from "@/components/mobile/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Ban,
  CalendarDays,
  Flag,
  Heart,
  Loader2,
  MessageCircle,
  Mic,
  Music2,
  Pause,
  Play,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export default function ProfileDetail() {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const profile = useQuery(api.profiles.getProfile, {
    profileId: profileId as any,
  });
  const myProfile = useQuery(api.profiles.myProfile);
  const shared = useQuery(api.shared.sharedConnections, {
    profileId: profileId as any,
  });
  const compat = useQuery(api.matchScore.matchScore, {
    profileId: profileId as any,
  });
  const voice = useQuery(api.voiceIntros.profileVoiceIntro, {
    profileId: profileId as any,
  });
  const mood = useQuery(api.moods.moodFor, {
    profileId: profileId as any,
  });
  const matchId = useQuery(api.matches.matchWith, {
    profileId: profileId as any,
  });
  const swipe = useMutation(api.swipes.swipe);
  const blockUser = useMutation(api.reports.blockUser);
  const reportUser = useMutation(api.reports.reportUser);
  const sendMessage = useMutation(api.messages.sendMessage);
  const addPhotoComment = useMutation(api.photoComments.addPhotoComment);
  const deletePhotoComment = useMutation(api.photoComments.deletePhotoComment);
  const reactToPhotoComment = useMutation(
    api.photoComments.reactToPhotoComment,
  );

  const [swiping, setSwiping] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [category, setCategory] = useState<string>(REPORT_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [reporting, setReporting] = useState(false);
  const [playingVoice, setPlayingVoice] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [commentPhoto, setCommentPhoto] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [commentSending, setCommentSending] = useState(false);

  const isMatched = Boolean(matchId);
  const photoComments = useQuery(
    api.photoComments.listPhotoComments,
    isMatched
      ? { profileId: profileId as any, photoIndex: commentPhoto }
      : "skip",
  );

  const toggleVoice = () => {
    if (!voice) return;
    if (playingVoice) {
      audioRef.current?.pause();
      setPlayingVoice(false);
      return;
    }
    const audio = new Audio(voice.url);
    audioRef.current = audio;
    audio.onended = () => setPlayingVoice(false);
    audio.onerror = () => setPlayingVoice(false);
    void audio.play().catch(() => setPlayingVoice(false));
    setPlayingVoice(true);
  };

  const sayHi = async () => {
    if (!matchId || swiping) return;
    setSwiping(true);
    try {
      await sendMessage({ matchId: matchId as any, content: "Hey! 👋" });
      toast.success(t("profile.hiSent"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSwiping(false);
    }
  };

  const sendComment = async () => {
    const text = commentText.trim();
    if (!text || commentSending || !isMatched || !profile) return;
    setCommentSending(true);
    try {
      await addPhotoComment({
        profileId: profile._id as any,
        photoIndex: commentPhoto,
        text,
      });
      setCommentText("");
      toast.success(t("photoComments.sent"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setCommentSending(false);
    }
  };

  const removeComment = async (id: string) => {
    try {
      await deletePhotoComment({ commentId: id as any });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  };

  const toggleReaction = async (id: string, emoji: string) => {
    try {
      await reactToPhotoComment({ commentId: id as any, emoji });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  };

  if (profile === undefined || myProfile === undefined) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="flex h-dvh flex-col bg-background">
        <ScreenHeader title="—" />
        <div className="flex flex-1 items-center justify-center px-8 text-center text-sm text-muted-foreground">
          {t("common.error")}
        </div>
      </div>
    );
  }

  const age = ageFromDateOfBirth(profile.dateOfBirth);
  const sharedInterests = profile.interests.filter((i) =>
    myProfile?.interests.includes(i),
  );
  const distance = (() => {
    if (
      myProfile?.approxLat !== undefined &&
      myProfile.approxLng !== undefined &&
      profile.approxLat !== undefined &&
      profile.approxLng !== undefined
    ) {
      const km = haversineKm(
        myProfile.approxLat,
        myProfile.approxLng,
        profile.approxLat,
        profile.approxLng,
      );
      return t("common.kmAway", { km: Math.round(km) });
    }
    return profile.city ? t("common.inCity", { city: profile.city }) : null;
  })();

  const handleSwipe = async (action: "like" | "pass" | "superLike") => {
    if (swiping) return;
    setSwiping(true);
    haptic(action === "like" ? "medium" : "light");
    try {
      const result = await swipe({
        toProfileId: profile._id as any,
        action,
      });
      if (result.matched && result.matchId) {
        navigate(`/app/match/${result.matchId}`, { replace: true });
      } else {
        navigate(-1);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
      setSwiping(false);
    }
  };

  const handleBlock = async () => {
    try {
      await blockUser({ blockedProfileId: profile._id as any });
      toast(t("profile.blockedToast"));
      navigate(-1);
    } catch {
      toast.error(t("common.error"));
    }
  };

  const handleReport = async () => {
    setReporting(true);
    try {
      await reportUser({
        reportedProfileId: profile._id as any,
        category: category as any,
        description,
      });
      setReportOpen(false);
      setDescription("");
      toast(t("profile.reportedToast"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ScreenHeader
        title=""
        onBack={() => navigate(-1)}
        right={
          <div className="flex gap-1">
            <button
              type="button"
              aria-label={t("profile.report")}
              onClick={() => setReportOpen(true)}
              className="flex size-10 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
            >
              <Flag className="size-5" />
            </button>
            <button
              type="button"
              aria-label={t("profile.block")}
              onClick={() => setBlockOpen(true)}
              className="flex size-10 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
            >
              <Ban className="size-5" />
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto no-scrollbar pb-6">
        {/* Gallery */}
        <PhotoCarousel
          photos={profile.photos}
          name={profile.firstName}
          className="aspect-[4/5] w-full"
        />

        <div className="px-5 pt-4">
          {/* Identity */}
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold">
              {profile.firstName}, {age}
            </h1>
            <VerifiedBadge verified={profile.verified} status={profile.verificationStatus} size="md" />
          </div>
          {distance && (
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {distance}
            </p>
          )}
          {mood?.mood && (
            <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
              ✨ {t("profile.mood", { mood: t(`mood.${mood.mood}`) })}
            </p>
          )}

          {/* Bio */}
          {profile.bio && (
            <div className="mt-5">
              <SectionTitle>{t("profile.about")}</SectionTitle>
              <p className="mt-2 text-[15px] leading-relaxed">{profile.bio}</p>
            </div>
          )}

          {/* Shared interests */}
          {sharedInterests.length > 0 && (
            <div className="mt-5">
              <SectionTitle>{t("profile.shared")}</SectionTitle>
              <div className="mt-2 flex flex-wrap gap-2">
                {sharedInterests.map((i) => (
                  <span
                    key={i}
                    className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary"
                  >
                    {i}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Compatibility score + breakdown */}
          {compat && (
            <div className="mt-5 rounded-3xl border border-primary/25 bg-gradient-to-br from-violet-500/10 via-transparent to-pink-500/10 p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl vybe-gradient font-display text-lg font-bold text-white shadow-glow">
                  {compat.score}%
                </div>
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold leading-tight">
                    {t(`compat.level_${compat.level}` as TKey)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("compat.title")} · {compat.summary}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2.5">
                {compat.breakdown.map((b) => (
                  <div key={b.key} className="flex items-center gap-2.5">
                    <span className="w-20 shrink-0 text-[11px] font-bold text-muted-foreground">
                      {t(`compat.${b.key}` as TKey)}
                    </span>
                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full vybe-gradient"
                        style={{ width: `${b.score}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[11px] font-bold">
                      {b.score}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shared connections (music / lifestyle / city / friends) */}
          {shared && (
            <div className="mt-5 flex flex-col gap-2.5">
              {shared.music.sharedArtists.length > 0 && (
                <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-3.5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-400">
                    <Music2 className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-fuchsia-400">
                      {t("music.yourSharedVibe")}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("music.sharedArtists", { list: shared.music.sharedArtists.slice(0, 3).join(", ") })}
                    </p>
                  </div>
                </div>
              )}
              {shared.sharedLifestyle.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground">
                  {t("shared.lifestyle")}:{" "}
                  <span className="text-foreground">{shared.sharedLifestyle.slice(0, 4).join(", ")}</span>
                </p>
              )}
              {shared.sameCity && (
                <p className="text-xs font-medium text-muted-foreground">
                  {t("shared.city")} · {profile.city}
                </p>
              )}
              {shared.sharedIntentions.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground">
                  {t("shared.intentions")}:{" "}
                  <span className="text-foreground">{shared.sharedIntentions.join(", ")}</span>
                </p>
              )}
            </div>
          )}

          {/* Voice intro (matches only) */}
          {voice && (
            <div className="mt-5">
              <SectionTitle>{t("shared.voice")}</SectionTitle>
              <button
                type="button"
                onClick={toggleVoice}
                className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-3.5 text-left active:bg-muted/60"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full vybe-gradient text-white shadow-glow">
                  {playingVoice ? <Pause className="size-5" /> : <Play className="size-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{t("voice.title")}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("voice.seconds", { n: voice.durationSec })} · {t("shared.voiceHint")}
                  </span>
                </span>
                <Mic className="size-4 text-muted-foreground" />
              </button>
            </div>
          )}

          {/* Interests */}
          {profile.interests.length > 0 && (
            <div className="mt-5">
              <SectionTitle>{t("profile.interests")}</SectionTitle>
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.interests.map((i) => (
                  <span
                    key={i}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium"
                  >
                    {i}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Lifestyle */}
          {profile.lifestyle.length > 0 && (
            <div className="mt-5">
              <SectionTitle>{t("profile.lifestyle")}</SectionTitle>
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.lifestyle.map((i) => (
                  <span
                    key={i}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium"
                  >
                    {i}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Languages */}
          {profile.languages.length > 0 && (
            <div className="mt-5">
              <SectionTitle>{t("profile.languages")}</SectionTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                {profile.languages.join(" · ")}
              </p>
            </div>
          )}

          {/* Prompts */}
          {profile.prompts.length > 0 && (
            <div className="mt-5 space-y-3">
              <SectionTitle>{t("profile.prompts")}</SectionTitle>
              {profile.prompts.map((p, i) => (
                <div key={i} className="rounded-2xl border border-border/70 bg-card/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">
                    {p.question}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed">{p.answer}</p>
                </div>
              ))}
            </div>
          )}

          {/* Photo comments — tied to a specific photo, matches only */}
          <div className="mt-5">
            <SectionTitle>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="size-3.5 text-primary" />
                {t("photoComments.title")}
              </span>
            </SectionTitle>
            {!isMatched ? (
              <p className="mt-2 rounded-2xl border border-border/60 bg-card/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                {t("photoComments.locked")}
              </p>
            ) : (
              <>
                {/* Photo picker */}
                <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
                  {profile.photos.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCommentPhoto(i)}
                      className={cn(
                        "relative size-14 shrink-0 overflow-hidden rounded-xl border-2 transition-all active:scale-95",
                        i === commentPhoto
                          ? "border-primary"
                          : "border-transparent opacity-60",
                      )}
                    >
                      <ImageWithFallback
                        src={p}
                        name={profile.firstName}
                        className="h-full w-full"
                      />
                      <span className="absolute bottom-0 right-0 rounded-tl-md bg-black/60 px-1 text-[9px] font-bold text-white">
                        {i + 1}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Comments for the selected photo */}
                <div className="mt-3 flex flex-col gap-2">
                  {photoComments === undefined ? (
                    <div className="h-16 animate-pulse rounded-2xl bg-muted" />
                  ) : photoComments.length === 0 ? (
                    <p className="px-1 text-xs leading-relaxed text-muted-foreground">
                      {t("photoComments.empty")}
                    </p>
                  ) : (
                    photoComments.map((c) => (
                      <div
                        key={c._id}
                        className="flex items-start gap-2.5 rounded-2xl border border-border/60 bg-card/50 p-3"
                      >
                        <div className="size-8 shrink-0 overflow-hidden rounded-full">
                          <ImageWithFallback
                            src={c.commenter.photos[0]}
                            name={c.commenter.firstName}
                            className="h-full w-full"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold">{c.commenter.firstName}</p>
                          <p className="mt-0.5 text-[13px] leading-snug">{c.text}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            {["❤️", "😂", "🔥", "👍", "🥰"].map((emoji) => {
                              const r = c.reactions.find((x) => x.emoji === emoji);
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => void toggleReaction(c._id, emoji)}
                                  className={cn(
                                    "flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors active:scale-90",
                                    r?.mine
                                      ? "border-primary/50 bg-primary/10"
                                      : "border-border/60 bg-background/40",
                                  )}
                                >
                                  <span>{emoji}</span>
                                  {r ? <span className="font-bold">{r.count}</span> : null}
                                </button>
                              );
                            })}
                            {c.mine && (
                              <button
                                type="button"
                                onClick={() => void removeComment(c._id)}
                                className="ml-auto text-[10px] font-semibold text-muted-foreground"
                              >
                                {t("photoComments.delete")}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Comment input */}
                <div className="mt-3 flex items-end gap-2">
                  <Textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={t("photoComments.placeholder")}
                    className="min-h-10 flex-1 resize-none rounded-2xl border-border bg-card px-3.5 py-2.5 text-sm"
                    maxLength={300}
                  />
                  <Button
                    onClick={() => void sendComment()}
                    disabled={commentSending || !commentText.trim()}
                    className="h-10 shrink-0 rounded-full vybe-gradient px-4 text-sm font-bold text-white shadow-glow"
                  >
                    {commentSending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      t("photoComments.send")
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action bar — matched users chat + plan dates instead of swiping */}
      <div className="border-t border-border/60 bg-background/90 px-5 pb-safe pt-3 backdrop-blur">
        {isMatched ? (
          <div className="flex gap-2.5">
            <Button
              onClick={sayHi}
              disabled={swiping}
              className="h-12 flex-1 rounded-full vybe-gradient text-sm font-bold text-white shadow-glow"
            >
              <MessageCircle className="size-4" />
              {t("matches.sayHi")}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/app/dateplans?match=${matchId}`)}
              className="h-12 flex-1 rounded-full border-border bg-card text-sm font-semibold"
            >
              <CalendarDays className="size-4" />
              {t("chat.planDate")}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label={t("discover.pass")}
              disabled={swiping}
              onClick={() => void handleSwipe("pass")}
              className="flex size-14 items-center justify-center rounded-full border-2 border-red-500/40 bg-card text-red-400 transition-all active:scale-90 disabled:opacity-50"
            >
              <X className="size-6" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              aria-label={t("discover.superVybe")}
              disabled={swiping}
              onClick={() => void handleSwipe("superLike")}
              className="flex size-14 items-center justify-center rounded-full vybe-gradient text-white shadow-glow transition-all active:scale-90 disabled:opacity-50"
            >
              <span className="text-xl">⚡</span>
            </button>
            <button
              type="button"
              aria-label={t("discover.like")}
              disabled={swiping}
              onClick={() => void handleSwipe("like")}
              className="flex size-14 items-center justify-center rounded-full border-2 border-emerald-500/40 bg-card text-emerald-400 transition-all active:scale-90 disabled:opacity-50"
            >
              <Heart className="size-6" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>

      {/* Block confirm */}
      <ConfirmDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title={t("profile.blockTitle", { name: profile.firstName })}
        description={t("profile.blockDesc")}
        confirmLabel={t("profile.block")}
        onConfirm={handleBlock}
      />

      {/* Report dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("profile.reportTitle", { name: profile.firstName })}
            </DialogTitle>
            <DialogDescription>{t("profile.reportDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            {REPORT_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "flex min-h-11 items-center rounded-xl border px-3.5 text-left text-sm font-medium transition-colors",
                  category === c
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {t(`safety.cat_${c}` as any)}
              </button>
            ))}
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("profile.reportPlaceholder")}
              className="mt-2 min-h-20 rounded-xl border-border bg-card text-sm"
              maxLength={2000}
            />
            <Button
              onClick={() => void handleReport()}
              disabled={reporting}
              className="mt-2 h-12 rounded-full bg-destructive text-white"
            >
              {reporting ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("profile.reportSubmit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
