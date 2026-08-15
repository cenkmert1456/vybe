import { useState } from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const GRADIENTS = [
  "from-violet-600/80 to-fuchsia-500/70",
  "from-fuchsia-600/80 to-rose-500/70",
  "from-indigo-600/80 to-violet-500/70",
  "from-rose-500/80 to-orange-400/70",
  "from-sky-600/80 to-indigo-500/70",
  "from-emerald-600/80 to-teal-500/70",
];

function gradientFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

export function ImageWithFallback({
  src,
  name,
  alt = "",
  className,
  imgClassName,
  eager = false,
  sizes,
}: {
  src?: string | null;
  name: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  const show = src && !failed;

  return (
    <div
      className={cn("relative overflow-hidden bg-muted", className)}
      role="img"
      aria-label={alt || name}
    >
      {show ? (
        <img
          src={src}
          alt={alt || name}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          sizes={sizes}
          onError={() => setFailed(true)}
          className={cn("h-full w-full object-cover", imgClassName)}
          draggable={false}
        />
      ) : (
        <div
          className={cn(
            "flex h-full w-full items-center justify-center bg-gradient-to-br",
            gradientFor(name),
          )}
        >
          <span className="select-none font-display text-3xl font-bold text-white/90">
            {initials(name)}
          </span>
        </div>
      )}
    </div>
  );
}
