import "server-only";
import { env } from "@/server/env";

export type SendResult = { phoneE164: string; ok: boolean; error?: string };

/** Outbound messaging seam. Photon iMessage today; anything else later. */
export interface MessageSender {
  readonly name: string;
  sendMany(phones: string[], text: string): Promise<SendResult[]>;
}

export const SEND_TIMEOUT_MS = 10_000;

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<T>((_, rej) => {
      t = setTimeout(() => rej(new Error(`${what} timed out after ${ms / 1000}s`)), ms);
    }),
  ]);
}

/**
 * Photon Spectrum (spectrum-ts 12.x, cloud iMessage). Per batch:
 * Spectrum({projectId, projectSecret, providers:[imessage.config()]}) →
 * imessage(app).user(phone) → im.space.create(user) → space.send(text) → app.stop().
 */
export class PhotonMessageSender implements MessageSender {
  readonly name = "photon";
  constructor(
    private projectId: string,
    private projectSecret: string,
    private timeoutMs = SEND_TIMEOUT_MS,
  ) {}

  async sendMany(phones: string[], text: string): Promise<SendResult[]> {
    const { Spectrum } = await import("spectrum-ts");
    const { imessage } = await import("spectrum-ts/providers/imessage");
    let app: Awaited<ReturnType<typeof Spectrum>> | null = null;
    try {
      app = await withTimeout(
        Spectrum({ projectId: this.projectId, projectSecret: this.projectSecret, providers: [imessage.config()] }),
        this.timeoutMs,
        "Photon connect",
      );
    } catch (err) {
      const msg = (err as Error).message;
      return phones.map((p) => ({ phoneE164: p, ok: false, error: msg }));
    }
    try {
      const im = imessage(app);
      const results: SendResult[] = [];
      for (const phone of phones) {
        try {
          await withTimeout(
            (async () => {
              const user = await im.user(phone);
              const space = await im.space.create(user);
              await space.send(text);
            })(),
            this.timeoutMs,
            "Photon send",
          );
          results.push({ phoneE164: phone, ok: true });
        } catch (err) {
          results.push({ phoneE164: phone, ok: false, error: (err as Error).message.slice(0, 300) });
        }
      }
      return results;
    } finally {
      await app.stop().catch(() => {});
    }
  }
}

/** Used when Photon isn't configured or NOTIFY_MODE=in_app: nothing leaves the app. */
export class NoopSender implements MessageSender {
  readonly name = "noop";
  async sendMany(phones: string[]): Promise<SendResult[]> {
    return phones.map((p) => ({ phoneE164: p, ok: false, error: "Photon not set up" }));
  }
}

type Overrides = { mode?: "photon" | "in_app"; sender?: MessageSender };
const overrides: Overrides = {};

/** Tests only. */
export function setNotifyOverrides(o: Overrides) {
  Object.assign(overrides, o);
}
export function clearNotifyOverrides() {
  delete overrides.mode;
  delete overrides.sender;
}

export function notifyMode(): "photon" | "in_app" {
  return overrides.mode ?? env().notifyMode;
}

/**
 * Wraps a sender: numbers rejected as "not allowed" are registered with Photon
 * and retried once, so contacts added before auto-registration also work.
 */
export class RegisteringSender implements MessageSender {
  readonly name: string;
  constructor(
    private inner: MessageSender,
    private register: (phone: string) => Promise<"registered" | "already" | "skipped" | "failed">,
  ) {
    this.name = inner.name;
  }
  async sendMany(phones: string[], text: string): Promise<SendResult[]> {
    const first = await this.inner.sendMany(phones, text);
    const blocked = first.filter((r) => !r.ok && /not allowed|not registered/i.test(r.error ?? ""));
    if (!blocked.length) return first;
    const fixed: string[] = [];
    for (const b of blocked) {
      const reg = await this.register(b.phoneE164);
      if (reg === "registered" || reg === "already") fixed.push(b.phoneE164);
    }
    if (!fixed.length) return first;
    const retry = new Map((await this.inner.sendMany(fixed, text)).map((r) => [r.phoneE164, r]));
    return first.map((r) => retry.get(r.phoneE164) ?? r);
  }
}

export function messageSender(): MessageSender {
  if (overrides.sender) return overrides.sender;
  const e = env();
  if (notifyMode() === "photon" && e.SPECTRUM_PROJECT_ID && e.SPECTRUM_PROJECT_SECRET) {
    const photon = new PhotonMessageSender(e.SPECTRUM_PROJECT_ID, e.SPECTRUM_PROJECT_SECRET);
    if (!e.PHOTON_DASHBOARD_TOKEN) return photon;
    return new RegisteringSender(photon, async (phone) => {
      const { registerPhotonUser } = await import("./photon-users");
      return registerPhotonUser(phone, "Caregiver");
    });
  }
  return new NoopSender();
}
