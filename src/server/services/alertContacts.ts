import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { alertContacts } from "@/server/db/schema";
import { conflict, notFound } from "@/server/http/errors";
import { isUuid } from "@/server/auth/guards";
import { notifyMode } from "@/server/notify";
import QRCode from "qrcode";
import { ensurePhotonUser, photonOptInUrl } from "@/server/notify/photon-users";
import type { AlertOptInDto } from "@/lib/contracts/alerts";

const cols = { id: alertContacts.id, name: alertContacts.name, phoneE164: alertContacts.phoneE164, notifyGeofence: alertContacts.notifyGeofence };

export async function listContacts(pid: string) {
  return db().select(cols).from(alertContacts).where(eq(alertContacts.patientId, pid)).orderBy(asc(alertContacts.createdAt));
}

export async function addContact(pid: string, input: { name: string; phoneE164: string; notifyGeofence: boolean }) {
  const rows = await db().insert(alertContacts).values({ patientId: pid, ...input }).onConflictDoNothing().returning(cols);
  if (!rows.length) throw conflict("That number is already on the list");
  // Shared Photon lines only text registered numbers, so register it right away.
  const reg = notifyMode() === "photon" ? await ensurePhotonUser(input.phoneE164, input.name) : { status: "skipped" as const, userId: null };
  return { ...rows[0]!, registration: reg.status, optIn: await optInFor(reg.userId, reg.status !== "skipped") };
}

/** `configured` is true whenever Photon alerts are on; a null url then means registering the number failed. */
async function optInFor(userId: string | null, configured = true): Promise<AlertOptInDto> {
  if (!userId) return { configured, url: null, qrSvg: null };
  const url = photonOptInUrl(userId);
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return { configured: true, url, qrSvg };
}

/** The scan-to-opt-in link + QR for a contact: registers the number on Photon first if needed. */
export async function contactOptIn(pid: string, cid: string): Promise<AlertOptInDto> {
  if (!isUuid(cid)) throw notFound("Contact not found");
  const [c] = await db()
    .select(cols)
    .from(alertContacts)
    .where(and(eq(alertContacts.id, cid), eq(alertContacts.patientId, pid)));
  if (!c) throw notFound("Contact not found");
  if (notifyMode() !== "photon") return { configured: false, url: null, qrSvg: null };
  const reg = await ensurePhotonUser(c.phoneE164, c.name);
  return optInFor(reg.userId, reg.status !== "skipped");
}

export async function deleteContact(pid: string, cid: string) {
  if (!isUuid(cid)) throw notFound("Contact not found");
  const rows = await db()
    .delete(alertContacts)
    .where(and(eq(alertContacts.id, cid), eq(alertContacts.patientId, pid)))
    .returning({ id: alertContacts.id });
  if (!rows.length) throw notFound("Contact not found");
}
