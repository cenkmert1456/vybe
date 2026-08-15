import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Link, useNavigate } from "react-router";
import { useI18n } from "@/lib/i18n";
import { ImageWithFallback } from "@/components/mobile/ImageWithFallback";
import { EmptyState, ListSkeleton } from "@/components/mobile/ui";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

export default function Messages() {
  const { t, formatRelativeTime } = useI18n();
  const navigate = useNavigate();
  const matches = useQuery(api.matches.listMatches);

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
          icon={<MessageCircle className="size-7" />}
          title={t("messages.emptyTitle")}
          hint={t("messages.emptyHint")}
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
        {matches.map((m) => {
          const mine = m.lastMessageSender === undefined;
          const preview = m.lastMessagePreview
            ? `${mine ? `${t("messages.you")}: ` : ""}${m.lastMessagePreview}`
            : t("matches.sayHi");
          const closed = m.status !== "active";
          return (
            <Link
              key={m.matchId}
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
                  <p className="truncate text-[15px] font-semibold">
                    {m.other.firstName}
                  </p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {m.lastMessageAt
                      ? formatRelativeTime(m.lastMessageAt)
                      : formatRelativeTime(m.createdAt)}
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Header() {
  const { t } = useI18n();
  return (
    <header className="px-5 pt-safe pb-2 pt-4">
      <h1 className="font-display text-[26px] font-bold leading-none">
        {t("messages.title")}
      </h1>
      <p className="mt-1 text-xs font-medium text-muted-foreground">
        {t("app.tagline")}
      </p>
    </header>
  );
}
