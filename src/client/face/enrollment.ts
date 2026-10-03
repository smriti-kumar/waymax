import type { DetectedFace, FaceEngine, FrameInput } from "./types";

export const MIN_FACE_PX = 80;

export type EnrollmentResult =
  | { ok: true; face: DetectedFace }
  | { ok: false; reason: string };

/** PLAN §5.1 photo rules: exactly one face, at least 80 px. */
export function checkEnrollmentFaces(faces: DetectedFace[]): EnrollmentResult {
  if (faces.length === 0) return { ok: false, reason: "No face found. Try a clearer, front-facing photo." };
  if (faces.length > 1) return { ok: false, reason: "More than one face. Use a photo with just this person." };
  const f = faces[0]!;
  if (Math.min(f.box.width, f.box.height) < MIN_FACE_PX)
    return { ok: false, reason: "The face is too small. Use a closer photo." };
  if (!f.embedding?.length) return { ok: false, reason: "Couldn't read this face. Try another photo." };
  return { ok: true, face: f };
}

export async function enrollFromImage(engine: FaceEngine, image: FrameInput): Promise<EnrollmentResult> {
  const faces = await engine.detect(image);
  return checkEnrollmentFaces(faces);
}
