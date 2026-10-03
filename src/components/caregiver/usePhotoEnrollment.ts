"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/client/api";
import { checkEnrollmentFaces } from "@/client/face/enrollment";
import { engineFromUrl } from "@/client/face/select";
import type { FaceEngine } from "@/client/face/types";
import { loadBitmap } from "@/client/image/resize";
import type { PhotoCheck } from "./PhotoUploader";

type Meta = { vector: number[]; dim: number; model: string } | undefined;

/**
 * Runs the same face model as the patient laptop on each uploaded photo,
 * enforces the §5.1 rules, and posts the embedding after upload. If the model
 * can't load, photos still upload (without a face sample) and a banner explains.
 */
export function usePhotoEnrollment(personId: string) {
  const engine = useRef<FaceEngine | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const failed = useRef(false);

  useEffect(() => {
    engine.current = engineFromUrl(window.location.search).engine;
  }, []);

  const check: PhotoCheck = useCallback(async (file) => {
    const e = engine.current;
    if (!e || failed.current) return { ok: true };
    try {
      await e.load();
    } catch (err) {
      console.warn("[face] model failed to load", err);
      failed.current = true;
      setBanner("Face samples can't be made in this browser right now. Photos are still saved — try Chrome on a laptop.");
      return { ok: true };
    }
    const bmp = await loadBitmap(file);
    const res = checkEnrollmentFaces(await e.detect(bmp));
    bmp.close();
    if (!res.ok) return res;
    return { ok: true, meta: { vector: res.face.embedding, dim: res.face.embedding.length, model: e.model } };
  }, []);

  const afterUpload = useCallback(
    async (mediaId: string, meta: unknown) => {
      const m = meta as Meta;
      if (!m) return;
      await api(`/api/people/${personId}/embeddings`, {
        method: "POST",
        json: { items: [{ vector: m.vector, dim: m.dim, model: m.model, mediaId }] },
      });
    },
    [personId],
  );

  return { check, afterUpload, banner };
}
