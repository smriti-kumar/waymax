import { z } from "zod";
import { nonEmpty, timezone } from "./common";

export const createPatientBody = z.object({
  name: nonEmpty(100),
  preferredName: nonEmpty(60),
  timezone: timezone.default("America/New_York"),
});

export const patchPatientBody = z
  .object({
    name: nonEmpty(100),
    preferredName: nonEmpty(60),
    timezone,
    homeLabel: nonEmpty(60),
    faceMatchThreshold: z.number().min(0.4).max(0.95).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const addCaregiverBody = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()) });

export const pairableKinds = ["patient_display", "patient_phone"] as const;
export const pairingCodeBody = z.object({ deviceKind: z.enum(pairableKinds) });
export const pairBody = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
  label: z.string().trim().min(1).max(80).default("Patient device"),
});

export type PatientDto = {
  id: string;
  name: string;
  preferredName: string;
  timezone: string;
  homeLabel: string;
  homeLat: number | null;
  homeLng: number | null;
  geofenceState: "unknown" | "inside" | "outside";
  geofenceStateChangedAt: string | null;
  lastLocationAt: string | null;
};

export type FenceDto = {
  id: string;
  kind: "home" | "temporary";
  label: string;
  centerLat: number;
  centerLng: number;
  radiusM: number;
  activeFrom: string | null;
  activeUntil: string | null;
  isActive: boolean;
};

export type DeviceDto = {
  id: string;
  kind: string;
  label: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};
