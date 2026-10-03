"use client";
import { useState, type FormEvent } from "react";
import { api, ApiClientError } from "@/client/api";
import { ago } from "@/client/format";
import type { PersonSummary } from "@/lib/contracts/people";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { RELATIONSHIP_HINTS } from "./PersonForm";

export function ApprovalCard({
  person,
  existing,
  onDone,
}: {
  person: PersonSummary;
  existing: PersonSummary[];
  onDone: (msg: string) => void;
}) {
  const [busy, setBusy] = useState<null | "approve" | "reject" | "merge">(null);
  const [error, setError] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState("");

  async function run(kind: "approve" | "reject" | "merge", fn: () => Promise<unknown>, msg: string) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
      onDone(msg);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong");
      setBusy(null);
    }
  }

  function approve(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    void run(
      "approve",
      () =>
        api(`/api/people/${person.id}`, {
          method: "PATCH",
          json: { name, relationship: f.get("relationship"), status: "approved" },
        }),
      `${name} approved. They'll be recognized next time.`,
    );
  }

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-4 sm:flex-row" data-testid="approval-card">
      {person.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.photoUrl} alt="Face seen by the patient's camera" className="h-40 w-40 flex-none rounded-2xl object-cover" />
      ) : (
        <div className="flex h-40 w-40 flex-none items-center justify-center rounded-2xl bg-sand text-ink-soft">No photo</div>
      )}
      <div className="flex flex-1 flex-col gap-3">
        <p className="text-sm text-ink-soft">Seen {ago(person.createdAt)} · added from the patient&apos;s screen</p>
        <form onSubmit={approve} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Name">
            <Input name="name" required maxLength={80} placeholder="Who is this?" />
          </Field>
          <Field label="Relationship">
            <Input name="relationship" required maxLength={60} list="approval-rel" placeholder="neighbor" />
            <datalist id="approval-rel">
              {RELATIONSHIP_HINTS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>
          <Button type="submit" loading={busy === "approve"}>
            Approve
          </Button>
        </form>
        <div className="flex flex-wrap items-end gap-3 border-t border-line pt-3">
          {existing.length > 0 && (
            <>
              <Field label="Or it's someone already added">
                <Select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} aria-label="Merge into">
                  <option value="">Choose a person…</option>
                  {existing.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.relationship})
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                variant="secondary"
                disabled={!mergeTarget}
                loading={busy === "merge"}
                onClick={() =>
                  run(
                    "merge",
                    () => api(`/api/people/${person.id}/merge`, { method: "POST", json: { intoPersonId: mergeTarget } }),
                    "Added as another face sample.",
                  )
                }
              >
                Merge
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            loading={busy === "reject"}
            onClick={() =>
              run("reject", () => api(`/api/people/${person.id}`, { method: "PATCH", json: { status: "rejected" } }), "Dismissed.")
            }
          >
            Reject
          </Button>
        </div>
        {error && <p className="font-medium text-sun-deep">{error}</p>}
      </div>
    </li>
  );
}
