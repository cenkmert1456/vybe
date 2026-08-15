/**

* VYBE on-device liveness verification.
*
* Uses MediaPipe FaceLandmarker locally in the browser/device.
* No raw camera video is uploaded by this module.
  */

import {
FaceLandmarker,
FilesetResolver,
type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

export const CHALLENGE_TYPES = [
"blink",
"turn_left",
"turn_right",
"look_up",
"look_down",
"smile",
] as const;

export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

export type LivenessOutcome = {
ok: boolean;
score: number;
results: string[];
capturedAt: number[];
frames: number;
durationMs: number;
reason?: string;
};

export type LivenessOptions = {
onChallenge?: (index: number, done: boolean) => void;
onFrame?: (info: {
faceDetected: boolean;
multiFace: boolean;
}) => void;
};

export const PASS_THRESHOLD = 55;
export const MIN_STABILITY = 0.35;
export const MIN_FRAMES = 20;
export const MAX_CHALLENGE_MS = 12000;
export const MAX_TOTAL_MS = 45000;

const IDX = {
leftEyeOuter: 33,
leftEyeUpper: 159,
leftEyeLower: 145,
leftEyeInner: 133,
rightEyeOuter: 362,
rightEyeUpper: 386,
rightEyeLower: 374,
rightEyeInner: 263,
noseTip: 1,
chin: 152,
} as const;

type Landmark = {
x: number;
y: number;
z?: number;
};

type BlendshapeMap = Record<string, number>;

type FrameMetrics = {
face: Landmark[];
yaw: number;
pitch: number;
smile: number;
closed: boolean;
};

function distance(a: Landmark, b: Landmark): number {
const dx = a.x - b.x;
const dy = a.y - b.y;
return Math.sqrt(dx * dx + dy * dy);
}

function eyeAspectRatio(
face: Landmark[],
outer: number,
upper: number,
lower: number,
inner: number,
): number {
const upperPoint = face[upper];
const lowerPoint = face[lower];
const outerPoint = face[outer];
const innerPoint = face[inner];

if (
!upperPoint ||
!lowerPoint ||
!outerPoint ||
!innerPoint
) {
return 1;
}

const vertical = distance(upperPoint, lowerPoint);
const horizontal = distance(outerPoint, innerPoint);

return vertical / Math.max(horizontal, 0.000001);
}

function getBlendshapeMap(
result: FaceLandmarkerResult | null,
): BlendshapeMap {
const output: BlendshapeMap = {};
const first = result?.faceBlendshapes?.[0];

if (!first) {
return output;
}

for (const category of first.categories) {
output[category.categoryName] = category.score;
}

return output;
}

function metricsFrom(
face: Landmark[],
blendshapes: BlendshapeMap,
): FrameMetrics {
const leftEar = eyeAspectRatio(
face,
IDX.leftEyeOuter,
IDX.leftEyeUpper,
IDX.leftEyeLower,
IDX.leftEyeInner,
);

const rightEar = eyeAspectRatio(
face,
IDX.rightEyeOuter,
IDX.rightEyeUpper,
IDX.rightEyeLower,
IDX.rightEyeInner,
);

const leftEye = face[IDX.leftEyeOuter];
const rightEye = face[IDX.rightEyeOuter];
const nose = face[IDX.noseTip];
const chin = face[IDX.chin];

if (
!leftEye ||
!rightEye ||
!nose ||
!chin
) {
return {
face,
yaw: 0,
pitch: 0.5,
smile: 0,
closed: false,
};
}

const eyeMidX =
(leftEye.x + rightEye.x) / 2;

const eyeDistance = Math.max(
Math.abs(rightEye.x - leftEye.x),
0.000001,
);

const yaw =
(nose.x - eyeMidX) / eyeDistance;

const eyeY =
(leftEye.y + rightEye.y) / 2;

const faceHeight = Math.max(
Math.abs(chin.y - eyeY),
0.000001,
);

const pitch =
(nose.y - eyeY) / faceHeight;

const blinkLeft =
blendshapes.eyeBlinkLeft ?? 0;

const blinkRight =
blendshapes.eyeBlinkRight ?? 0;

const blendshapeClosed =
blinkLeft > 0.30 &&
blinkRight > 0.30;

const ear =
(leftEar + rightEar) / 2;

const closed =
blendshapeClosed ||
ear < 0.19;

const smile = Math.max(
blendshapes.mouthSmileLeft ?? 0,
blendshapes.mouthSmileRight ?? 0,
);

return {
face,
yaw,
pitch,
smile,
closed,
};
}

class ChallengeDetector {
private type: ChallengeType;
private consecutive: number;
private wasClosed: boolean;
private detectedAt: number;

constructor(type: ChallengeType) {
this.type = type;
this.consecutive = 0;
this.wasClosed = false;
this.detectedAt = -1;
}

get done(): boolean {
return this.detectedAt >= 0;
}

update(
metrics: FrameMetrics,
now: number,
): boolean {
if (this.done) {
return true;
}

let hit = false;

switch (this.type) {
  case "blink": {
    if (metrics.closed) {
      this.consecutive += 1;
    } else if (
      this.wasClosed &&
      this.consecutive >= 1
    ) {
      hit = true;
    } else {
      this.consecutive = 0;
    }

    this.wasClosed = metrics.closed;
    break;
  }

  case "turn_left": {
    this.consecutive =
      metrics.yaw > 0.16
        ? this.consecutive + 1
        : 0;

    hit = this.consecutive >= 3;
    break;
  }

  case "turn_right": {
    this.consecutive =
      metrics.yaw < -0.16
        ? this.consecutive + 1
        : 0;

    hit = this.consecutive >= 3;
    break;
  }

  case "look_up": {
    this.consecutive =
      metrics.pitch < 0.48
        ? this.consecutive + 1
        : 0;

    hit = this.consecutive >= 3;
    break;
  }

  case "look_down": {
    this.consecutive =
      metrics.pitch > 0.52
        ? this.consecutive + 1
        : 0;

    hit = this.consecutive >= 3;
    break;
  }

  case "smile": {
    this.consecutive =
      metrics.smile > 0.22
        ? this.consecutive + 1
        : 0;

    hit = this.consecutive >= 3;
    break;
  }
}

if (hit && this.detectedAt < 0) {
  this.detectedAt = now;
}

return hit;

}
}

export function pickChallenges(
count = 3,
): ChallengeType[] {
const pool = [...CHALLENGE_TYPES];

for (
let index = pool.length - 1;
index > 0;
index -= 1
) {
const randomIndex = Math.floor(
Math.random() * (index + 1),
);

const current = pool[index];
const random = pool[randomIndex];

if (
  current !== undefined &&
  random !== undefined
) {
  pool[index] = random;
  pool[randomIndex] = current;
}

}

return pool.slice(
0,
Math.min(count, pool.length),
);
}

export async function runLiveness(
video: HTMLVideoElement,
challenges: ChallengeType[],
options?: LivenessOptions,
): Promise<LivenessOutcome> {
const wasmBase =
`${import.meta.env.BASE_URL}mediapipe/wasm`;

const vision =
await FilesetResolver.forVisionTasks(
wasmBase,
);

let landmarker: FaceLandmarker | null = null;

try {
landmarker =
await FaceLandmarker.createFromOptions(
vision,
{
baseOptions: {
modelAssetPath:
`${import.meta.env.BASE_URL}models/face_landmarker.task`,
delegate: "GPU",
},
runningMode: "VIDEO",
numFaces: 1,
outputFaceBlendshapes: true,
minFaceDetectionConfidence: 0.4,
minFacePresenceConfidence: 0.4,
},
);

const startedAt = performance.now();

let totalFrames = 0;
let validFrames = 0;
let multiFaceFrames = 0;
let noFaceStreak = 0;

let previousNose:
  | { x: number; y: number }
  | null = null;

let movement = 0;
let lastVideoTime = -1;
let currentChallenge = 0;

let challengeStartedAt =
  performance.now();

const detectors = challenges.map(
  (challenge) =>
    new ChallengeDetector(challenge),
);

const results: string[] = [];
const capturedAt: number[] = [];

let reason: string | undefined;
let finished = false;

return await new Promise<LivenessOutcome>(
  (resolve) => {
    const finish = () => {
      if (finished) {
        return;
      }

      finished = true;

      try {
        landmarker?.close();
      } catch {
        // Cleanup errors are ignored.
      }

      const stability =
        totalFrames > 0
          ? validFrames / totalFrames
          : 0;

      const allDone =
        currentChallenge >= detectors.length;

      const completionBonus =
        allDone
          ? 25
          : results.length * 8;

      const movementBonus =
        Math.min(10, movement * 60);

      const score = Math.round(
        Math.max(
          0,
          Math.min(
            100,
            40 +
              stability * 20 +
              completionBonus +
              movementBonus,
          ),
        ),
      );

      const ok =
        allDone &&
        score >= PASS_THRESHOLD &&
        stability >= MIN_STABILITY &&
        totalFrames >= MIN_FRAMES &&
        !reason;

      resolve({
        ok,
        score,
        results,
        capturedAt,
        frames: totalFrames,
        durationMs: Math.round(
          performance.now() - startedAt,
        ),
        reason:
          ok
            ? undefined
            : (
                reason ??
                (
                  allDone
                    ? "low_confidence"
                    : "incomplete"
                )
              ),
      });
    };

    const tick = () => {
      if (finished) {
        return;
      }

      const now = performance.now();

      if (
        now - startedAt > MAX_TOTAL_MS
      ) {
        reason = "timeout";
        finish();
        return;
      }

      if (
        video.readyState < 2 ||
        video.currentTime === lastVideoTime
      ) {
        requestAnimationFrame(tick);
        return;
      }

      lastVideoTime =
        video.currentTime;

      let result:
        | FaceLandmarkerResult
        | null = null;

      try {
        result =
          landmarker?.detectForVideo(
            video,
            now,
          ) ?? null;
      } catch {
        result = null;
      }

      totalFrames += 1;

      const faces =
        result?.faceLandmarks ?? [];

      if (faces.length === 1) {
        const detectedFace = faces[0];

        if (detectedFace) {
          options?.onFrame?.({
            faceDetected: true,
            multiFace: false,
          });

          validFrames += 1;
          noFaceStreak = 0;

          const face: Landmark[] =
            detectedFace.map(
              (point) => ({
                x: point.x,
                y: point.y,
                z: point.z,
              }),
            );

          const blendshapes =
            getBlendshapeMap(result);

          const metrics =
            metricsFrom(
              face,
              blendshapes,
            );

          const nose =
            metrics.face[IDX.noseTip];

          if (nose) {
            if (previousNose) {
              movement += Math.hypot(
                nose.x - previousNose.x,
                nose.y - previousNose.y,
              );
            }

            previousNose = {
              x: nose.x,
              y: nose.y,
            };
          }

          if (
            currentChallenge <
            detectors.length
          ) {
            const detector =
              detectors[currentChallenge];

            if (detector) {
              const wasDone =
                detector.done;

              const hit =
                detector.update(
                  metrics,
                  now,
                );

              options?.onChallenge?.(
                currentChallenge,
                hit || wasDone,
              );

              if (
                hit &&
                !wasDone
              ) {
                const challenge =
                  challenges[currentChallenge];

                if (challenge) {
                  results.push(challenge);

                  capturedAt.push(
                    Math.round(now),
                  );
                }

                currentChallenge += 1;
                challengeStartedAt = now;

                if (
                  currentChallenge >=
                  detectors.length
                ) {
                  finish();
                  return;
                }
              } else if (
                now -
                  challengeStartedAt >
                MAX_CHALLENGE_MS
              ) {
                reason =
                  "challenge_timeout";

                finish();
                return;
              }
            }
          }
        }
      } else if (faces.length > 1) {
        options?.onFrame?.({
          faceDetected: false,
          multiFace: true,
        });

        multiFaceFrames += 1;
        noFaceStreak = 0;
        previousNose = null;
      } else {
        options?.onFrame?.({
          faceDetected: false,
          multiFace: false,
        });

        noFaceStreak += 1;
        previousNose = null;
      }

      if (multiFaceFrames > 20) {
        reason = "multiple_faces";
        finish();
        return;
      }

      if (noFaceStreak > 150) {
        reason = "face_lost";
        finish();
        return;
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  },
);

} catch (error) {
try {
landmarker?.close();
} catch {
// Cleanup errors are ignored.
}

throw error;

}
}
