"use client";
import useSWR from "swr";
import { api, fetcher } from "@/client/api";
import { Choices } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

const DEFAULT = Number(process.env.NEXT_PUBLIC_FACE_MATCH_THRESHOLD ?? 0.68) || 0.68;

// Three plain choices instead of a fine-grained slider; "Balanced" is the default threshold.
const LEVELS = [
  { value: "0.62", label: "Relaxed", help: "Recognizes family more easily, but may mistake strangers for family." },
  { value: "default", label: "Balanced", help: "The recommended setting." },
  { value: "0.76", label: "Strict", help: "Fewer wrong matches, but may miss people in poor light." },
];

/** Face-recognition strictness for this patient's laptop (higher = fewer wrong matches). */
export function StrictnessSetting({ pid }: { pid: string }) {
  const { data, mutate } = useSWR<{ patient: { faceMatchThreshold: number | null } }>(`/api/patients/${pid}`, fetcher);
  const toast = useToast();
  const saved = data?.patient.faceMatchThreshold ?? null;
  const current = saved === null ? "default" : String(saved);
  const custom = !LEVELS.some((l) => l.value === current);
  const options = [
    ...LEVELS.map(({ value, label }) => ({ value, label })),
    ...(custom ? [{ value: current, label: `Custom (${Math.round(Number(current) * 100)}%)` }] : []),
  ];

  async function save(next: string) {
    await api(`/api/patients/${pid}`, { method: "PATCH", json: { faceMatchThreshold: next === "default" ? null : Number(next) } });
    await mutate();
    toast("Recognition setting saved. The laptop picks it up within a minute.", "success");
  }

  return (
    <div className="flex flex-col gap-3">
      <Choices label="How sure should the laptop be before naming someone?" name="strictness" value={current} onChange={save} options={options} />
      <p className="text-ink-soft">
        {LEVELS.find((l) => l.value === current)?.help ?? `A custom setting (${Math.round(DEFAULT * 100)}% is the default).`}
      </p>
      <p className="text-ink-soft">
        If strangers are recognized as family, choose Strict. If family members aren&apos;t recognized, add more photos first, then try Relaxed.
      </p>
    </div>
  );
}
