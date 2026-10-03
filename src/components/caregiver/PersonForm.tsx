"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { ApiClientError } from "@/client/api";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";

export type PersonFields = {
  name: string;
  relationship: string;
  spokenName: string | null;
  description: string | null;
  visitRoutine: string | null;
};

export const RELATIONSHIP_HINTS = ["daughter", "son", "wife", "husband", "grandchild", "sister", "brother", "friend", "neighbor", "nurse", "doctor"];

export function PersonForm({
  initial,
  submitLabel,
  onSubmit,
  extra,
  compact,
}: {
  initial?: Partial<PersonFields>;
  submitLabel: string;
  onSubmit: (v: PersonFields) => Promise<void>;
  extra?: (current: { name: string; relationship: string; spokenName: string }) => ReactNode;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [relationship, setRelationship] = useState(initial?.relationship ?? "");
  const [spokenName, setSpokenName] = useState(initial?.spokenName ?? "");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        relationship: relationship.trim(),
        spokenName: spokenName.trim() || null,
        description: String(f.get("description") ?? "").trim() || null,
        visitRoutine: String(f.get("visitRoutine") ?? "").trim() || null,
      });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="Priya" />
      </Field>
      <Field label="Relationship to the patient">
        <Input
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          required
          maxLength={60}
          placeholder="daughter"
          list="relationship-hints"
        />
        <datalist id="relationship-hints">
          {RELATIONSHIP_HINTS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </Field>
      {!compact && (
        <>
          <Field label="How to say the name (optional)" hint="Spelled how it sounds, e.g. PREE-yah">
            <Input value={spokenName} onChange={(e) => setSpokenName(e.target.value)} maxLength={80} />
          </Field>
          <Field label="Visit routine (optional)">
            <Input name="visitRoutine" defaultValue={initial?.visitRoutine ?? ""} maxLength={300} placeholder="Visits Sundays after lunch" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="About them (optional)">
              <Textarea name="description" defaultValue={initial?.description ?? ""} maxLength={1000} />
            </Field>
          </div>
        </>
      )}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
        {extra?.({ name, relationship, spokenName })}
        {error && (
          <p role="alert" className="font-medium text-sun-deep">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
