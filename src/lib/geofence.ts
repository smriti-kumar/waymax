// Geofence state machine (PLAN §6 rules). Pure, so it is unit-tested directly.
import { haversineM, isOutside, pickActiveFence, type FenceLike } from "./geo";

export type FenceState = "unknown" | "inside" | "outside";
export const MAX_ACCURACY_M = 500;
export const EXIT_STRIKES = 2;

export type Ping = { lat: number; lng: number; accuracyM?: number | null };

export type Evaluation = {
  state: FenceState;
  streak: number;
  transition: "exit" | "return" | null;
  /** Why the state did not move, if it didn't. */
  ignored?: "no_fence" | "low_accuracy";
  distanceM: number | null;
};

/**
 * - pings with accuracy > 500 m are ignored
 * - outside = distance > radius + min(accuracy, 100)
 * - two consecutive outside pings: inside|unknown → outside ("exit")
 * - one inside ping: outside → inside ("return"); unknown → inside quietly
 */
export function evaluatePing(
  current: { state: FenceState; streak: number },
  fences: FenceLike[],
  ping: Ping,
  now: Date = new Date(),
): Evaluation {
  const fence = pickActiveFence(fences, now);
  if (!fence) return { ...current, transition: null, ignored: "no_fence", distanceM: null };
  const distanceM = haversineM({ lat: fence.centerLat, lng: fence.centerLng }, ping);
  if ((ping.accuracyM ?? 0) > MAX_ACCURACY_M) return { ...current, transition: null, ignored: "low_accuracy", distanceM };

  if (isOutside(fence, ping)) {
    const streak = current.streak + 1;
    if (current.state !== "outside" && streak >= EXIT_STRIKES) return { state: "outside", streak, transition: "exit", distanceM };
    return { state: current.state, streak, transition: null, distanceM };
  }
  if (current.state === "outside") return { state: "inside", streak: 0, transition: "return", distanceM };
  return { state: "inside", streak: 0, transition: null, distanceM };
}
