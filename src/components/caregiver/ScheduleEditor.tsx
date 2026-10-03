"use client";
import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { api, ApiClientError, fetcher } from "@/client/api";
import type { ScheduleItemDto } from "@/lib/contracts/schedule";
import type { PersonSummary } from "@/lib/contracts/people";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Spinner";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const KINDS = [
  ["visit", "Visit"],
  ["activity", "Activity"],
  ["meal", "Meal"],
  ["therapy", "Therapy"],
  ["other", "Other"],
] as const;

function describe(i: ScheduleItemDto) {
  if (i.daysOfWeek && i.startTime) {
    const days = i.daysOfWeek.length === 7 ? "Every day" : i.daysOfWeek.map((d) => DAYS[d]).join(", ");
    return `${days} at ${i.startTime}`;
  }
  return i.startsAt ? new Date(i.startsAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";
}

/** "YYYY-MM-DDTHH:mm" from a datetime-local input, as an ISO string in the browser's offset. */
function localInputToIso(v: string) {
  return new Date(v).toISOString();
}

function ItemForm({
  people,
  initial,
  onSave,
  onCancel,
}: {
  people: PersonSummary[];
  initial?: ScheduleItemDto;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
}) {
  const [weekly, setWeekly] = useState(initial ? !!initial.daysOfWeek : true);
  const [days, setDays] = useState<number[]>(initial?.daysOfWeek ?? [1, 2, 3, 4, 5]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const form = e.currentTarget;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        kind: f.get("kind"),
        title: f.get("title"),
        personId: f.get("personId") || null,
        durationMin: Number(f.get("durationMin") || 60),
        notes: f.get("notes") || null,
      };
      if (weekly) {
        Object.assign(body, { daysOfWeek: days, startTime: f.get("startTime"), startsAt: null });
      } else {
        Object.assign(body, { startsAt: localInputToIso(String(f.get("startsAt"))), daysOfWeek: null, startTime: null });
      }
      await onSave(body);
      if (!initial) form.reset();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-line bg-cream p-4 sm:grid-cols-2">
      <Field label="What">
        <Input name="title" required maxLength={120} defaultValue={initial?.title} placeholder="Lunch" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kind">
          <Select name="kind" defaultValue={initial?.kind ?? "activity"}>
            {KINDS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="With (optional)">
          <Select name="personId" defaultValue={initial?.personId ?? ""}>
            <option value="">No one</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="text-sm font-semibold">When</legend>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={weekly ? "primary" : "secondary"} onClick={() => setWeekly(true)}>
            Every week
          </Button>
          <Button type="button" size="sm" variant={!weekly ? "primary" : "secondary"} onClick={() => setWeekly(false)}>
            One time
          </Button>
        </div>
        {weekly ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Days of the week">
              {DAYS.map((d, i) => (
                <button
                  type="button"
                  key={d}
                  aria-pressed={days.includes(i)}
                  onClick={() => setDays((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort()))}
                  className={
                    "rounded-lg px-3 py-2 text-sm font-semibold " +
                    (days.includes(i) ? "bg-sea text-white" : "border border-line bg-white text-ink-soft")
                  }
                >
                  {d}
                </button>
              ))}
            </div>
            <Field label="Time">
              <Input name="startTime" type="time" required defaultValue={initial?.startTime ?? "12:00"} />
            </Field>
          </div>
        ) : (
          <Field label="Date and time">
            <Input
              name="startsAt"
              type="datetime-local"
              required
              defaultValue={initial?.startsAt ? new Date(new Date(initial.startsAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""}
            />
          </Field>
        )}
      </fieldset>
      <Field label="Minutes">
        <Input name="durationMin" type="number" min={5} max={720} defaultValue={initial?.durationMin ?? 60} />
      </Field>
      <Field label="Notes (optional)">
        <Input name="notes" maxLength={500} defaultValue={initial?.notes ?? ""} />
      </Field>
      <div className="flex items-center gap-2 sm:col-span-2">
        <Button type="submit" loading={busy}>
          {initial ? "Save" : "Add to schedule"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {error && <p className="font-medium text-sun-deep">{error}</p>}
      </div>
    </form>
  );
}

export function ScheduleEditor({ pid }: { pid: string }) {
  const key = `/api/patients/${pid}/schedule`;
  const { data, error, isLoading, mutate } = useSWR<{ items: ScheduleItemDto[] }>(key, fetcher);
  const { data: ppl } = useSWR<{ people: PersonSummary[] }>(`/api/patients/${pid}/people?status=approved`, fetcher);
  const [editing, setEditing] = useState<string | null>(null);
  const people = ppl?.people ?? [];

  return (
    <>
      <Card>
        <CardTitle className="mb-4">Schedule</CardTitle>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : error ? (
          <ErrorState onRetry={() => mutate()} />
        ) : !data?.items.length ? (
          <EmptyState title="Nothing scheduled" body="Add meals, visits and activities. They show on the patient's Today card." />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.items.map((i) =>
              editing === i.id ? (
                <li key={i.id}>
                  <ItemForm
                    people={people}
                    initial={i}
                    onCancel={() => setEditing(null)}
                    onSave={async (body) => {
                      await api(`${key}/${i.id}`, { method: "PATCH", json: body });
                      setEditing(null);
                      mutate();
                    }}
                  />
                </li>
              ) : (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white px-4 py-3">
                  <div>
                    <p className="font-semibold">
                      {i.title}
                      {i.personName ? ` · with ${i.personName}` : ""}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {describe(i)} · {i.durationMin} min · {i.kind}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(i.id)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await api(`${key}/${i.id}`, { method: "DELETE" });
                        mutate();
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </Card>
      <Card>
        <CardTitle className="mb-4">Add to the schedule</CardTitle>
        <ItemForm
          people={people}
          onSave={async (body) => {
            await api(key, { method: "POST", json: body });
            mutate();
          }}
        />
      </Card>
    </>
  );
}
