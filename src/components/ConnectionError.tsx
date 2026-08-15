import { LogoMark } from "@/components/Logo";

/**
 * Branded connection error screen. Shown when the VYBE backend can't be
 * reached (offline device, backend down, or a missing Convex URL at build
 * time). Never redirects to localhost and never shows a browser error page.
 */
export function ConnectionError({
  title = "Couldn't connect right now",
  message = "Check your connection and try again. Your profile and matches are safe.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center bg-background px-8 text-center">
      <LogoMark size={76} variant="mark" className="opacity-90" />
      <h1 className="mt-7 font-display text-xl font-bold">{title}</h1>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-7 flex h-12 items-center justify-center rounded-full vybe-gradient px-8 text-sm font-bold text-white shadow-glow transition-transform active:scale-[0.98]"
      >
        Try Again
      </button>
    </div>
  );
}
