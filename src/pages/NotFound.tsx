import { motion } from "framer-motion";
import { Link } from "react-router";
import { LogoMark } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/15 blur-[100px]" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative flex flex-col items-center text-center"
      >
        <LogoMark size={72} />
        <h1 className="mt-8 font-display text-6xl font-bold vybe-gradient-text">404</h1>
        <p className="mt-3 max-w-xs text-sm text-muted-foreground">
          This vibe doesn't exist. Let's get you back to the good ones.
        </p>
        <Link
          to="/app/discover"
          className="mt-8 rounded-full vybe-gradient px-8 py-3.5 text-base font-bold text-white shadow-glow"
        >
          Back to Discover
        </Link>
      </motion.div>
    </div>
  );
}
