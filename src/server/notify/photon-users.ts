import "server-only";
import { env } from "@/server/env";

// Photon's shared iMessage lines (Free/Pro) only message numbers registered as
// project users. This registers them automatically, through the same dashboard
// API the official `photon` CLI uses (POST /api/projects/{id}/spectrum/users).
// Once a user exists, Photon's public redirect (GET {REDIRECT_HOST}/users/{id}/redirect?msg=…)
// 302s to `sms:<their assigned line>&body=…`; we put it in a QR code so the contact
// opts in with one scan + Send. No webhook is involved.

export type Registration = "registered" | "already" | "skipped" | "failed";
const HOST = "https://app.photon.codes";
const REDIRECT_HOST = "https://spectrum.photon.codes";
export const OPT_IN_TEXT = "Hi! Please send me Waymax alerts.";
const TIMEOUT_MS = 10_000;

function creds() {
  const e = env();
  if (!e.SPECTRUM_PROJECT_ID || !e.PHOTON_DASHBOARD_TOKEN) return null;
  return { projectId: e.SPECTRUM_PROJECT_ID, token: e.PHOTON_DASHBOARD_TOKEN, host: e.PHOTON_API_HOST || HOST };
}

async function call(path: string, init: RequestInit = {}) {
  const c = creds()!;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${c.host}/api/projects/${c.projectId}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${c.token}`, "content-type": "application/json", ...init.headers },
      signal: ac.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

const digits = (p: string) => p.replace(/\D/g, "");

type PhotonUser = { id: string; phoneNumber?: string | null };

async function listPhotonUsers(): Promise<PhotonUser[]> {
  const res = await call("/spectrum/users");
  if (!res.ok) throw new Error(`Photon users list HTTP ${res.status}`);
  const data = (await res.json()) as { users?: PhotonUser[] } | PhotonUser[];
  return Array.isArray(data) ? data : (data.users ?? []);
}

/** Phone numbers already registered on the Photon project. */
export async function listPhotonUserPhones(): Promise<string[]> {
  if (!creds()) return [];
  return (await listPhotonUsers()).map((u) => u.phoneNumber ?? "").filter(Boolean);
}

/**
 * Makes sure `phoneE164` is a project user (so the shared line may message it) and
 * returns its Photon user id when known. Never throws.
 */
export async function ensurePhotonUser(phoneE164: string, name: string): Promise<{ status: Registration; userId: string | null }> {
  if (!creds()) return { status: "skipped", userId: null };
  try {
    const existing = await listPhotonUsers().catch(() => [] as PhotonUser[]);
    const found = existing.find((u) => digits(u.phoneNumber ?? "") === digits(phoneE164));
    if (found) return { status: "already", userId: found.id ?? null };
    const [firstName, ...rest] = name.trim().split(/\s+/);
    const res = await call("/spectrum/users", {
      method: "POST",
      // Photon requires a last name and an email; we collect neither, so fill placeholders
      // (example.com is reserved, and sendInvite:false means nothing is emailed).
      body: JSON.stringify({
        firstName: firstName || "Caregiver",
        lastName: rest.join(" ") || "Waymax",
        email: `alerts+${digits(phoneE164)}@example.com`,
        phoneNumber: phoneE164,
        sendInvite: false,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; user?: { id?: string } };
    if (res.ok && body.success) return { status: "registered", userId: body.user?.id ?? null };
    if (body.error && /exist|duplicate|already/i.test(body.error)) return { status: "already", userId: null };
    console.warn(`[photon] register user failed: HTTP ${res.status} ${body.error ?? ""}`);
    return { status: "failed", userId: null };
  } catch (err) {
    console.warn(`[photon] register user failed: ${(err as Error).message}`);
    return { status: "failed", userId: null };
  }
}

/** Registers `phoneE164` as a project user so the shared line may message it. Never throws. */
export async function registerPhotonUser(phoneE164: string, name: string): Promise<Registration> {
  return (await ensurePhotonUser(phoneE164, name)).status;
}

/** Photon-hosted link that opens Messages to the user's assigned line with `text` ready to send. */
export function photonOptInUrl(userId: string, text = OPT_IN_TEXT) {
  return `${REDIRECT_HOST}/users/${encodeURIComponent(userId)}/redirect?msg=${encodeURIComponent(text)}`;
}

/** True when a send error means "this number isn't on the project's allowlist yet". */
export const isNotAllowed = (error?: string | null) => !!error && /not allowed|not registered/i.test(error);
