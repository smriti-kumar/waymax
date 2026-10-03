"use client";
import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/client/api";
import { Button } from "@/components/ui/Button";

type Kind = "patient_display" | "patient_phone";
const LABEL: Record<Kind, string> = { patient_display: "Patient laptop", patient_phone: "Patient phone" };

export function PairingCodePanel({ pid, onPaired }: { pid: string; onPaired?: () => void }) {
  const [codes, setCodes] = useState<Partial<Record<Kind, { code: string; expiresAt: string }>>>({});
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!onPaired || !Object.keys(codes).length) return;
    const t = setInterval(() => {
      if (!document.hidden) onPaired();
    }, 5000);
    return () => clearInterval(t);
  }, [codes, onPaired]);

  async function make(kind: Kind) {
    setBusy(kind);
    setError(null);
    try {
      const r = await api<{ code: string; expiresAt: string }>(`/api/patients/${pid}/pairing-codes`, {
        method: "POST",
        json: { deviceKind: kind },
      });
      setCodes((c) => ({ ...c, [kind]: r }));
      setNow(new Date(r.expiresAt).getTime() - 10 * 60_000);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't make a code");
    } finally {
      setBusy(null);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {(Object.keys(LABEL) as Kind[]).map((kind) => {
        const c = codes[kind];
        const left = c ? Math.max(0, new Date(c.expiresAt).getTime() - now) : 0;
        const live = c && left > 0;
        return (
          <div key={kind} className="flex flex-col gap-3 rounded-2xl border-2 border-line bg-cream p-4">
            <p className="font-semibold">{LABEL[kind]}</p>
            {live ? (
              <>
                <p
                  className="font-mono text-5xl font-bold tracking-[0.25em] text-sea-deep"
                  data-testid={`pair-code-${kind}`}
                  aria-label={`Pairing code ${c.code.split("").join(" ")}`}
                >
                  {c.code}
                </p>
                <p className="text-sm text-ink-soft">
                  On the {kind === "patient_display" ? "laptop (Chrome)" : "iPhone (Safari)"}, open{" "}
                  <span className="font-semibold">{origin}/pair</span> and type this code. Works once, for{" "}
                  {Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, "0")} more.
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-soft">
                {c ? "That code expired." : "Make a one-time code, then type it on the device."}
              </p>
            )}
            <Button variant={live ? "secondary" : "primary"} loading={busy === kind} onClick={() => make(kind)}>
              {live ? "New code" : `Pair ${LABEL[kind].toLowerCase()}`}
            </Button>
          </div>
        );
      })}
      {error && <p className="font-semibold text-sun-deep sm:col-span-2">{error}</p>}
    </div>
  );
}
