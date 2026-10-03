export type Box = { x: number; y: number; width: number; height: number };

export interface DetectedFace {
  embedding: number[];
  box: Box;
  /** detection confidence 0..1 */
  score: number;
}

export type FrameInput = HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap;

export interface FaceEngine {
  /** Model id stored with embeddings, e.g. "human-faceres". */
  readonly model: string;
  load(): Promise<void>;
  detect(frame: FrameInput): Promise<DetectedFace[]>;
  /** Optional native matcher (Human's `match.find`). */
  find?: FindFn;
}

export type FindFn = (
  descriptor: number[],
  descriptors: number[][],
) => { index: number; distance: number; similarity: number };

export type GalleryPerson = {
  personId: string;
  name: string;
  relationship: string;
  photoUrl: string | null;
  embeddings: number[][];
};
