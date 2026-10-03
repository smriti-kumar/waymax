import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { alertContacts } from "@/server/db/schema";
import { conflict, notFound } from "@/server/http/errors";
import { isUuid } from "@/server/auth/guards";

const cols = { id: alertContacts.id, name: alertContacts.name, phoneE164: alertContacts.phoneE164, notifyGeofence: alertContacts.notifyGeofence };

export async function listContacts(pid: string) {
  return db().select(cols).from(alertContacts).where(eq(alertContacts.patientId, pid)).orderBy(asc(alertContacts.createdAt));
}

export async function addContact(pid: string, input: { name: string; phoneE164: string; notifyGeofence: boolean }) {
  const rows = await db().insert(alertContacts).values({ patientId: pid, ...input }).onConflictDoNothing().returning(cols);
  if (!rows.length) throw conflict("That number is already on the list");
  return rows[0]!;
}

export async function deleteContact(pid: string, cid: string) {
  if (!isUuid(cid)) throw notFound("Contact not found");
  const rows = await db()
    .delete(alertContacts)
    .where(and(eq(alertContacts.id, cid), eq(alertContacts.patientId, pid)))
    .returning({ id: alertContacts.id });
  if (!rows.length) throw notFound("Contact not found");
}
