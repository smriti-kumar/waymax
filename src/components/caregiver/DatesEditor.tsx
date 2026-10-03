"use client";
import { useState, type FormEvent } from "react";
import { api, ApiClientError } from "@/client/api";
import { MONTHS, formatMonthDay } from "@/lib/dates";
import type { PersonDateDto } from "@/lib/contracts/dates";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";

const KIND_LABEL = { birthday: "Birthday", anniversary: "Anniversary", other: "Other" } as const;

/** Birthdays, anniversaries and other yearly dates for one person. */
export function DatesEditor({ personId, dates, onChange }: { personId: string; dates: PersonDateDto[]; onChange: () => void }) {
  const [kind, setKind] = useState<PersonDateDto["kind"]>("birthday");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError(null);
    try {
      await api(`/api/people/${personId}/dates`, {
        method: "POST",
        json: {
          kind,
          label: String(f.get("label") ?? "") || null,
          month: Number(f.get("month")),
          day: Number(f.get("day")),
          year: f.get("year") ? Number(f.get("year")) : null,
        },
      });
      form.reset();
      onChange();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {dates.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {dates.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-2">
              <span>
                <span className="font-semibold">{d.label ?? KIND_LABEL[d.kind]}</span>{" "}
                <span className="text-ink-soft">
                  · {formatMonthDay(d)}
                  {d.year ? `, ${d.year}` : ""}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await api(`/api/people/${personId}/dates/${d.id}`, { method: "DELETE" });
                  onChange();
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-soft">No dates yet. On the day, the patient&apos;s screen gently mentions it.</p>
      )}
      <form onSubmit={add} className="grid items-end gap-3 rounded-2xl border border-line bg-cream p-4 sm:grid-cols-[auto_1fr_auto_auto_auto_auto]">
        <Field label="Kind">
          <Select value={kind} onChange={(e) => setKind(e.target.value as PersonDateDto["kind"])}>
            <option value="birthday">Birthday</option>
            <option value="anniversary">Anniversary</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label={kind === "birthday" ? "Label (optional)" : "What is it?"}>
          <Input name="label" maxLength={120} required={kind === "other"} placeholder={kind === "anniversary" ? "Raj and Anita's wedding anniversary" : ""} />
        </Field>
        <Field label="Month">
          <Select name="month" defaultValue="1">
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Day">
          <Input name="day" type="number" min={1} max={31} required className="w-20" />
        </Field>
        <Field label="Year (optional)">
          <Input name="year" type="number" min={1900} max={2100} className="w-28" />
        </Field>
        <Button type="submit" loading={busy}>
          Add date
        </Button>
        {error && <p className="font-medium text-sun-deep sm:col-span-6">{error}</p>}
      </form>
    </div>
  );
}
