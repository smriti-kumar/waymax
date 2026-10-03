import { z } from "zod";
import { nonEmpty } from "./common";

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const radius = z.number().int().min(50).max(20000);

export const homeFenceBody = z.object({ lat, lng, radiusM: radius, label: nonEmpty(60).default("Home") });

export const tempFenceBody = z.object({
  label: nonEmpty(60),
  lat,
  lng,
  radiusM: radius,
  activeFrom: z.iso.datetime({ offset: true }),
  activeUntil: z.iso.datetime({ offset: true }),
});

export const locationBody = z.object({
  lat,
  lng,
  accuracyM: z.number().min(0).max(100_000).nullish(),
  recordedAt: z.iso.datetime({ offset: true }).optional(),
  source: z.enum(["browser", "shortcut", "device"]).default("browser"),
});

export const simulateBody = z.object({ action: z.enum(["walk_out", "walk_home"]) });
export const trailQuery = z.object({ limit: z.coerce.number().int().min(1).max(500).default(50) });

export type LocationPoint = { lat: number; lng: number; accuracyM: number | null; recordedAt: string; source: string };
export type LocationResponse = {
  latest: LocationPoint | null;
  trail: LocationPoint[];
  fence: { id: string; kind: "home" | "temporary"; label: string; centerLat: number; centerLng: number; radiusM: number } | null;
  state: "unknown" | "inside" | "outside";
  stateChangedAt: string | null;
};
