import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useNavigate, useParams } from "react-router";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { ImageWithFallback } from "@/components/mobile/ImageWithFallback";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, Search } from "lucide-react";
import { useEffect, useState } from "react";

function SparkleBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, i) => {
        const angle = (i / 18) * Math.PI * 2;
        const dist = 90 + (i % 5) * 26;
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist,
              opacity: [0, 1, 0],
              scale: [0, 1, 0.4],
            }}
            transition={{ duration: 1.1, delay: 0.25 + (i % 6) * 0.06, ease: "easeOut" }}
            className="absolute left-1/2 top-1/2 text-lg"
          >
            {["✦", "✧", "♥", "⚡", "✦"][i % 5]}
          </motion.span>
        );
      })}
    </div>
  );
}

export default function MatchMoment() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const data = useQuery(api.matches.getMatch, { matchId: matchId as any });
  const myProfile = useQuery(api.profiles.myProfile);

  useEffect(() => {
    const timer = setTimeout(() => {
      haptic("success");
      setReady(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (!data || !myProfile) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.other) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 px-8 text-center bg-background">
        <p className="text-sm text-muted-foreground">{t("common.error")}</p>
        <Button variant="outline" onClick={() => navigate("/app/discover")}>
          {t("discover.refresh")}
        </Button>
      </div>
    );
  }

  const other = data.other;
  const myPhoto = myProfile.photos[0];

  return (
    <div className="relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6">
      {/* Ambient gradient */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--vybe-violet)_35%,transparent),transparent_70%)]"
        />
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-fuchsia-600/20 blur-[100px]" />
      </div>

      <SparkleBurst />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : -14 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 mb-6"
      >
        <LogoMark size={44} />
      </motion.div>

      {/* Connecting photos */}
      <div className="relative z-10 flex items-center">
        <motion.div
          initial={{ x: -90, opacity: 0, rotate: -8 }}
          animate={{ x: ready ? -8 : -90, opacity: ready ? 1 : 0, rotate: -6 }}
          transition={{ type: "spring", stiffness: 220, damping: 20, delay: 0.15 }}
          className="z-10"
        >
          <div className="size-32 overflow-hidden rounded-full border-4 border-background shadow-2xl ring-2 ring-primary/40">
            <ImageWithFallback src={myPhoto} name="You" className="h-full w-full" />
          </div>
        </motion.div>

        <motion.div
          initial={{ scale: 0, rotate: 45 }}
          animate={{ scale: ready ? 1 : 0, rotate: ready ? 0 : 45 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.35 }}
          className="z-20 -mx-4 flex size-14 items-center justify-center rounded-full vybe-gradient text-white shadow-glow"
        >
          <span className="text-xl">⚡</span>
        </motion.div>

        <motion.div
          initial={{ x: 90, opacity: 0, rotate: 8 }}
          animate={{ x: ready ? 8 : 90, opacity: ready ? 1 : 0, rotate: 6 }}
          transition={{ type: "spring", stiffness: 220, damping: 20, delay: 0.15 }}
          className="z-10"
        >
          <div className="size-32 overflow-hidden rounded-full border-4 border-background shadow-2xl ring-2 ring-pink-400/40">
            <ImageWithFallback
              src={other.photos[0]}
              name={other.firstName}
              className="h-full w-full"
            />
          </div>
        </motion.div>
      </div>

      {/* Headline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 20 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="relative z-10 mt-8 text-center"
      >
        <h1 className="font-display text-[32px] font-bold leading-tight tracking-tight">
          {t("match.youCaught")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("match.subtitle", { name: other.firstName })}
        </p>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: ready ? 1 : 0, y: ready ? 0 : 24 }}
        transition={{ duration: 0.55, delay: 0.65 }}
        className="relative z-10 mt-8 flex w-full max-w-xs flex-col gap-3"
      >
        <Button
          onClick={() => navigate(`/app/chat/${matchId}`)}
          className="h-13 w-full rounded-full vybe-gradient text-base font-bold text-white shadow-glow"
        >
          <MessageCircle className="size-5" />
          {t("match.sendMessage")}
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("/app/discover", { replace: true })}
          className="h-13 w-full rounded-full border-border bg-card text-base font-semibold"
        >
          <Search className="size-4" />
          {t("match.keepDiscovering")}
        </Button>
      </motion.div>
    </div>
  );
}
