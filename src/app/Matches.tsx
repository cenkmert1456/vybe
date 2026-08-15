import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Link, useNavigate } from "react-router";
import { useI18n } from "@/lib/i18n";
import { ImageWithFallback } from "@/components/mobile/ImageWithFallback";
import {
  EmptyState,
  ListSkeleton,
  SectionTitle,
  VerifiedBadge,
} from "@/components/mobile/ui";
import { Button } from "@/components/ui/button";
import { BadgeCheck, CalendarPlus, Heart } from "lucide-react";
import { useMemo } from "react";

type MatchSummary = {
  matchId: string;
  status: string;
  createdAt: number;
  lastMessageAt?: number;
  lastMessagePreview?: string;
  lastMessageSender?: string;
  unreadCount: number;
  other: {
    _id: string;
    firstName: string;
    photos: string[];
    verified: boolean;
    city?: string;
    lastActiveAt: number;
    interests: string[];
    music?: { topArtists: string[]; topTracks: string[]; genres: string[] };
  };
};



const WEEK = 7 * 24 * 60 * 60 * 1000;

export default function Matches() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const matches = useQuery(api.matches.listMatches);

  const { fresh, recent, closed } = useMemo(() => {
    const fresh: MatchSummary[] = [];
    const recent: MatchSummary[] = [];
    const closed: MatchSummary[] = [];
    for (const m of matches ?? []) {
      if (m.status === "unmatched" || m.status === "blocked") {
        closed.push(m);
      } else if (
        Date.now() - m.createdAt < WEEK &&
        m.lastMessageAt === undefined
      ) {
        fresh.push(m);
      } else {
        recent.push(m);
      }
    }
    return { fresh, recent, closed };
  }, [matches]);

  if (matches === undefined) {
    return (
      <div className="flex h-full flex-col">
        <Header />
        <ListSkeleton rows={5} />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <Header />
        <EmptyState
          icon={<Heart className="size-7" />}
          title={t("matches.emptyTitle")}
          hint={t("matches.emptyHint")}
          action={
            <Button
              onClick={() => navigate("/app/discover")}
              className="rounded-full vybe-gradient px-6 font-bold text-white shadow-glow"
            >
              {t("matches.goDiscover")}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6">
        {fresh.length > 0 && (
          <section className="mt-2">
            <SectionTitle className="mb-2.5">{t("matches.new")}</SectionTitle>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {fresh.map((m) => (
                <Link
                  key={m.matchId}
                  to={`/app/chat/${m.matchId}`}
                  className="flex w-24 shrink-0 flex-col items-center gap-1.5"
                >
                  <div className="relative">
                    <div className="size-[72px] overflow-hidden rounded-full p-[3px] vybe-gradient">
                      <div className="h-full w-full overflow-hidden rounded-full border-2 border-background">
                        <ImageWithFallback
                          src={m.other.photos[0]}
                          name={m.other.firstName}
                          className="h-full w-full"
                        />
                      </div>
                    </div>
                    {m.unreadCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                        {m.unreadCount}
                      </span>
                    )}
                    {m.other.verified && (
                      <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-background">
                        <BadgeCheck
                          className="size-3.5 text-sky-400"
                          strokeWidth={2.6}
                        />
                      </span>
                    )}
                  </div>
                  <span className="max-w-full truncate text-xs font-semibold">
                    {m.other.firstName}
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                    {t("matches.sayHi")}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {recent.length > 0 && (
          <section className="mt-6">
            <SectionTitle className="mb-2">{t("matches.recent")}</SectionTitle>
            <div className="flex flex-col">
              {recent.map((m) => (
                <ConversationRow key={m.matchId} m={m} />
              ))}
            </div>
          </section>
        )}

        {closed.length > 0 && (
          <section className="mt-6">
            <SectionTitle className="mb-2 opacity-60">
              {t("matches.unmatched")}
            </SectionTitle>
            <div className="flex flex-col opacity-70">
              {closed.map((m) => (
                <ConversationRow key={m.matchId} m={m} closed />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Header() {
  const { t } = useI18n();
  return (
    <header className="px-5 pt-safe pb-2 pt-4">
      <h1 className="font-display text-[26px] font-bold leading-none">
        {t("matches.title")}
      </h1>
      <p className="mt-1 text-xs font-medium text-muted-foreground">
        {t("app.tagline")}
      </p>
    </header>
  );
}

export function ConversationRow({
  m,
  closed,
}: {
  m: MatchSummary;
  closed?: boolean;
}) {
  const { t, formatRelativeTime } = useI18n();
  const navigate = useNavigate();
  const myProfile = useQuery(api.profiles.myProfile);
  const mine = m.lastMessageSender === undefined;
  const preview = m.lastMessagePreview
    ? `${mine ? `${t("messages.you")}: ` : ""}${m.lastMessagePreview}`
    : t("matches.sayHi");
  const time = m.lastMessageAt ?? m.createdAt;
  const sharedInterests = myProfile
    ? m.other.interests.filter((i) => myProfile.interests.includes(i))
    : [];

  return (
    <Link
      to={`/app/chat/${m.matchId}`}
      className="flex items-center gap-3 rounded-2xl px-2 py-3 active:bg-muted/60"
    >
      <div className="relative shrink-0">
        <div className="size-14 overflow-hidden rounded-full border border-border/60">
          <ImageWithFallback
            src={m.other.photos[0]}
            name={m.other.firstName}
            className="h-full w-full"
          />
        </div>
        {m.unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {m.unreadCount}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
            <span className="truncate">{m.other.firstName}</span>
            <VerifiedBadge verified={m.other.verified} className="shrink-0" />
          </p>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {formatRelativeTime(time)}
          </span>
        </div>
        <p
          className={
            m.unreadCount > 0
              ? "mt-0.5 truncate text-[13px] font-semibold text-foreground"
              : "mt-0.5 truncate text-[13px] text-muted-foreground"
          }
        >
          {preview}
        </p>
        {closed && (
          <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
            {m.status === "unmatched"
              ? t("matches.unmatched")
              : t("matches.chatClosed")}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-center gap-1">
        {sharedInterests.length > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
            {t("matches.sharedInterests", { count: sharedInterests.length })}
          </span>
        )}
        <button
          type="button"
          aria-label={t("matches.planDate")}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            navigate(`/app/dateplans?match=${m.matchId}`);
          }}
          className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform active:scale-90"
        >
          <CalendarPlus className="size-4" />
        </button>
      </div>
    </Link>
  );
}


