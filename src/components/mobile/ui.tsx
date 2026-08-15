import { motion } from "framer-motion";
import { BadgeCheck, ChevronLeft, ShieldCheck, Clock3 } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  transparent = false,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  transparent?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center gap-2 px-4 pt-safe pb-2",
        transparent ? "bg-transparent" : "glass border-b border-border/60",
      )}
    >
      <button
        type="button"
        aria-label="Back"
        onClick={onBack ?? (() => navigate(-1))}
        className="-ml-1 flex size-10 shrink-0 items-center justify-center rounded-full text-foreground active:bg-muted"
      >
        <ChevronLeft className="size-6" />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-lg font-bold leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {right}
    </header>
  );
}

export function VerifiedBadge({
  verified,
  status = "verified",
  size = "sm",
  className,
}: {
  verified: boolean;
  status?: "none" | "in_progress" | "verified" | "failed";
  size?: "sm" | "md";
  className?: string;
}) {
  const dim = size === "sm" ? "size-4" : "size-5";
  if (verified) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-sky-400",
          className,
        )}
        title="Verified"
      >
        <BadgeCheck className={dim} strokeWidth={2.4} />
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-amber-400",
          className,
        )}
        title="Verification pending"
      >
        <Clock3 className={dim} strokeWidth={2.4} />
      </span>
    );
  }
  return null;
}

export function ShieldHint({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
      <p>{text}</p>
    </div>
  );
}

export function Chip({
  selected,
  onClick,
  children,
  className,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-full border px-3.5 py-2 text-sm font-medium transition-all active:scale-95",
        selected
          ? "border-transparent bg-primary text-primary-foreground shadow-glow"
          : "border-border bg-card text-foreground hover:border-primary/40",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SectionTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-8 py-16 text-center",
        className,
      )}
    >
      {icon && (
        <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/15 to-pink-500/15 text-primary">
          {icon}
        </div>
      )}
      <h3 className="font-display text-lg font-bold">{title}</h3>
      {hint && <p className="max-w-xs text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}

export function ErrorState({
  onRetry,
  hint,
}: {
  onRetry?: () => void;
  hint?: string;
}) {
  const { t } = useI18n();
  return (
    <EmptyState
      icon={<span className="text-2xl">📡</span>}
      title={t("common.error")}
      hint={hint ?? t("state.errorDesc")}
      action={
        onRetry && (
          <Button onClick={onRetry} variant="outline">
            {t("common.retry")}
          </Button>
        )
      }
    />
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Skeleton className="aspect-[3/4] w-full rounded-3xl" />
      <div className="space-y-2 px-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 px-4 pt-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DotPagination({
  count,
  active,
  className,
}: {
  count: number;
  active: number;
  className?: string;
}) {
  if (count <= 1) return null;
  return (
    <div className={cn("flex items-center gap-1.5", className)} aria-hidden="true">
      {Array.from({ length: Math.min(count, 6) }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i === active ? "w-4 bg-white/90" : "w-1.5 bg-white/40",
          )}
        />
      ))}
    </div>
  );
}
