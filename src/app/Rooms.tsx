import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { ScreenHeader } from "@/components/mobile/ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ChevronRight,
  Loader2,
  Plus,
  Send,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type RoomCategory =
  | "music"
  | "gaming"
  | "travel"
  | "movies"
  | "coffee"
  | "fitness"
  | "books"
  | "local";

const CATEGORIES: (RoomCategory | "all")[] = [
  "all",
  "music",
  "gaming",
  "travel",
  "movies",
  "coffee",
  "fitness",
  "books",
  "local",
];

const CATEGORY_EMOJI: Record<string, string> = {
  all: "✨",
  music: "🎵",
  gaming: "🎮",
  travel: "✈️",
  movies: "🎬",
  coffee: "☕",
  fitness: "🏋️",
  books: "📚",
  local: "📍",
};

type Room = {
  _id: string;
  name: string;
  category: RoomCategory;
  description: string;
  memberCount: number;
  joined: boolean;
};

type Msg = {
  _id: string;
  content?: string;
  deleted?: boolean;
  createdAt: number;
  profile?: { _id: string; firstName: string; photos: string[] } | null;
};

export default function Rooms() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [category, setCategory] = useState<RoomCategory | "all">("all");
  const rooms = useQuery(api.rooms.listRooms, {
    category: category === "all" ? undefined : category,
  }) as Room[] | undefined;

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [createCat, setCreateCat] = useState<RoomCategory>("coffee");
  const createRoom = useMutation(api.rooms.createRoom);

  const submitCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const res = await createRoom({
        name: name.trim(),
        category: createCat,
        description: desc.trim(),
      });
      haptic("success");
      toast.success(t("rooms.created"));
      setCreating(false);
      setName("");
      setDesc("");
      navigate(`/app/rooms/${res._id}`);
    } catch (e) {
      setCreating(false);
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ScreenHeader title={t("rooms.title")} onBack={() => navigate(-1)} />
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-4">
        <p className="mt-4 text-sm text-muted-foreground">{t("rooms.subtitle")}</p>

        {/* Category chips */}
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all active:scale-95",
                category === c
                  ? "border-transparent vybe-gradient text-white shadow-glow"
                  : "border-border bg-card text-foreground",
              )}
            >
              <span>{CATEGORY_EMOJI[c]}</span>
              {c === "all" ? t("rooms.all") : t(`rooms.category.${c}`)}
            </button>
          ))}
        </div>

        {/* Create room */}
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="mt-4 flex w-full items-center gap-2.5 rounded-2xl border border-dashed border-border bg-card/40 px-4 py-3.5 text-sm font-semibold text-muted-foreground active:scale-[0.99]"
        >
          <Plus className="size-4" />
          {t("rooms.create")}
        </button>
        <AnimatePresence>
          {creating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2.5 rounded-2xl border border-border/70 bg-card/60 p-4">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("rooms.createName")}
                  className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                />
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder={t("rooms.createDesc")}
                  rows={2}
                  className="mt-2 w-full rounded-xl border border-input bg-card p-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CATEGORIES.filter((c) => c !== "all").map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCreateCat(c as RoomCategory)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-semibold",
                        createCat === c
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {t(`rooms.category.${c}`)}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={() => void submitCreate()}
                  disabled={creating || !name.trim()}
                  className="mt-3 h-11 w-full rounded-full vybe-gradient text-sm font-bold text-white shadow-glow"
                >
                  {creating ? <Loader2 className="size-4 animate-spin" /> : t("rooms.create")}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Room list */}
        <div className="mt-5 flex flex-col gap-2.5 pb-6">
          {!rooms ? (
            <Loader2 className="mx-auto mt-6 size-5 animate-spin text-primary" />
          ) : rooms.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("rooms.empty")}
            </p>
          ) : (
            rooms.map((r) => (
              <button
                key={r._id}
                type="button"
                onClick={() => navigate(`/app/rooms/${r._id}`)}
                className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-4 text-left transition-all active:scale-[0.99]"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg">
                  {CATEGORY_EMOJI[r.category]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{r.name}</p>
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">
                    {r.description}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                    <Users className="size-3" />
                    {t("rooms.members", { count: r.memberCount })}
                    {r.joined && (
                      <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                        ✓
                      </span>
                    )}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Room detail (chat)
// ---------------------------------------------------------------------------

export function RoomDetail({ roomId }: { roomId: string }) {
  const { t, formatClockTime } = useI18n();
  const navigate = useNavigate();
  const detail = useQuery(api.rooms.roomDetail, { roomId: roomId as any });
  const msgs = useQuery(api.rooms.roomMessages, { roomId: roomId as any }) as
    | Msg[]
    | undefined;
  const join = useMutation(api.rooms.joinRoom);
  const leave = useMutation(api.rooms.leaveRoom);
  const send = useMutation(api.rooms.sendRoomMessage);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs?.length]);

  const sendMsg = async () => {
    const clean = text.trim();
    if (!clean || sending || !detail?.joined) return;
    setSending(true);
    try {
      await send({ roomId: roomId as any, content: clean });
      setText("");
      haptic("light");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ScreenHeader
        title={detail?.name ?? t("rooms.chat")}
        onBack={() => navigate(-1)}
      />
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-4">
        {detail && (
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-border/70 bg-card/60 p-4">
            <div>
              <p className="text-sm font-bold">{detail.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {detail.description}
              </p>
              <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
                <Users className="mr-1 inline size-3" />
                {t("rooms.members", { count: detail.memberCount })}
              </p>
            </div>
            {detail.joined ? (
              <Button
                variant="outline"
                onClick={() => void leave({ roomId: roomId as any }).then(() => navigate(-1))}
                className="h-10 shrink-0 rounded-full text-xs font-semibold"
              >
                {t("rooms.leave")}
              </Button>
            ) : (
              <Button
                onClick={() => void join({ roomId: roomId as any })}
                className="h-10 shrink-0 rounded-full vybe-gradient text-xs font-bold text-white shadow-glow"
              >
                {t("rooms.join")}
              </Button>
            )}
          </div>
        )}

        {detail && !detail.joined ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {t("rooms.membersOnly")}
          </p>
        ) : (
          <div ref={scrollRef} className="no-scrollbar mt-3 flex max-h-[52dvh] flex-col gap-2 overflow-y-auto pb-2">
            {!msgs ? (
              <Loader2 className="mx-auto mt-6 size-5 animate-spin text-primary" />
            ) : msgs.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {t("rooms.emptyMessage")}
              </p>
            ) : (
              msgs.map((m) =>
                m.deleted ? (
                  <div key={m._id} className="self-center rounded-full bg-muted px-3 py-1 text-[10px] text-muted-foreground">
                    · · ·
                  </div>
                ) : (
                  <div
                    key={m._id}
                    className="max-w-[80%] rounded-2xl border border-border/60 bg-card/70 px-3.5 py-2.5"
                  >
                    <p className="text-[10px] font-bold text-primary">
                      {m.profile?.firstName ?? "?"}{" "}
                      <span className="font-normal text-muted-foreground">
                        {formatClockTime(m.createdAt)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed">{m.content}</p>
                  </div>
                ),
              )
            )}
          </div>
        )}
      </div>

      {detail?.joined && (
        <div className="flex items-center gap-2 border-t border-border/60 bg-background/90 px-4 pb-safe pt-3 backdrop-blur">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void sendMsg();
            }}
            placeholder={t("rooms.messagePlaceholder")}
            className="h-12 flex-1 rounded-full border border-input bg-card px-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <Button
            onClick={() => void sendMsg()}
            disabled={!text.trim() || sending}
            className="size-12 shrink-0 rounded-full vybe-gradient text-white shadow-glow disabled:opacity-50"
            aria-label={t("messages.send")}
          >
            {sending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
          </Button>
        </div>
      )}
    </div>
  );
}
