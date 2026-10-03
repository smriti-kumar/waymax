import type { DetectedFace, FaceEngine, FindFn, FrameInput } from "./types";

type HumanModule = typeof import("@vladmandic/human");
type HumanInstance = InstanceType<HumanModule["Human"]>;

const CONFIG = {
  modelBasePath: "/models/human/",
  backend: "webgl" as const,
  debug: false,
  cacheSensitivity: 0,
  filter: { enabled: true, equalization: false, flip: false },
  face: {
    enabled: true,
    detector: { rotation: false, maxDetected: 5, minConfidence: 0.5, return: false },
    mesh: { enabled: true },
    iris: { enabled: false },
    description: { enabled: true },
    emotion: { enabled: false },
    antispoof: { enabled: false },
    liveness: { enabled: false },
    attention: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
  segmentation: { enabled: false },
};

/** @vladmandic/human: face detect + faceres embedding, in the browser. webgl, falling back to wasm. */
export class HumanFaceEngine implements FaceEngine {
  readonly model = "human-faceres";
  private human: HumanInstance | null = null;
  private loading: Promise<void> | null = null;
  find?: FindFn;

  load() {
    this.loading ??= this.init();
    return this.loading;
  }

  private async init() {
    const { Human } = (await import("@vladmandic/human")) as HumanModule;
    let human = new Human(CONFIG);
    try {
      await human.load();
      await human.warmup();
    } catch (err) {
      console.warn("[face] webgl backend failed, trying wasm", err);
      human = new Human({ ...CONFIG, backend: "wasm" });
      await human.load();
    }
    this.human = human;
    this.find = (d, ds) => human.match.find(d, ds);
  }

  async detect(frame: FrameInput): Promise<DetectedFace[]> {
    if (!this.human) await this.load();
    const res = await this.human!.detect(frame as Parameters<HumanInstance["detect"]>[0]);
    return res.face
      .filter((f) => Array.isArray(f.embedding) && f.embedding.length > 0)
      .map((f) => ({
        embedding: Array.from(f.embedding as number[]),
        box: { x: f.box[0], y: f.box[1], width: f.box[2], height: f.box[3] },
        score: f.boxScore ?? f.score,
      }));
  }
}
