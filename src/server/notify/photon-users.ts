import "server-only";
import { env } from "@/server/env";

// Photon's shared iMessage lines (Free/Pro) only message numbers registered as
// project users. This registers them automatically, through the same dashboard
// API the official `photon` CLI uses (POST /api/projects/{id}/spectrum/users).

export type Registration = "registered" | "already" | "skipped" | "failed";
const HOST = "https://app.photon.codes";
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

/** Phone numbers already registered on the Photon project. */
export async function listPhotonUserPhones(): Promise<string[]> {
  if (!creds()) return [];
  const res = await call("/spectrum/users");
  if (!res.ok) throw new Error(`Photon users list HTTP ${res.status}`);
  const data = (await res.json()) as { users?: { phoneNumber?: string | null }[] } | { phoneNumber?: string | null }[];
  const users = Array.isArray(data) ? data : (data.users ?? []);
  return users.map((u) => u.phoneNumber ?? "").filter(Boolean);
}

/** Registers `phoneE164` as a project user so the shared line may message it. Never throws. */
export async function registerPhotonUser(phoneE164: string, name: string): Promise<Registration> {
  if (!creds()) return "skipped";
  try {
    const existing = await listPhotonUserPhones().catch(() => [] as string[]);
    if (existing.some((p) => digits(p) === digits(phoneE164))) return "already";
    const [firstName, ...rest] = name.trim().split(/\s+/);
    const res = await call("/spectrum/users", {
      method: "POST",
      body: JSON.stringify({ firstName: firstName || "Caregiver", lastName: rest.join(" ") || undefined, phoneNumber: phoneE164, sendInvite: false }),
    });
    const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
    if (res.ok && body.success) return "registered";
    if (body.error && /exist|duplicate|already/i.test(body.error)) return "already";
    console.warn(`[photon] register user failed: HTTP ${res.status} ${body.error ?? ""}`);
    return "failed";
  } catch (err) {
    console.warn(`[photon] register user failed: ${(err as Error).message}`);
    return "failed";
  }
}

/** True when a send error means "this number isn't on the project's allowlist yet". */
export const isNotAllowed = (error?: string | null) => !!error && /not allowed|not registered/i.test(error);
