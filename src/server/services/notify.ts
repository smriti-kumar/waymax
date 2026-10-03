import "server-only";
import { db } from "@/server/db/client";
import { notifications } from "@/server/db/schema";

export type NotifKind = "geofence_exit" | "geofence_return" | "person_pending" | "test";

/** Inserts the in-app alert (dedupe_key makes this idempotent). Returns the row, or null if it already existed. */
export async function createInAppNotification(input: {
  patientId: string;
  kind: NotifKind;
  title: string;
  body: string;
  dedupeKey: string;
  photonStatus?: "skipped" | "pending";
}) {
  const [row] = await db()
    .insert(notifications)
    .values({
      patientId: input.patientId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      dedupeKey: input.dedupeKey,
      photonStatus: input.photonStatus ?? "skipped",
    })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}
