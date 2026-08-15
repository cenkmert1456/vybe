import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { useNavigate, useParams } from "react-router";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { CHAT_EMOJI, MESSAGE_REACTIONS, REPORT_CATEGORIES } from "@/lib/constants";
import { ImageWithFallback } from "@/components/mobile/ImageWithFallback";
import { ConfirmDialog } from "@/components/mobile/ConfirmDialog";
import { VerifiedBadge } from "@/components/mobile/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Ban,
  CalendarPlus,
  ChevronLeft,
  ChevronUp,
  CornerUpLeft,
  Flag,
  ImagePlus,
  Loader2,
  MoreVertical,
  SendHorizontal,
  Smile,
  UserX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/format";

type Msg = {
  _id: string;
  matchId: string;
  senderProfileId: string;
  type: "text" | "image";
  content: string;
  createdAt: number;
  deliveredAt?: number;
  readAt?: number;
  replyTo?: string;
  replyPreview?: { sender: string; preview: string } | null;
  reactions?: { emoji: string; count: number; mine: boolean }[];
};

export default function Chat() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { t, formatClockTime, formatFullDate } = useI18n();

  const [queryCursor, setQueryCursor] = useState<number | null | undefined>(undefined);

  const data = useQuery(api.matches.getMatch, { matchId: matchId as any });
  const myProfile = useQuery(api.profiles.myProfile);
  const page = useQuery(api.messages.listMessages, {
    matchId: matchId as any,
    cursor: queryCursor as any,
  });
  const sendMessage = useMutation(api.messages.sendMessage);
  const sendImageMessage = useMutation(api.messages.sendImageMessage);
  const reactToMessage = useMutation(api.messages.reactToMessage);
  const simulateReply = useMutation(api.messages.simulateReply);
  const markRead = useMutation(api.messages.markRead);
  const unmatch = useMutation(api.matches.unmatch);
  const blockUser = useMutation(api.reports.blockUser);
  const reportUser = useMutation(api.reports.reportUser);
  const generateUploadUrl = useAction(api.upload.generateUploadUrl);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [lastCursor, setLastCursor] = useState<number | null | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingImage, setSendingImage] = useState(false);
  const [typing, setTyping] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [unmatchOpen, setUnmatchOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCat, setReportCat] = useState<string>(REPORT_CATEGORIES[0]);
  const [reportDesc, setReportDesc] = useState("");
  const [reporting, setReporting] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Msg | null>(null);
  const [reactTarget, setReactTarget] = useState<Msg | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSimRef = useRef<number | null>(null);

  const other = data?.other ?? null;
  const match = data?.match ?? null;
  const closed = !!match && match.status !== "active";
  const sharedInterests = useMemo(() => {
    if (!other || !myProfile) return [];
    return (other.interests ?? []).filter((i: string) => myProfile.interests.includes(i));
  }, [other, myProfile]);

  // Merge paginated pages into the local list (dedupe + ascending order).
  useEffect(() => {
    if (!page) return;
    setMessages((prev) => {
      const seen = new Set<string>();
      const merged = [...prev, ...(page.messages as Msg[])].filter((m) => {
        if (seen.has(m._id)) return false;
        seen.add(m._id);
        return true;
      });
      return merged.sort((a, b) => a.createdAt - b.createdAt);
    });
    setLastCursor(page.cursor);
    setHasMore(page.hasMore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Mark messages as read when they arrive while the chat is open.
  useEffect(() => {
    if (!messages.length || !other) return;
    const hasUnread = messages.some(
      (m) => m.senderProfileId !== myProfile?._id && m.readAt === undefined,
    );
    if (hasUnread) {
      const timer = setTimeout(() => {
        void markRead({ matchId: matchId as any });
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [messages, other, markRead, matchId, myProfile?._id]);

  // Keep the newest messages visible.
  useEffect(() => {
    if (!messages.length) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, typing]);

  // Keyboard inset (iOS Safari visual viewport).
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const diff = window.innerHeight - vv.height;
      setKeyboardInset(diff > 120 ? diff : 0);
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    return () => {
      if (pendingSimRef.current) window.clearTimeout(pendingSimRef.current);
    };
  }, []);

  const grouped = useMemo(() => {
    const out: { label: string; items: Msg[] }[] = [];
    let currentLabel = "";
    for (const m of messages) {
      const label = formatFullDate(m.createdAt);
      if (label !== currentLabel) {
        currentLabel = label;
        out.push({ label, items: [] });
      }
      out[out.length - 1].items.push(m);
    }
    return out;
  }, [messages, formatFullDate]);

  if (!data || !myProfile) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!other || !match) {
    return (
      <div className="flex h-dvh flex-col bg-background">
        <ChatHeader title="…" onBack={() => navigate(-1)} />
        <div className="flex flex-1 items-center justify-center px-8 text-center text-sm text-muted-foreground">
          {t("common.error")}
        </div>
      </div>
    );
  }

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || closed) return;
    setSending(true);
    setText("");
    setShowEmoji(false);
    const replyId = replyTarget?._id;
    setReplyTarget(null);
    try {
      await sendMessage({
        matchId: matchId as any,
        content: trimmed,
        ...(replyId ? { replyTo: replyId as any } : {}),
      });
      setQueryCursor(undefined); // jump back to the newest page
      haptic("light");
      // Demo profiles "type" and reply shortly after.
      if (other.isDemo && !pendingSimRef.current) {
        setTyping(true);
        const delay = 1400 + Math.random() * 1200;
        pendingSimRef.current = window.setTimeout(() => {
          void simulateReply({ matchId: matchId as any }).finally(() => {
            setTyping(false);
            pendingSimRef.current = null;
          });
        }, delay);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSending(false);
    }
  };

  const sendImage = async (file: File) => {
    if (closed || sendingImage) return;
    setSendingImage(true);
    try {
      const blob = await compressImage(file, 1400, 0.78);
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": blob.type },
        body: blob,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: string };
      await sendImageMessage({ matchId: matchId as any, storageId: storageId as any });
      setQueryCursor(undefined);
      if (other.isDemo) {
        setTyping(true);
        const delay = 1600 + Math.random() * 1400;
        pendingSimRef.current = window.setTimeout(() => {
          void simulateReply({ matchId: matchId as any }).finally(() => {
            setTyping(false);
            pendingSimRef.current = null;
          });
        }, delay);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSendingImage(false);
    }
  };

  const handleUnmatch = async () => {
    await unmatch({ matchId: matchId as any });
    navigate(-1);
  };
  const handleBlock = async () => {
    await blockUser({ blockedProfileId: other._id as any });
    toast(t("profile.blockedToast"));
    navigate(-1);
  };
  const handleReact = async (emoji: string) => {
    if (!reactTarget) return;
    try {
      await reactToMessage({
        matchId: matchId as any,
        messageId: reactTarget._id as any,
        emoji,
      });
      setReactTarget(null);
      haptic("light");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  };

  const handleReport = async () => {
    setReporting(true);
    try {
      await reportUser({
        reportedProfileId: other._id as any,
        category: reportCat as any,
        description: reportDesc,
      });
      setReportOpen(false);
      setReportDesc("");
      toast(t("profile.reportedToast"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header */}
      <header className="glass z-30 flex items-center gap-2 border-b border-border/60 px-3 pt-safe pb-2">
        <button
          type="button"
          aria-label={t("common.back")}
          onClick={() => navigate(-1)}
          className="flex size-10 shrink-0 items-center justify-center rounded-full active:bg-muted"
        >
          <ChevronLeft className="size-6" />
        </button>
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/app/profile/${other._id}`)}
          onKeyDown={(e) => {
            if (e.key === "Enter") navigate(`/app/profile/${other._id}`);
          }}
          className="flex min-w-0 flex-1 items-center gap-2.5"
        >
          <div className="size-10 shrink-0 overflow-hidden rounded-full">
            <ImageWithFallback
              src={other.photos[0]}
              name={other.firstName}
              className="h-full w-full"
            />
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[15px] font-bold">
              <span className="truncate">{other.firstName}</span>
              <VerifiedBadge
                verified={other.verified}
                status={other.verificationStatus}
                className="shrink-0"
              />
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {typing
                ? `${other.firstName} ${t("messages.typing")}`
                : t("common.online")}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Chat options"
              className="flex size-10 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
            >
              <MoreVertical className="size-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-2xl">
            {!closed && (
              <DropdownMenuItem onClick={() => navigate(`/app/dateplans?match=${matchId}`)}>
                <CalendarPlus className="size-4" /> {t("chat.planDate")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setReportOpen(true)}>
              <Flag className="size-4" /> {t("messages.report")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setBlockOpen(true)}>
              <Ban className="size-4" /> {t("messages.block")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setUnmatchOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <UserX className="size-4" /> {t("messages.unmatch")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Shared vibe strip */}
      {sharedInterests.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-border/50 bg-primary/5 px-4 py-2">
          <span className="shrink-0 text-[11px] font-bold text-primary">
            {t("chat.sharedVibeTitle")}
          </span>
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
            {t("matches.sharedInterests", { count: sharedInterests.length })}
          </span>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto no-scrollbar px-4 pb-3"
      >
        {hasMore && lastCursor && (
          <div className="flex justify-center py-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs font-semibold text-muted-foreground"
              onClick={() => setQueryCursor(lastCursor)}
            >
              <ChevronUp className="size-3.5" />
              {t("messages.loadEarlier")}
            </Button>
          </div>
        )}

        {grouped.map((group) => (
          <div key={group.label}>
            <div className="my-3 flex justify-center">
              <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-semibold text-muted-foreground">
                {group.label}
              </span>
            </div>
            {group.items.map((m) => {
              const mine = m.senderProfileId === myProfile._id;
              return (
                <MessageBubble
                  key={m._id}
                  msg={m}
                  mine={mine}
                  isDemo={other.isDemo}
                  clock={formatClockTime}
                  onReply={() => setReplyTarget(m)}
                  onReact={() => setReactTarget(m)}
                />
              );
            })}
          </div>
        ))}

        {typing && (
          <div className="mb-1 flex items-end gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
              <ImageWithFallback
                src={other.photos[0]}
                name={other.firstName}
                className="h-full w-full"
              />
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-card px-4 py-3">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1.1, delay: i * 0.18 }}
                  className="size-1.5 rounded-full bg-muted-foreground"
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Closed banner */}
      {closed && (
        <div className="border-t border-border/60 bg-muted/40 px-4 py-3 text-center text-xs font-medium text-muted-foreground">
          {t("messages.closed")}
        </div>
      )}

      {/* Reply preview bar */}
      <AnimatePresence>
        {replyTarget && !closed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 border-t border-border/60 bg-card/80 px-4 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-primary">
                  {t("chat.replyTo", { name: other.firstName })}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {replyTarget.type === "image"
                    ? t("messages.photo")
                    : replyTarget.content}
                </p>
              </div>
              <button
                type="button"
                aria-label={t("chat.cancelReply")}
                onClick={() => setReplyTarget(null)}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div
        className="border-t border-border/60 bg-background/95 px-3 pt-2 backdrop-blur"
        style={{ paddingBottom: keyboardInset || undefined }}
      >
        <AnimatePresence>
          {showEmoji && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-10 gap-1 pb-2">
                {CHAT_EMOJI.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setText((s) => s + e)}
                    className="flex h-9 items-center justify-center rounded-lg text-lg active:bg-muted"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-2 pb-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void sendImage(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            aria-label={t("messages.attach")}
            disabled={closed || sendingImage}
            onClick={() => fileRef.current?.click()}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted disabled:opacity-40"
          >
            {sendingImage ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <ImagePlus className="size-5" />
            )}
          </button>
          <button
            type="button"
            aria-label="Emoji"
            disabled={closed}
            onClick={() => setShowEmoji((s) => !s)}
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full active:bg-muted disabled:opacity-40",
              showEmoji ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Smile className="size-5" />
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={closed}
            placeholder={t("messages.placeholder")}
            enterKeyHint="send"
            aria-label={t("messages.placeholder")}
            className="h-11 min-w-0 flex-1 rounded-full border border-input bg-card px-4 text-[15px] outline-none placeholder:text-muted-foreground focus:border-primary disabled:opacity-50"
          />
          <button
            type="button"
            aria-label={t("messages.send")}
            disabled={!text.trim() || sending || closed}
            onClick={() => void send()}
            className="flex size-11 shrink-0 items-center justify-center rounded-full vybe-gradient text-white shadow-glow transition-all active:scale-90 disabled:opacity-40"
          >
            {sending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <SendHorizontal className="size-5" />
            )}
          </button>
        </div>
        <div className="pb-safe" />
      </div>

      {/* Reaction picker */}
      <Dialog open={!!reactTarget} onOpenChange={(o) => !o && setReactTarget(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center">{t("messages.reactions")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-6 gap-2 pb-1">
            {MESSAGE_REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => void handleReact(e)}
                className="flex h-12 items-center justify-center rounded-xl border border-border/60 bg-card text-2xl transition-transform active:scale-90"
              >
                {e}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialogs */}
      <ConfirmDialog
        open={unmatchOpen}
        onOpenChange={setUnmatchOpen}
        title={t("messages.unmatchTitle", { name: other.firstName })}
        description={t("messages.unmatchDesc")}
        confirmLabel={t("messages.unmatch")}
        onConfirm={handleUnmatch}
      />
      <ConfirmDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title={t("profile.blockTitle", { name: other.firstName })}
        description={t("profile.blockDesc")}
        confirmLabel={t("messages.block")}
        onConfirm={handleBlock}
      />
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("profile.reportTitle", { name: other.firstName })}
            </DialogTitle>
            <DialogDescription>{t("profile.reportDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            {REPORT_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setReportCat(c)}
                className={cn(
                  "flex min-h-11 items-center rounded-xl border px-3.5 text-left text-sm font-medium",
                  reportCat === c
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {t(`safety.cat_${c}` as any)}
              </button>
            ))}
            <textarea
              value={reportDesc}
              onChange={(e) => setReportDesc(e.target.value)}
              placeholder={t("profile.reportPlaceholder")}
              maxLength={2000}
              className="mt-2 min-h-20 resize-none rounded-xl border border-input bg-card p-3 text-sm outline-none focus:border-primary"
            />
            <Button
              onClick={() => void handleReport()}
              disabled={reporting}
              className="mt-2 h-12 rounded-full bg-destructive text-white"
            >
              {reporting && <Loader2 className="size-4 animate-spin" />}
              {t("profile.reportSubmit")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessageBubble({
  msg,
  mine,
  isDemo,
  clock,
  onReply,
  onReact,
}: {
  msg: Msg;
  mine: boolean;
  isDemo: boolean;
  clock: (ms: number) => string;
  onReply: () => void;
  onReact: () => void;
}) {
  const { t } = useI18n();
  const [actionsOpen, setActionsOpen] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const [pressed, setPressed] = useState(false);

  const startPress = () => {
    setPressed(true);
    pressTimer.current = window.setTimeout(() => {
      setActionsOpen(true);
      setPressed(false);
      haptic("light");
    }, 380);
  };
  const cancelPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
    setPressed(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("mb-1.5 flex w-full", mine ? "justify-end" : "justify-start")}
    >
      <div
        className={cn("max-w-[78%]", mine ? "items-end" : "items-start")}
        onPointerDown={startPress}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
        onContextMenu={(e) => {
          e.preventDefault();
          setActionsOpen(true);
        }}
      >
        {msg.replyPreview && (
          <div
            className={cn(
              "mb-1 max-w-full rounded-xl border-l-2 border-primary/70 bg-black/10 px-2.5 py-1.5",
              mine ? "mr-2" : "ml-2",
            )}
          >
            <p className="text-[10px] font-bold text-primary">
              {msg.replyPreview.sender}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {msg.replyPreview.preview}
            </p>
          </div>
        )}
        {msg.type === "image" ? (
          <div
            className={cn(
              "overflow-hidden rounded-2xl border border-border/50",
              mine ? "rounded-br-sm" : "rounded-bl-sm",
              pressed && "opacity-70",
            )}
          >
            <img
              src={msg.content}
              alt={t("messages.photo")}
              loading="lazy"
              className="max-h-56 w-full max-w-56 object-cover"
            />
          </div>
        ) : (
          <div
            className={cn(
              "rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed",
              mine
                ? "rounded-br-sm bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white"
                : "rounded-bl-sm bg-card text-foreground border border-border/50",
              pressed && "opacity-70",
            )}
          >
            {msg.content}
          </div>
        )}
        {msg.reactions && msg.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1 px-1">
            {msg.reactions.map((r) => (
              <span
                key={r.emoji}
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs",
                  r.mine
                    ? "border-primary/60 bg-primary/15 text-foreground"
                    : "border-border/60 bg-card text-muted-foreground",
                )}
              >
                {r.emoji}
                <span className="text-[10px] font-semibold">{r.count}</span>
              </span>
            ))}
          </div>
        )}
        <div
          className={cn(
            "mt-0.5 flex items-center gap-1 px-1 text-[10px] text-muted-foreground",
            mine ? "justify-end" : "justify-start",
          )}
        >
          {clock(msg.createdAt)}
          {mine && (
            <span>
              {msg.readAt ? (
                <span className="font-semibold text-sky-400">✓✓ {t("messages.read")}</span>
              ) : msg.deliveredAt ? (
                <span>✓✓ {t("messages.delivered")}</span>
              ) : (
                <span>✓</span>
              )}
            </span>
          )}
          {!mine && isDemo && msg.readAt && (
            <span className="text-[10px]">{t("messages.read")}</span>
          )}
        </div>
      </div>

      {/* Long-press actions */}
      <Dialog open={actionsOpen} onOpenChange={setActionsOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center text-base">
              {t("messages.reactions")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-6 gap-2 pb-2">
              {MESSAGE_REACTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    setActionsOpen(false);
                    onReact();
                  }}
                  className="flex h-12 items-center justify-center rounded-xl border border-border/60 bg-card text-2xl transition-transform active:scale-90"
                >
                  {e}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              className="h-11 rounded-full"
              onClick={() => {
                setActionsOpen(false);
                onReply();
              }}
            >
              <CornerUpLeft className="size-4" />
              {t("chat.reply")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function ChatHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <header className="flex items-center gap-2 px-3 pt-safe pb-2">
      <button
        type="button"
        aria-label="Back"
        onClick={onBack}
        className="flex size-10 items-center justify-center rounded-full active:bg-muted"
      >
        <X className="size-5" />
      </button>
      <p className="text-base font-bold">{title}</p>
    </header>
  );
}
