"use client";
import useSWR from "swr";
import { useState } from "react";
import { api, fetcher } from "@/client/api";
import { ago } from "@/client/format";
import type { DeviceDto } from "@/lib/contracts/patients";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { PairingCodePanel } from "./PairingCodePanel";

const KIND_LABEL: Record<string, string> = {
  patient_display: "Laptop display",
  patient_phone: "Phone (location)",
};

export function isOnline(lastSeenAt: string | null) {
  return !!lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < 2 * 60_000;
}

export function DevicesPanel({ pid }: { pid: string }) {
  const { data, error, isLoading, mutate } = useSWR<{ devices: DeviceDto[] }>(`/api/patients/${pid}/devices`, fetcher, {
    refreshInterval: 5000,
  });
  const toast = useToast();
  const [confirming, setConfirming] = useState<string | null>(null);
  const active = data?.devices.filter((d) => !d.revokedAt) ?? [];

  async function revoke(id: string) {
    await api(`/api/patients/${pid}/devices/${id}`, { method: "DELETE" });
    setConfirming(null);
    toast("Device signed out", "success");
    mutate();
  }

  return (
    <div className="flex flex-col gap-5">
      <PairingCodePanel pid={pid} onPaired={() => mutate()} />
      {isLoading ? (
        <Skeleton className="h-20" />
      ) : error ? (
        <ErrorState onRetry={() => mutate()} />
      ) : active.length === 0 ? (
        <EmptyState title="No devices paired yet" body="Make a code above and type it on the patient's laptop or phone." />
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {active.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-semibold">{d.label}</p>
                <p className="text-sm text-ink-soft">
                  {KIND_LABEL[d.kind] ?? d.kind} ·{" "}
                  <span className={isOnline(d.lastSeenAt) ? "font-semibold text-leaf" : ""}>
                    {isOnline(d.lastSeenAt) ? "online" : `last seen ${ago(d.lastSeenAt)}`}
                  </span>
                </p>
              </div>
              {confirming === d.id ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="warn" onClick={() => revoke(d.id)}>
                    Yes, sign it out
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setConfirming(d.id)}>
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
