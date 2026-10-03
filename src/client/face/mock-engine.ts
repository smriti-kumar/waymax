import type { DetectedFace, FaceEngine, FrameInput, GalleryPerson } from "./types";

export const MOCK_DIM = 1024;
export const MOCK_MODEL = "human-faceres";

/**
 * Deterministic vector from a string seed (mulberry32), values in [-0.5, 0.5).
 * Not normalized: that matches the scale of faceres embeddings, so Human's
 * similarity gives ~0.25 for two different seeds and ~1 for the same seed.
 */
export function seededVector(seed: string, dim = MOCK_DIM): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: dim }, () => rand() - 0.5);
}

export type MockTarget = string | "unknown" | "none" | "fail";

/**
 * Test/demo engine (?faceEngine=mock&mockPerson=<id|unknown|none>, demo mode only).
 * A person id returns that person's first gallery embedding; "unknown" returns a
 * fixed vector that matches nobody until it is approved; "none" returns no faces;
 * "fail" throws from load() like a model that can't be downloaded.
 */
export class MockFaceEngine implements FaceEngine {
  readonly model = MOCK_MODEL;
  private gallery: GalleryPerson[] = [];

  constructor(
    private target: MockTarget = "none",
    private opts: { faces?: number; boxPx?: number } = {},
  ) {}

  setGallery(g: GalleryPerson[]) {
    this.gallery = g;
  }

  setTarget(t: MockTarget) {
    this.target = t;
  }

  async load() {
    // "fail" simulates the face model not loading (PLAN §11 failure case).
    if (this.target === "fail") throw new Error("mock: face model failed to load");
  }

  async detect(frame: FrameInput): Promise<DetectedFace[]> {
    const count = this.opts.faces ?? (this.target === "none" ? 0 : 1);
    const px = this.opts.boxPx ?? 200;
    const faces: DetectedFace[] = [];
    for (let i = 0; i < count; i++) {
      faces.push({ embedding: this.embeddingFor(frame, i), box: { x: 40 + i * 220, y: 40, width: px, height: px }, score: 0.98 });
    }
    return faces;
  }

  private embeddingFor(frame: FrameInput, i: number): number[] {
    if (this.target === "unknown") return seededVector("waymax-unknown-visitor");
    const person = this.gallery.find((p) => p.personId === this.target);
    if (person?.embeddings[0]) return person.embeddings[0];
    // Enrollment from a photo: derive a stable vector from the image size.
    const w = "width" in frame ? frame.width : 0;
    const h = "height" in frame ? frame.height : 0;
    return seededVector(`${this.target}:${w}x${h}:${i}`);
  }
}
