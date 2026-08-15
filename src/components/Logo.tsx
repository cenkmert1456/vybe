import { cn } from "@/lib/utils";
import { useId } from "react";

/**
 * VYBE brand mark — an original abstract V formed by two smooth, flowing
 * ribbons that sweep down and meet at a soft apex, with a small "vibe" dot
 * beneath. Flat, premium, global. Not a flame, heart, or any existing brand.
 *
 * Variants:
 *  - "app": dark rounded tile with the gradient mark (app icon look) — default
 *  - "mark": just the gradient mark on a transparent background
 *  - "mono": single-color mark (uses currentColor) for light/dark surfaces
 */

const ARM_LEFT = "M13 14 C 25 19, 30.5 33, 32 46";
const ARM_RIGHT = "M51 14 C 39 19, 33.5 33, 32 46";

export type LogoVariant = "app" | "mark" | "mono";

export function LogoMark({
  size = 56,
  variant = "app",
  className,
}: {
  size?: number;
  variant?: LogoVariant;
  className?: string;
}) {
  // Unique ids so multiple marks (splash + nav + chat headers) never collide.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gradId = `vybe-v-${uid}`;
  const dotId = `vybe-dot-${uid}`;
  const mono = variant === "mono";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {!mono && (
        <defs>
          <linearGradient
            id={gradId}
            x1="12"
            y1="12"
            x2="52"
            y2="54"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#8B5CF6" />
            <stop offset="0.55" stopColor="#C026D3" />
            <stop offset="1" stopColor="#FF5FA2" />
          </linearGradient>
          <linearGradient
            id={dotId}
            x1="27"
            y1="45"
            x2="37"
            y2="57"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#FF5FA2" />
            <stop offset="1" stopColor="#38BDF8" />
          </linearGradient>
        </defs>
      )}
      {variant === "app" && (
        <rect width="64" height="64" rx="18" fill="#0E0E16" />
      )}
      {/* Flowing V — left ribbon */}
      <path
        d={ARM_LEFT}
        stroke={mono ? "currentColor" : `url(#${gradId})`}
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      {/* Flowing V — right ribbon */}
      <path
        d={ARM_RIGHT}
        stroke={mono ? "currentColor" : `url(#${gradId})`}
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      {/* Vibe dot */}
      <circle
        cx="32"
        cy="51.5"
        r="3"
        fill={mono ? "currentColor" : `url(#${dotId})`}
      />
    </svg>
  );
}

export function Wordmark({
  className,
  textClassName,
}: {
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={30} variant="mark" />
      <span
        className={cn(
          "font-display text-2xl font-bold tracking-[0.18em]",
          textClassName,
        )}
      >
        VYBE
      </span>
    </span>
  );
}
