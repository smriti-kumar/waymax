"use client";
import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { api, ApiClientError, fetcher } from "@/client/api";
import { TIMEZONES } from "@/lib/timezones";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Spinner";

type P = { patient: { name: string; preferredName: string; timezone: string; homeLabel: string } };

export function AboutPatientForm({ pid, onSaved }: { pid: string; onSaved: () => void }) {
  const { data } = useSWR<P>(`/api/patients/${pid}`, fetcher);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!data) return <Skeleton className="h-32" />;
  const p = data.patient;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api(`/api/patients/${pid}`, {
        method: "PATCH",
        json: { name: f.get("name"), preferredName: f.get("preferredName"), timezone: f.get("timezone"), homeLabel: f.get("homeLabel") },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name">
        <Input name="name" required defaultValue={p.name} maxLength={100} />
      </Field>
      <Field label="What they like to be called" hint="Used on every patient screen and spoken aloud">
        <Input name="preferredName" required defaultValue={p.preferredName} maxLength={60} />
      </Field>
      <Field label="Time zone">
        <Select name="timezone" defaultValue={p.timezone}>
          {(TIMEZONES.includes(p.timezone) ? TIMEZONES : [p.timezone, ...TIMEZONES]).map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="What they call home" hint='Shown as "You are at …"'>
        <Input name="homeLabel" required defaultValue={p.homeLabel} maxLength={60} />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" loading={busy}>
          Save and continue
        </Button>
        {error && <p className="font-medium text-sun-deep">{error}</p>}
      </div>
    </form>
  );
}
