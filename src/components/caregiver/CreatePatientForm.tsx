"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiClientError } from "@/client/api";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { TIMEZONES } from "@/lib/timezones";

export function CreatePatientForm({ onDone }: { onDone?: (id: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guess = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/New_York";

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const { patient } = await api<{ patient: { id: string } }>("/api/patients", {
        method: "POST",
        json: { name: f.get("name"), preferredName: f.get("preferredName"), timezone: f.get("timezone") },
      });
      if (onDone) onDone(patient.id);
      else router.push(`/caregiver/${patient.id}/setup`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't add the patient. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name">
        <Input name="name" required maxLength={100} placeholder="Margaret Lee" />
      </Field>
      <Field label="What they like to be called">
        <Input name="preferredName" required maxLength={60} placeholder="Maggie" />
      </Field>
      <Field label="Time zone">
        <Select name="timezone" defaultValue={TIMEZONES.includes(guess) ? guess : "America/New_York"}>
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex items-end">
        <Button type="submit" loading={busy} className="w-full">
          Add patient
        </Button>
      </div>
      {error && (
        <p role="alert" className="font-medium text-sun-deep sm:col-span-2">
          {error}
        </p>
      )}
    </form>
  );
}
