import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { notifications } from "@/server/db/schema";
import { notFound } from "@/server/http/errors";
import { isUuid } from "@/server/auth/guards";

export async function listNotifications(pid: string, limit = 50) {
  return db()
    .select({
      id: notifications.id,
      kind: notifications.kind,
      title: notifications.title,
      body: notifications.body,
      photonStatus: notifications.photonStatus,
      photonLastError: notifications.photonLastError,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.patientId, pid))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function notificationPatient(nid: string) {
  if (!isUuid(nid)) throw notFound("Alert not found");
  const [n] = await db().select({ patientId: notifications.patientId }).from(notifications).where(eq(notifications.id, nid));
  if (!n) throw notFound("Alert not found");
  return n.patientId;
}

export async function markRead(nid: string) {
  await db()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, nid), isNull(notifications.readAt)));
}
