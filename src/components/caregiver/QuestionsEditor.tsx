"use client";
import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { api, ApiClientError, fetcher } from "@/client/api";
import { speak } from "@/client/speech/speak";
import type { QuestionDto } from "@/lib/contracts/questions";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Spinner";

function QuestionForm({ initial, onSave, onCancel }: { initial?: QuestionDto; onSave: (v: { question: string; answer: string }) => Promise<void>; onCancel?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError(null);
    try {
      await onSave({ question: String(f.get("question")), answer: String(f.get("answer")) });
      if (!initial) form.reset();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border-2 border-line bg-cream p-4">
      <Field label="The question they ask">
        <Input name="question" required maxLength={120} defaultValue={initial?.question} placeholder="Where is my wife?" />
      </Field>
      <Field label="The calm answer (shown and spoken exactly like this)">
        <Textarea name="answer" required maxLength={500} defaultValue={initial?.answer} placeholder="Ruth is at the shops. She'll be home at 4 o'clock." />
      </Field>
      <div className="flex items-center gap-2">
        <Button type="submit" loading={busy}>
          {initial ? "Save" : "Add question"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {error && <p className="font-semibold text-sun-deep">{error}</p>}
      </div>
    </form>
  );
}

export function QuestionsEditor({ pid }: { pid: string }) {
  const key = `/api/patients/${pid}/questions`;
  const { data, error, isLoading, mutate } = useSWR<{ questions: QuestionDto[] }>(key, fetcher);
  const [editing, setEditing] = useState<string | null>(null);
  const qs = data?.questions ?? [];

  async function move(i: number, dir: -1 | 1) {
    const ids = qs.map((q) => q.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    mutate({ questions: ids.map((id) => qs.find((q) => q.id === id)!) }, { revalidate: false });
    await api(`${key}/order`, { method: "PUT", json: { ids } });
    mutate();
  }

  return (
    <>
      <Card>
        <CardTitle className="mb-1">Repeat questions</CardTitle>
        <p className="mb-4 text-ink-soft">Each question becomes a big button on the patient&apos;s screen. The answer is always the same, word for word.</p>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : error ? (
          <ErrorState onRetry={() => mutate()} />
        ) : !qs.length ? (
          <EmptyState title="No questions yet" body="Add the questions your person asks most often." />
        ) : (
          <ol className="flex flex-col gap-2">
            {qs.map((q, i) =>
              editing === q.id ? (
                <li key={q.id}>
                  <QuestionForm
                    initial={q}
                    onCancel={() => setEditing(null)}
                    onSave={async (v) => {
                      await api(`${key}/${q.id}`, { method: "PATCH", json: v });
                      setEditing(null);
                      mutate();
                    }}
                  />
                </li>
              ) : (
                <li
                  key={q.id}
                  className={"flex flex-wrap items-start gap-4 rounded-xl border-2 bg-white px-5 py-4 " + (q.isActive ? "border-line" : "border-dashed border-line bg-sand")}
                >
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="ghost" aria-label={`Move "${q.question}" up`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <span aria-hidden>▲</span> Up
                    </Button>
                    <Button size="sm" variant="ghost" aria-label={`Move "${q.question}" down`} disabled={i === qs.length - 1} onClick={() => move(i, 1)}>
                      <span aria-hidden>▼</span> Down
                    </Button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold">
                      {q.question}
                      {!q.isActive && <span className="ml-2 rounded-lg border-2 border-ink-soft px-2 text-base font-bold text-ink-soft">Hidden</span>}
                    </p>
                    <p className="text-ink-soft">{q.answer}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => speak(q.answer)}>
                      Hear it
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await api(`${key}/${q.id}`, { method: "PATCH", json: { isActive: !q.isActive } });
                        mutate();
                      }}
                    >
                      {q.isActive ? "Hide" : "Show"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(q.id)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await api(`${key}/${q.id}`, { method: "DELETE" });
                        mutate();
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ),
            )}
          </ol>
        )}
      </Card>
      <Card>
        <CardTitle className="mb-4">Add a question</CardTitle>
        <QuestionForm
          onSave={async (v) => {
            await api(key, { method: "POST", json: v });
            mutate();
          }}
        />
      </Card>
    </>
  );
}
