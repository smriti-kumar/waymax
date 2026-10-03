import "server-only";
import { db } from "@/server/db/client";
import { patientEvents } from "@/server/db/schema";
import type { EventKind } from "@/lib/contracts/patient";

export async function logEvent(
  patientId: string,
  deviceId: string | null,
  kind: EventKind,
  payload: Record<string, unknown> = {},
  at = new Date(),
) {
  await db().insert(patientEvents).values({ patientId, deviceId, kind, payload, occurredAt: at });
}
