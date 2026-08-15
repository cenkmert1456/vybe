import { motion } from "framer-motion";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
import { ArrowLeft, Loader2, Mail, ShieldCheck } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/app/discover",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

type Step = "welcome" | "email" | "otp";

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const [step, setStep] = useState<Step>("welcome");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("email", email);
      await signIn("email-otp", formData);
      setStep("otp");
      setIsLoading(false);
    } catch (err) {
      console.error("Email sign-in error:", err);
      setError(
        err instanceof Error ? err.message : t("common.networkError"),
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("code", otp);
      await signIn("email-otp", formData);
      navigate(redirect, { replace: true });
    } catch (err) {
      console.error("OTP error:", err);
      setError(t("auth.verifyError"));
      setIsLoading(false);
      setOtp("");
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-600/20 blur-[90px]" />
        <div className="absolute bottom-[-40px] right-[-40px] h-56 w-56 rounded-full bg-fuchsia-600/15 blur-[90px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-safe">
        {step === "welcome" ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-1 flex-col justify-center pb-10"
          >
            <div className="mb-10 flex flex-col items-center text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <LogoMark size={92} variant="mark" />
              </motion.div>
              <h1 className="mt-6 font-display text-4xl font-bold tracking-tight">
                {t("auth.findYourVibe")}
              </h1>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {t("auth.subtitle")}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                className="h-13 rounded-full vybe-gradient text-base font-bold text-white shadow-glow transition-transform active:scale-[0.98]"
                onClick={() => setStep("email")}
              >
                <Mail className="size-5" />
                {t("auth.continueWithEmail")}
              </Button>
            </div>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              {t("auth.ageNote")}
            </p>
            <button
              type="button"
              onClick={() => setStep("email")}
              className="mt-2 text-center text-sm font-semibold text-primary"
            >
              {t("auth.alreadyAccount")} {t("auth.logIn")}
            </button>
            <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground/80">
              <ShieldCheck className="size-3.5" />
              {t("auth.termsNote")}
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35 }}
            className="flex flex-1 flex-col justify-center pb-10"
          >
            <button
              type="button"
              onClick={() => setStep("welcome")}
              aria-label={t("common.back")}
              className="mb-6 -ml-2 flex size-10 items-center justify-center rounded-full text-foreground active:bg-muted"
            >
              <ArrowLeft className="size-5" />
            </button>

            <div className="mb-8">
              <LogoMark size={48} variant="mark" />
              <h1 className="mt-5 font-display text-2xl font-bold">
                {step === "otp" ? t("auth.checkEmail") : t("auth.emailTitle")}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {step === "otp" ? t("auth.codeSent", { email }) : t("auth.emailSubtitle")}
              </p>
            </div>

            {step === "email" ? (
              <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
                <div>
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("auth.emailPlaceholder")}
                    className="h-13 rounded-2xl border-input bg-card px-4 text-base"
                    disabled={isLoading}
                  />
                  {error && (
                    <p className="mt-2 text-sm text-destructive">{error}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="h-13 rounded-full vybe-gradient text-base font-bold text-white shadow-glow"
                >
                  {isLoading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    t("auth.sendCode")
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit} className="flex flex-col gap-5">
                <div className="flex justify-center">
                  <InputOTP
                    value={otp}
                    onChange={setOtp}
                    maxLength={6}
                    disabled={isLoading}
                  >
                    <InputOTPGroup>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className="size-12 rounded-xl border-border bg-card text-lg font-bold"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {error && (
                  <p className="text-center text-sm text-destructive">{error}</p>
                )}
                <Button
                  type="submit"
                  disabled={isLoading || otp.length !== 6}
                  className="h-13 rounded-full vybe-gradient text-base font-bold text-white shadow-glow"
                >
                  {isLoading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    t("auth.verify")
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setOtp("");
                    setError(null);
                  }}
                  className="text-center text-sm font-semibold text-primary"
                >
                  {t("auth.useDifferentEmail")}
                </button>
              </form>
            )}
          </motion.div>
        )}
      </div>

    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
