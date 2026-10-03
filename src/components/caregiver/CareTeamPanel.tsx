"use client";
import useSWR from "swr";
import { useState, type FormEvent } from "react";
import { api, ApiClientError, fetcher } from "@/client/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/EmptyState";

type Member = { id: string; name: string; email: string; role: "owner" | "member" };

export function CareTeamPanel({ pid, canInvite }: { pid: string; canInvite: boolean }) {
  const { data, error, isLoading, mutate } = useSWR<{ caregivers: Member[] }>(`/api/patients/${pid}/caregivers`, fetcher);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/patients/${pid}/caregivers`, { method: "POST", json: { email: new FormData(form).get("email") } });
      form.reset();
      setMsg("Added to the care team.");
      mutate();
    } catch (err) {
      setMsg(err instanceof ApiClientError ? err.message : "Couldn't add them.");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <Skeleton className="h-16" />;
  if (error) return <ErrorState onRetry={() => mutate()} />;
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-2">
        {data?.caregivers.map((m) => (
          <li key={m.id} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm">
            <span className="font-semibold">{m.name}</span>{" "}
            <span className="text-ink-soft">{m.role === "owner" ? "(owner)" : ""}</span>
          </li>
        ))}
      </ul>
      {canInvite && (
        <form onSubmit={add} className="flex flex-wrap gap-2">
          <Input name="email" type="email" required placeholder="Co-caregiver's Waymax email" className="max-w-sm" />
          <Button type="submit" loading={busy} variant="secondary">
            Add co-caregiver
          </Button>
        </form>
      )}
      {msg && <p className="text-sm text-ink-soft">{msg}</p>}
    </div>
  );
}
