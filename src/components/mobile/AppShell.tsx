import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import {
  Compass,
  Heart,
  MessageCircle,
  Bell,
  UserRound,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router";
import { cn } from "@/lib/utils";
import { useI18n, type TKey } from "@/lib/i18n";

const TABS: {
  to: string;
  key: TKey;
  icon: typeof Compass;
  badge?: "messages" | "activity";
}[] = [
  { to: "/app/discover", key: "nav.discover", icon: Compass },
  { to: "/app/matches", key: "nav.matches", icon: Heart },
  { to: "/app/messages", key: "nav.messages", icon: MessageCircle, badge: "messages" },
  { to: "/app/activity", key: "nav.activity", icon: Bell, badge: "activity" },
  { to: "/app/profile", key: "nav.profile", icon: UserRound },
];

function TabBar() {
  const { t } = useI18n();
  const location = useLocation();
  const unread = useQuery(api.matches.totalUnread) ?? 0;
  const activityUnread = useQuery(api.activity.unreadActivityCount) ?? 0;

  const activePath = TABS.find((tab) => location.pathname.startsWith(tab.to))?.to ?? "/app/discover";

  return (
    <nav
      aria-label="Main navigation"
      className="glass z-40 border-t border-border/70 pb-safe"
    >
      <div className="grid grid-cols-5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activePath === tab.to;
          const badgeCount = tab.badge === "messages" ? unread : activityUnread;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              aria-label={t(tab.key)}
              aria-current={active ? "page" : undefined}
              className="relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-1.5"
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className="absolute top-0 h-0.5 w-8 rounded-full vybe-gradient"
                />
              )}
              <span className="relative">
                <Icon
                  className={cn(
                    "size-[22px] transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                  strokeWidth={active ? 2.4 : 2}
                />
                {badgeCount > 0 && (
                  <span className="absolute -right-1.5 -top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-white">
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[10px] font-semibold transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {t(tab.key)}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell() {
  const location = useLocation();
  return (
    <div className="min-h-dvh w-full bg-background">
      {/* Desktop backdrop so the phone frame reads as an app */}
      <div className="hidden min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklab,var(--vybe-violet)_14%,transparent),transparent_60%),radial-gradient(ellipse_at_bottom_left,color-mix(in_oklab,var(--vybe-pink)_12%,transparent),transparent_60%)] lg:flex">
        <div className="h-dvh max-h-[920px] w-full max-w-[430px] overflow-hidden rounded-[2.5rem] border border-border/80 bg-background shadow-[0_0_80px_-20px_color-mix(in_oklab,var(--vybe-violet)_45%,transparent)]">
          <div className="relative flex h-full flex-col overflow-hidden">
            <main className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
              <Outlet key={location.pathname} />
            </main>
            <TabBar />
          </div>
        </div>
      </div>
      {/* Native full-bleed layout on phones */}
      <div className="h-dvh w-full lg:hidden">
        <div className="relative flex h-full flex-col overflow-hidden">
          <main className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
            <Outlet key={location.pathname} />
          </main>
          <TabBar />
        </div>
      </div>
    </div>
  );
}
