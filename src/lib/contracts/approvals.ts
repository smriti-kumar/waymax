import { z } from "zod";
import { uuid } from "./common";

export const unknownPersonBody = z.object({
  embedding: z.array(z.number().finite()).min(16).max(4096),
  dim: z.number().int().positive(),
  model: z.string().min(1).max(60),
  // ≤300 KB of JPEG is ≤ ~400 KB of base64.
  snapshotJpegBase64: z.string().min(16).max(420_000),
});

export const mergeBody = z.object({ intoPersonId: uuid });
