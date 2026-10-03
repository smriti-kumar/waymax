"use client";
import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { api, ApiClientError, fetcher } from "@/client/api";
import type { AlertContactDto } from "@/lib/contracts/alerts";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Spinner";

type TestResult = { phoneE164: string; status: "sent" | "failed" | "skipped"; error?: string };

export function AlertContactsPanel({ pid }: { pid: string }) {
  const key = `/api/patients/${pid}/alert-contacts`;
  const { data, error, isLoading, mutate } = useSWR<{ contacts: AlertContactDto[] }>(key, fetcher);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string; results?: TestResult[] } | null>(null);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy("add");
    setMsg(null);
    try {
      await api(key, {
        method: "POST",
        json: { name: f.get("name"), phoneE164: String(f.get("phone")).replace(/[\s()-]/g, ""), notifyGeofence: true },
      });
      form.reset();
      mutate();
    } catch (err) {
      setMsg({ tone: "warn", text: err instanceof ApiClientError ? err.message : "Couldn't add" });
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    setMsg(null);
    try {
      const r = await api<{ configured: boolean; results: TestResult[]; message?: string }>(`${key}/test`, { method: "POST" });
      setMsg(
        r.configured
          ? { tone: "ok", text: "Test iMessage sent. Check the phones.", results: r.results }
          : { tone: "warn", text: r.message ?? "Photon not set up yet — alerts show here in the app only." },
      );
    } catch (err) {
      const e = err as ApiClientError;
      const results = (e.details as { results?: TestResult[] } | undefined)?.results;
      setMsg({ tone: "warn", text: e.message ?? "Couldn't send", results });
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) return <Skeleton className="h-24" />;
  if (error) return <ErrorState onRetry={() => mutate()} />;
  const contacts = data?.contacts ?? [];
  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-soft">These numbers get an iMessage when the patient leaves or returns to the safe area.</p>
      {contacts.length === 0 ? (
        <EmptyState title="No alert numbers yet" body="Add at least one iPhone number below." />
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="font-semibold">{c.name}</span> <span className="text-ink-soft">{c.phoneE164}</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await api(`${key}/${c.id}`, { method: "DELETE" });
                  mutate();
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Name">
          <Input name="name" required maxLength={80} placeholder="Raj" />
        </Field>
        <Field label="iPhone number" hint="With country code, like +16075551234">
          <Input name="phone" type="tel" required placeholder="+1…" />
        </Field>
        <Button type="submit" loading={busy === "add"} variant="secondary">
          Add number
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={test} loading={busy === "test"} disabled={!contacts.length}>
          Send test iMessage
        </Button>
      </div>
      {msg && (
        <div role="status" className={"rounded-xl px-4 py-3 " + (msg.tone === "ok" ? "bg-[#e4efdc] text-leaf" : "bg-[#fff6e6] text-sun-deep")}>
          <p className="font-semibold">{msg.text}</p>
          {msg.results && (
            <ul className="mt-1 text-sm">
              {msg.results.map((r) => (
                <li key={r.phoneE164}>
                  {r.phoneE164}: {r.status}
                  {r.error ? ` — ${r.error}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
