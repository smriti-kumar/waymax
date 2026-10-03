import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { alertContacts, notifications } from "@/server/db/schema";
import { messageSender, notifyMode } from "@/server/notify";

export type NotifKind = "geofence_exit" | "geofence_return" | "person_pending" | "test";
export const MAX_PHOTON_ATTEMPTS = 5;

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

async function geofenceNumbers(patientId: string) {
  const rows = await db()
    .select({ phone: alertContacts.phoneE164 })
    .from(alertContacts)
    .where(and(eq(alertContacts.patientId, patientId), eq(alertContacts.notifyGeofence, true)));
  return rows.map((r) => r.phone);
}

/**
 * Tries Photon for one notification: all recipients ok → sent; otherwise stays
 * pending (attempts+1) for the retry worker, and becomes failed after 5 attempts.
 */
export async function deliver(notificationId: string) {
  const [n] = await db().select().from(notifications).where(eq(notifications.id, notificationId));
  if (!n || n.photonStatus !== "pending") return n?.photonStatus ?? null;
  const phones = await geofenceNumbers(n.patientId);
  if (!phones.length || notifyMode() !== "photon") {
    await db().update(notifications).set({ photonStatus: "skipped" }).where(eq(notifications.id, n.id));
    return "skipped" as const;
  }
  const started = Date.now();
  const results = await messageSender().sendMany(phones, n.body);
  const failures = results.filter((r) => !r.ok);
  const attempts = n.photonAttempts + 1;
  const status = failures.length === 0 ? "sent" : attempts >= MAX_PHOTON_ATTEMPTS ? "failed" : "pending";
  const lastError = failures.length ? failures.map((f) => `${f.phoneE164}: ${f.error}`).join("; ").slice(0, 500) : null;
  await db()
    .update(notifications)
    .set({ photonStatus: status, photonAttempts: attempts, photonLastError: lastError })
    .where(eq(notifications.id, n.id));
  console.log(`[notify] ${n.kind} → ${phones.length} contact(s): ${status} in ${Date.now() - started}ms`);
  return status;
}

/** Geofence alert: the in-app row first (always), then Photon when enabled. */
export async function sendGeofenceAlert(input: {
  patientId: string;
  kind: "geofence_exit" | "geofence_return";
  title: string;
  body: string;
  dedupeKey: string;
}) {
  const wantPhoton = notifyMode() === "photon" && (await geofenceNumbers(input.patientId)).length > 0;
  const row = await createInAppNotification({ ...input, photonStatus: wantPhoton ? "pending" : "skipped" });
  if (row && wantPhoton) {
    try {
      await deliver(row.id);
    } catch (err) {
      console.warn("[notify] delivery crashed; left pending for retry", err);
    }
  }
  return row;
}

/** Worker endpoint: retry pending Photon deliveries (up to 5 attempts each). */
export async function retryPending(limit = 20) {
  const pending = await db()
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.photonStatus, "pending"), lt(notifications.photonAttempts, MAX_PHOTON_ATTEMPTS)))
    .orderBy(notifications.createdAt)
    .limit(limit);
  let sent = 0;
  let failed = 0;
  for (const p of pending) {
    const s = await deliver(p.id);
    if (s === "sent") sent++;
    if (s === "failed") failed++;
  }
  // Anything stuck at the cap (e.g. a crash mid-update) is closed out.
  await db()
    .update(notifications)
    .set({ photonStatus: "failed" })
    .where(and(eq(notifications.photonStatus, "pending"), sql`${notifications.photonAttempts} >= ${MAX_PHOTON_ATTEMPTS}`));
  return { retried: pending.length, sent, failed };
}

/** "Send test iMessage": always writes an in-app `test` row; sends via Photon when configured. */
export async function sendTest(patientId: string, preferredName: string) {
  const phones = await geofenceNumbers(patientId);
  const body = `Waymax test: alerts for ${preferredName} will arrive here.`;
  const configured = notifyMode() === "photon";
  const results = configured && phones.length ? await messageSender().sendMany(phones, body) : [];
  const allOk = results.length > 0 && results.every((r) => r.ok);
  await createInAppNotification({
    patientId,
    kind: "test",
    title: "Test alert",
    body,
    dedupeKey: `test:${patientId}:${Date.now()}`,
    photonStatus: "skipped",
  }).then(async (row) => {
    if (row && results.length) {
      await db()
        .update(notifications)
        .set({
          photonStatus: allOk ? "sent" : "failed",
          photonAttempts: 1,
          photonLastError: allOk ? null : results.filter((r) => !r.ok).map((r) => `${r.phoneE164}: ${r.error}`).join("; ").slice(0, 500),
        })
        .where(eq(notifications.id, row.id));
    }
  });
  return {
    configured,
    results: configured
      ? results.map((r) => ({ phoneE164: r.phoneE164, status: r.ok ? ("sent" as const) : ("failed" as const), ...(r.error ? { error: r.error } : {}) }))
      : phones.map((p) => ({ phoneE164: p, status: "skipped" as const })),
    anyFailed: results.some((r) => !r.ok),
  };
}
