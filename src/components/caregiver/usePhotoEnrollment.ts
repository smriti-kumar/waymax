"use client";
import type { PhotoCheck } from "./PhotoUploader";

/** Face enrollment hook. Until the face engine lands (T5) photos upload without samples. */
export function usePhotoEnrollment(personId: string): {
  check?: PhotoCheck;
  afterUpload: (mediaId: string, meta: unknown) => Promise<void>;
  banner: string | null;
} {
  void personId;
  return { check: undefined, afterUpload: async () => {}, banner: null };
}
