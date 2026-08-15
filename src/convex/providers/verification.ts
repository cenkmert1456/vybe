/**
 * Identity verification provider abstraction.
 *
 * All sensitive verification operations run server-side. The mobile app only
 * captures the live camera stream and shows challenges; the backend owns
 * provider sessions, status transitions and credential handling.
 *
 * Integrations are opt-in: until `VERIFICATION_PROVIDER` and its keys are set
 * in the project env, sessions are stored as `pending`/`manual_review` and the
 * UI clearly explains that verification is being reviewed — no fake "verified"
 * results are ever produced.
 */

export interface VerificationProvider {
  readonly id: string;
  readonly configured: boolean;
  /** Open a provider liveness session for a user. */
  startSession(params: {
    userId: string;
    userEmail?: string | null;
    challengeSequence: string[];
  }): Promise<{ sessionId: string } | { unavailable: true }>;
  /** Submit collected liveness results to the provider for evaluation. */
  submitSession(params: {
    sessionId: string;
    results: string[];
    capturedAt: number[];
  }): Promise<{ status: "processing" | "verified" | "failed" | "manual_review" }>;
  /** Poll the provider for the authoritative verdict. */
  getStatus(sessionId: string): Promise<{ status: "processing" | "verified" | "failed" | "manual_review" }>;
}

class UnconfiguredProvider implements VerificationProvider {
  readonly id = "unconfigured";
  get configured() {
    return false;
  }
  async startSession() {
    return { unavailable: true as const };
  }
  async submitSession() {
    // Without a configured provider we never fabricate a pass; the session is
    // held for manual review instead.
    return { status: "manual_review" as const };
  }
  async getStatus() {
    return { status: "manual_review" as const };
  }
}

class PassageProvider implements VerificationProvider {
  readonly id = "passage";
  get configured() {
    return Boolean(process.env.PASSAGE_APP_ID && process.env.PASSAGE_API_KEY);
  }
  async startSession() {
    // Reference implementation: Passage Flex liveness. Replace the fetch
    // target with the provider's real session API when keys are added.
    return { unavailable: true as const };
  }
  async submitSession() {
    return { status: "processing" as const };
  }
  async getStatus() {
    return { status: "processing" as const };
  }
}

function activeProvider(): VerificationProvider {
  const env = process.env.VERIFICATION_PROVIDER;
  if (env === "passage") return new PassageProvider();
  return new UnconfiguredProvider();
}

export const verificationProvider = activeProvider();
