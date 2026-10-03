import { HumanFaceEngine } from "./human-engine";
import { MockFaceEngine } from "./mock-engine";
import type { FaceEngine } from "./types";

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const MATCH_THRESHOLD = Number(process.env.NEXT_PUBLIC_FACE_MATCH_THRESHOLD ?? 0.55) || 0.55;

/** Mock engine only when demo mode is on and the URL asks for it (E2E tests). */
export function engineFromUrl(search: string): { engine: FaceEngine; mock: MockFaceEngine | null } {
  const q = new URLSearchParams(search);
  if (DEMO_MODE && q.get("faceEngine") === "mock") {
    const mock = new MockFaceEngine((q.get("mockPerson") as string) || "none");
    return { engine: mock, mock };
  }
  return { engine: new HumanFaceEngine(), mock: null };
}
