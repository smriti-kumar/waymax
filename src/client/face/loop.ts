import { FaceMatcher } from "./matcher";
import { StabilityTracker, type StableState } from "./stability";
import type { FrameSource } from "./frame-source";
import type { DetectedFace, FaceEngine, FrameInput } from "./types";

export type LoopEvent =
  | { type: "recognized"; personId: string; confidence: number }
  | { type: "unknown"; face: DetectedFace; frame: FrameInput }
  | { type: "none" };

function largest(faces: DetectedFace[]) {
  return faces.reduce<DetectedFace | null>((a, f) => (!a || f.box.width * f.box.height > a.box.width * a.box.height ? f : a), null);
}

/**
 * Runs detect → match → stability at `fps`, only while the tab is visible.
 * Emits every stable state; the UI decides what to do with repeats.
 */
export class RecognitionLoop {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private busy = false;
  private tracker = new StabilityTracker();
  private frame: FrameInput | null = null;
  private onVisibility = () => {
    if (document.hidden) this.tracker.reset();
    else this.schedule(0);
  };

  constructor(
    private engine: FaceEngine,
    private source: FrameSource | null,
    private matcher: FaceMatcher,
    private emit: (e: LoopEvent, state: StableState) => void,
    private fps = 2,
  ) {}

  async start() {
    await this.engine.load();
    if (this.source) this.frame = await this.source.start();
    else {
      const c = document.createElement("canvas");
      c.width = 640;
      c.height = 480;
      this.frame = c;
    }
    this.running = true;
    document.addEventListener("visibilitychange", this.onVisibility);
    this.schedule(0);
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.source?.stop();
  }

  private schedule(ms: number) {
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.tick(), ms);
  }

  private async tick() {
    if (!this.running || document.hidden || this.busy || !this.frame) return;
    this.busy = true;
    const started = performance.now();
    try {
      const faces = await this.engine.detect(this.frame);
      const face = largest(faces);
      const match = face ? this.matcher.match(face.embedding) : null;
      const state = this.tracker.push({
        personId: match?.personId ?? null,
        similarity: match?.similarity,
        faces: faces.length,
        t: Date.now(),
      });
      if (state.kind === "recognized") this.emit({ type: "recognized", personId: state.personId, confidence: state.confidence }, state);
      else if (state.kind === "unknown" && face) this.emit({ type: "unknown", face, frame: this.frame }, state);
      else this.emit({ type: "none" }, state);
    } catch (err) {
      console.warn("[face] detect failed", err);
    } finally {
      this.busy = false;
      const elapsed = performance.now() - started;
      this.schedule(Math.max(0, 1000 / this.fps - elapsed));
    }
  }
}
