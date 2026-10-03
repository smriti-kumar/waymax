"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiClientError } from "@/client/api";

function guessLabel() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android phone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Mac/.test(ua)) return "Mac laptop";
  if (/Windows/.test(ua)) return "Windows laptop";
  return "Patient device";
}

export function PairForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return setError("Type all 6 numbers.");
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ kind: string }>("/api/devices/pair", { method: "POST", json: { code, label: guessLabel() } });
      router.replace(r.kind === "patient_phone" ? "/phone" : "/patient");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "That didn't work. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col items-center gap-6">
      <label htmlFor="pair-code" className="text-[28px] font-semibold">
        Type the 6-digit code
      </label>
      <input
        id="pair-code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="w-full max-w-sm rounded-3xl border-4 border-sea bg-white px-4 py-5 text-center font-mono text-6xl tracking-[0.3em] text-ink focus:border-sea-deep"
        aria-describedby={error ? "pair-error" : undefined}
      />
      {error && (
        <p id="pair-error" role="alert" className="text-[24px] font-semibold text-sun-deep">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="min-h-[72px] w-full max-w-sm rounded-3xl border-4 border-sea-deep bg-sea px-8 text-[28px] font-bold text-white hover:bg-sea-deep disabled:opacity-60"
      >
        {busy ? "Connecting…" : "Connect"}
      </button>
    </form>
  );
}
