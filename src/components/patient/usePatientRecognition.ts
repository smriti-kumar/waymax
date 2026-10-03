"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/client/api";
import { RecognitionLoop, type LoopEvent } from "@/client/face/loop";
import { FaceMatcher } from "@/client/face/matcher";
import { WebcamFrameSource } from "@/client/face/frame-source";
import { engineFromUrl, MATCH_THRESHOLD } from "@/client/face/select";
import type { DetectedFace, FrameInput } from "@/client/face/types";
import { postRecognition, reportStatus } from "@/client/patient-api";
import { api } from "@/client/api";
import { blobToBase64, cropToJpeg } from "@/client/image/resize";
import { prefetchSpeech } from "@/client/speech/speak";
import type { GalleryResponse, PersonCardDto } from "@/lib/contracts/patient";

export const CARD_LINGER_MS = 60_000;
/** After "Add this person", stay quiet about unknown faces for a while. */
const UNKNOWN_QUIET_MS = 5 * 60_000;
/** …and poll the gallery faster so an approval shows up on the next sighting. */
const FAST_GALLERY_MS = 10 * 60_000;
const REPOST_MS = 60_000;

export type UnknownSighting = { face: DetectedFace; frame: FrameInput; model: string };
export type CameraStatus = "starting" | "ok" | "unavailable";

export function usePatientRecognition(enabled: boolean) {
  const [card, setCard] = useState<PersonCardDto | null>(null);
  const [unknown, setUnknown] = useState<UnknownSighting | null>(null);
  const [camera, setCamera] = useState<CameraStatus>("starting");
  const [fastGalleryUntil, setFastGalleryUntil] = useState(0);
  const unknownQuietUntil = useRef(0);
  const matcher = useRef(new FaceMatcher([], MATCH_THRESHOLD));
  const engineRef = useRef<ReturnType<typeof engineFromUrl> | null>(null);
  const lastSeen = useRef(new Map<string, number>());
  const lastPost = useRef(new Map<string, number>());
  const inflight = useRef(false);
  /** After "Back to today", don't re-show that person by face for a minute. */
  const dismissedUntil = useRef(new Map<string, number>());
  const cardRef = useRef<PersonCardDto | null>(null);

  const { data: gallery } = useSWR<GalleryResponse>(enabled ? "/api/patient/face-gallery" : null, fetcher, {
    refreshInterval: () => (Date.now() < fastGalleryUntil ? 10_000 : 60_000),
    keepPreviousData: true,
  });

  const showCard = useCallback((c: PersonCardDto | null) => {
    cardRef.current = c;
    setCard(c);
    if (c) {
      setUnknown(null);
      prefetchSpeech(c.sayText);
    }
  }, []);

  const choose = useCallback(
    async (personId: string, confidence: number, source: "face" | "manual") => {
      const now = Date.now();
      lastSeen.current.set(personId, now);
      if (source === "face" && (dismissedUntil.current.get(personId) ?? 0) > now) return;
      const showing = cardRef.current?.personId === personId;
      if (showing && now - (lastPost.current.get(personId) ?? 0) < REPOST_MS) return;
      if (inflight.current) return;
      inflight.current = true;
      try {
        const r = await postRecognition(personId, confidence, source);
        lastPost.current.set(personId, now);
        if (r.card) showCard(r.card);
      } catch {
        /* keep whatever is on screen */
      } finally {
        inflight.current = false;
      }
    },
    [showCard],
  );

  // Gallery → matcher (and mock engine).
  useEffect(() => {
    if (!gallery) return;
    const people = gallery.people.map((p) => ({ ...p }));
    matcher.current.setGallery(people);
    engineRef.current?.mock?.setGallery(people);
  }, [gallery]);

  // Camera loop.
  useEffect(() => {
    if (!enabled) return;
    const sel = engineFromUrl(window.location.search);
    engineRef.current = sel;
    if (gallery) sel.mock?.setGallery(gallery.people);
    const source = sel.mock ? null : new WebcamFrameSource();
    const loop = new RecognitionLoop(sel.engine, source, matcher.current, (e: LoopEvent) => {
      if (e.type === "recognized") {
        void choose(e.personId, e.confidence, "face");
      } else if (e.type === "unknown") {
        const quiet = Date.now() < unknownQuietUntil.current;
        if (!quiet && (!cardRef.current || Date.now() - (lastSeen.current.get(cardRef.current.personId) ?? 0) > 5000)) {
          setUnknown((u) => u ?? { face: e.face, frame: e.frame, model: sel.engine.model });
        }
      }
    });
    let cancelled = false;
    loop
      .start()
      .then(() => {
        if (cancelled) return;
        // Human exposes its native matcher only after load.
        if (sel.engine.find) matcher.current.setFind(sel.engine.find);
        setCamera("ok");
        reportStatus({ camera: "ok", faceModel: "ok" });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        console.warn("[face] recognition unavailable", err);
        setCamera("unavailable");
        const denied = err?.name === "NotAllowedError";
        reportStatus({ camera: denied ? "denied" : "error", faceModel: denied ? "ok" : "error" });
      });
    return () => {
      cancelled = true;
      loop.stop();
    };
    // gallery intentionally excluded: the matcher is updated in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, choose]);

  // Fade the card after 60 s with no sighting.
  useEffect(() => {
    const t = setInterval(() => {
      const c = cardRef.current;
      if (c && Date.now() - (lastSeen.current.get(c.personId) ?? 0) > CARD_LINGER_MS) showCard(null);
    }, 2000);
    return () => clearInterval(t);
  }, [showCard]);

  return {
    card,
    unknown,
    camera,
    dismissCard: () => {
      const c = cardRef.current;
      if (c) dismissedUntil.current.set(c.personId, Date.now() + CARD_LINGER_MS);
      showCard(null);
    },
    dismissUnknown: () => {
      unknownQuietUntil.current = Date.now() + 60_000;
      setUnknown(null);
    },
    /** Sends the face crop + embedding to the caregiver's approval queue. */
    addUnknown: async () => {
      const u = unknown;
      if (!u) return false;
      try {
        const snap = await cropToJpeg(u.frame as CanvasImageSource & { width?: number; height?: number }, u.face.box);
        await api("/api/patient/unknown-people", {
          method: "POST",
          json: {
            embedding: u.face.embedding,
            dim: u.face.embedding.length,
            model: u.model,
            snapshotJpegBase64: await blobToBase64(snap),
          },
        });
        unknownQuietUntil.current = Date.now() + UNKNOWN_QUIET_MS;
        setFastGalleryUntil(Date.now() + FAST_GALLERY_MS);
        setUnknown(null);
        return true;
      } catch (err) {
        console.warn("[face] add person failed", err);
        return false;
      }
    },
    pickManually: (personId: string) => {
      dismissedUntil.current.delete(personId);
      return choose(personId, 1, "manual");
    },
  };
}
