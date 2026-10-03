"use client";
import { useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/client/api";
import { useToast } from "@/components/ui/Toast";

const DEFAULT = Number(process.env.NEXT_PUBLIC_FACE_MATCH_THRESHOLD ?? 0.68) || 0.68;

/** Face-recognition strictness for this patient's laptop (higher = fewer wrong matches). */
export function StrictnessSetting({ pid }: { pid: string }) {
  const { data, mutate } = useSWR<{ patient: { faceMatchThreshold: number | null } }>(`/api/patients/${pid}`, fetcher);
  const toast = useToast();
  const saved = data?.patient.faceMatchThreshold ?? DEFAULT;
  const [value, setValue] = useState<number | null>(null);
  const v = value ?? saved;

  async function save(next: number | null) {
    await api(`/api/patients/${pid}`, { method: "PATCH", json: { faceMatchThreshold: next } });
    setValue(null);
    await mutate();
    toast("Recognition setting saved. The laptop picks it up within a minute.", "success");
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">
          Recognition strictness: {Math.round(v * 100)}%{" "}
          <span className="font-normal text-ink-soft">
            {v >= 0.75 ? "(very strict — may miss people in poor light)" : v <= 0.6 ? "(relaxed — may mistake strangers for family)" : "(balanced)"}
          </span>
        </span>
        <input
          type="range"
          min={0.5}
          max={0.9}
          step={0.01}
          value={v}
          onChange={(e) => setValue(Number(e.target.value))}
          className="accent-sea"
          aria-label="Recognition strictness"
        />
      </label>
      <p className="text-sm text-ink-soft">
        If strangers are recognized as family, move this up. If family members aren&apos;t recognized, add more photos first, then move it down a little.
      </p>
      <div className="flex gap-2">
        <button
          disabled={value === null}
          onClick={() => save(v)}
          className="rounded-lg bg-sea px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Save
        </button>
        <button onClick={() => save(null)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-sand">
          Reset to default ({Math.round(DEFAULT * 100)}%)
        </button>
      </div>
    </div>
  );
}
