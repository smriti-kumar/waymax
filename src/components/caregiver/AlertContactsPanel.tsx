"use client";
import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { api, ApiClientError, fetcher } from "@/client/api";
import type { AlertContactDto, AlertOptInDto } from "@/lib/contracts/alerts";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Spinner";

type TestResult = { phoneE164: string; status: "sent" | "failed" | "skipped"; error?: string };
type OptIn = { name: string; url: string; qrSvg: string };

export function AlertContactsPanel({ pid }: { pid: string }) {
  const key = `/api/patients/${pid}/alert-contacts`;
  const { data, error, isLoading, mutate } = useSWR<{ contacts: AlertContactDto[] }>(key, fetcher);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "warn"; text: string; results?: TestResult[] } | null>(null);
  const [optIn, setOptIn] = useState<OptIn | null>(null);

  /** Shows the QR card, or a message saying why there isn't one. Returns true when the card is shown. */
  function showOptIn(name: string, o: AlertOptInDto) {
    if (o.url && o.qrSvg) {
      setOptIn({ name, url: o.url, qrSvg: o.qrSvg });
      return true;
    }
    setMsg(
      o.configured
        ? { tone: "warn", text: `We couldn't set up ${name}'s number for texts right now. Try Show QR again in a minute.` }
        : { tone: "warn", text: "Text alerts aren't switched on yet — alerts show here in the app for now." },
    );
    return false;
  }

  async function openQr(c: AlertContactDto) {
    setBusy(`qr-${c.id}`);
    setMsg(null);
    try {
      const o = await api<AlertOptInDto>(`${key}/${c.id}/opt-in`);
      showOptIn(c.name, o);
    } catch (err) {
      setMsg({ tone: "warn", text: err instanceof ApiClientError ? err.message : "Couldn't load the code" });
    } finally {
      setBusy(null);
    }
  }

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy("add");
    setMsg(null);
    try {
      const r = await api<{ contact: AlertContactDto & { registration?: string; optIn?: AlertOptInDto } }>(key, {
        method: "POST",
        json: { name: f.get("name"), phoneE164: String(f.get("phone")).replace(/[\s()-]/g, ""), notifyGeofence: true },
      });
      form.reset();
      const reg = r.contact.registration;
      if (r.contact.optIn?.configured) showOptIn(r.contact.name, r.contact.optIn);
      else if (reg === "registered" || reg === "already") setMsg({ tone: "ok", text: "Added. This number is ready for text alerts." });
      else if (reg === "failed") setMsg({ tone: "warn", text: "Added. We couldn't set this number up for texts yet — we'll try again when an alert is sent." });
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
          ? { tone: "ok", text: "Test message sent. Check the phones.", results: r.results }
          : { tone: "warn", text: r.message ?? "Text alerts aren't switched on yet — alerts show here in the app for now." },
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
        <ul className="divide-y divide-line rounded-2xl border-2 border-line bg-white">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="font-semibold">{c.name}</span> <span className="text-ink-soft">{c.phoneE164}</span>
              </span>
              <span className="flex gap-2">
                <Button size="sm" variant="ghost" loading={busy === `qr-${c.id}`} onClick={() => openQr(c)}>
                  Show QR
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await api(`${key}/${c.id}`, { method: "DELETE" });
                    if (optIn?.name === c.name) setOptIn(null);
                    mutate();
                  }}
                >
                  Remove
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {optIn && <OptInCard optIn={optIn} onClose={() => setOptIn(null)} />}
      <form onSubmit={add} className="flex flex-col gap-1">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Name">
            <Input name="name" required maxLength={80} placeholder="Raj" />
          </Field>
          <Field label="iPhone number">
            <Input name="phone" type="tel" required placeholder="+16075551234" />
          </Field>
          <Button type="submit" loading={busy === "add"} variant="secondary" className="h-[46px]">
            Add number
          </Button>
        </div>
        <p className="text-sm text-ink-soft">Include the country code, like +1 for the US.</p>
      </form>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={test} loading={busy === "test"} disabled={!contacts.length}>
          Send test message
        </Button>
      </div>
      {msg && (
        <div role="status" className={"rounded-xl px-4 py-3 " + (msg.tone === "ok" ? "bg-leaf-wash text-leaf" : "bg-sun-wash text-sun-deep")}>
          <p className="font-semibold">{msg.text}</p>
          {msg.results && (
            <ul className="mt-1 text-sm">
              {msg.results.map((r) => {
                const who = contacts.find((c) => c.phoneE164 === r.phoneE164)?.name ?? r.phoneE164;
                return (
                  <li key={r.phoneE164}>
                    {r.status === "sent" ? "✓" : r.status === "skipped" ? "–" : "✕"} {who}:{" "}
                    {r.status === "sent" ? "delivered" : r.status === "skipped" ? "not sent" : (r.error ?? "didn't go through")}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** One scan from the contact's iPhone opens Messages to their alert line with a text ready; sending it opts them in. */
function OptInCard({ optIn, onClose }: { optIn: OptIn; onClose: () => void }) {
  return (
    <section aria-label={`Connect ${optIn.name}`} className="flex flex-col items-center gap-4 rounded-2xl border-2 border-sea bg-white p-5 text-center sm:flex-row sm:text-left">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`data:image/svg+xml;utf8,${encodeURIComponent(optIn.qrSvg)}`}
        alt={`QR code to turn on text alerts for ${optIn.name}`}
        className="h-44 w-44 shrink-0"
      />
      <div className="flex flex-col gap-2">
        <p className="text-lg font-semibold">One last step for {optIn.name}</p>
        <p className="text-ink-soft">
          Scan this with {optIn.name}&apos;s iPhone camera. Messages opens with a text ready — tap <strong>Send</strong> and alerts are on.
        </p>
        <p className="text-sm text-ink-soft">
          On that iPhone already?{" "}
          <a href={optIn.url} className="font-semibold text-sea-deep underline">
            Open Messages
          </a>
        </p>
        <div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </section>
  );
}
