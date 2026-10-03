"use client";
import { useState, type FormEvent } from "react";
import { api, ApiClientError } from "@/client/api";
import type { MemoryDto } from "@/lib/contracts/people";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";

type Photo = { mediaId: string; url: string };

function MemoryForm({
  initial,
  photos,
  onSave,
  onCancel,
}: {
  initial?: MemoryDto;
  photos: Photo[];
  onSave: (v: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaId, setMediaId] = useState<string | null>(initial?.mediaId ?? null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError(null);
    try {
      await onSave({
        kind: mediaId ? "photo" : (f.get("kind") as string),
        title: f.get("title"),
        body: String(f.get("body") ?? "") || null,
        occurredOn: String(f.get("occurredOn") ?? "") || null,
        mediaId,
      });
      if (!initial) {
        form.reset();
        setMediaId(null);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-line bg-cream p-4 sm:grid-cols-2">
      <Field label="Title">
        <Input name="title" required maxLength={120} defaultValue={initial?.title} placeholder="Trip to Niagara Falls" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kind">
          <Select name="kind" defaultValue={initial?.kind ?? "story"}>
            <option value="story">Story</option>
            <option value="note">Note</option>
            <option value="photo">Photo</option>
          </Select>
        </Field>
        <Field label="When (optional)">
          <Input name="occurredOn" type="date" defaultValue={initial?.occurredOn ?? ""} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="The memory (optional)">
          <Textarea name="body" maxLength={2000} defaultValue={initial?.body ?? ""} placeholder="We took the boat ride and got soaked…" />
        </Field>
      </div>
      {photos.length > 0 && (
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-sm font-semibold">Photo (optional)</legend>
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <button
                type="button"
                key={p.mediaId}
                onClick={() => setMediaId(mediaId === p.mediaId ? null : p.mediaId)}
                aria-pressed={mediaId === p.mediaId}
                className={"rounded-xl border-4 " + (mediaId === p.mediaId ? "border-sea" : "border-transparent")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-16 w-16 rounded-lg object-cover" />
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={busy}>
          {initial ? "Save memory" : "Add memory"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {error && <p className="self-center font-medium text-sun-deep">{error}</p>}
      </div>
    </form>
  );
}

export function MemoriesEditor({
  personId,
  memories,
  photos,
  onChange,
}: {
  personId: string;
  memories: MemoryDto[];
  photos: Photo[];
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {memories.length === 0 ? (
        <EmptyState title="No memories yet" body="Add a few stories or photos. They're used for Memories mode." />
      ) : (
        <ul className="flex flex-col gap-3">
          {memories.map((m) =>
            editing === m.id ? (
              <li key={m.id}>
                <MemoryForm
                  initial={m}
                  photos={photos}
                  onCancel={() => setEditing(null)}
                  onSave={async (v) => {
                    await api(`/api/people/${personId}/memories/${m.id}`, { method: "PATCH", json: v });
                    setEditing(null);
                    onChange();
                  }}
                />
              </li>
            ) : (
              <li key={m.id} className="flex gap-3 rounded-2xl border border-line bg-white p-3">
                {m.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.photoUrl} alt="" className="h-20 w-20 flex-none rounded-xl object-cover" />
                )}
                <div className="flex flex-1 flex-col gap-1">
                  <p className="font-semibold">
                    {m.title}{" "}
                    <span className="text-sm font-normal text-ink-soft">
                      {m.kind}
                      {m.occurredOn ? ` · ${m.occurredOn}` : ""}
                    </span>
                  </p>
                  {m.body && <p className="text-ink-soft">{m.body}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(m.id)}>
                    Edit
                  </Button>
                  {confirmDel === m.id ? (
                    <Button
                      size="sm"
                      variant="warn"
                      onClick={async () => {
                        await api(`/api/people/${personId}/memories/${m.id}`, { method: "DELETE" });
                        setConfirmDel(null);
                        onChange();
                      }}
                    >
                      Confirm
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDel(m.id)}>
                      Delete
                    </Button>
                  )}
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      <MemoryForm
        photos={photos}
        onSave={async (v) => {
          await api(`/api/people/${personId}/memories`, { method: "POST", json: v });
          onChange();
        }}
      />
    </div>
  );
}
