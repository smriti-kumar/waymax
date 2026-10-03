"use client";
import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/client/api";
import type { SpeakerClaimDto } from "@/lib/contracts/conversations";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Skeleton, Spinner } from "@/components/ui/Spinner";

type Row = {
  id: string;
  status: "recording" | "processing" | "done" | "failed";
  startedAt: string;
  endedAt: string | null;
  summary: string | null;
  keyFacts: string[];
  speakerClaim: SpeakerClaimDto | null;
  personName: string | null;
};

export function ClaimNote({ claim }: { claim: SpeakerClaimDto | null }) {
  if (!claim) return null;
  if (claim.matchesFace === false)
    return (
      <p className="text-sm font-semibold text-sun-deep">
        Voice said {claim.claimedName}, camera said {claim.faceName ?? "someone else"}.
      </p>
    );
  if (claim.matchesFace === true) return <p className="text-sm text-leaf">Voice confirmed: {claim.claimedName} ✓</p>;
  return <p className="text-sm text-ink-soft">Voice said {claim.claimedName} (no face seen).</p>;
}

function Transcript({ id }: { id: string }) {
  const { data, error } = useSWR<{ transcript: string; conversation: Row }>(`/api/conversations/${id}`, fetcher);
  if (error) return <ErrorState />;
  if (!data) return <Spinner />;
  return (
    <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
      {data.conversation.keyFacts.length > 0 && (
        <ul className="list-disc pl-5 text-ink-soft">
          {data.conversation.keyFacts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      <pre className="whitespace-pre-wrap rounded-xl bg-cream p-3 font-sans text-sm">{data.transcript || "No words were picked up."}</pre>
      <p className="text-xs text-ink-soft">Only the text is kept. Audio is never stored.</p>
    </div>
  );
}

export function ConversationsList({ pid }: { pid: string }) {
  const { data, error, isLoading, mutate } = useSWR<{ conversations: Row[] }>(`/api/patients/${pid}/conversations`, fetcher, {
    refreshInterval: 10_000,
  });
  const [open, setOpen] = useState<Row | null>(null);
  return (
    <Card>
      <CardTitle className="mb-1">Conversations</CardTitle>
      <p className="mb-4 text-ink-soft">Recorded only when the patient taps Listen. Summaries feed the next visit&apos;s recap.</p>
      {isLoading ? (
        <Skeleton className="h-24" />
      ) : error ? (
        <ErrorState onRetry={() => mutate()} />
      ) : !data?.conversations.length ? (
        <EmptyState title="No conversations yet" body="When the patient taps Listen during a visit, a short summary appears here." />
      ) : (
        <ul className="flex flex-col gap-2" data-testid="conversations">
          {data.conversations.map((c) => (
            <li key={c.id}>
              <button onClick={() => setOpen(c)} className="flex w-full flex-col gap-1 rounded-xl border-2 border-line bg-white px-4 py-3 text-left hover:border-sea">
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">{c.personName ?? "Someone"}</span>
                  <span className="text-sm text-ink-soft">{new Date(c.startedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                </span>
                <span className="text-ink">
                  {c.status === "done"
                    ? c.summary
                    : c.status === "failed"
                      ? "This one couldn't be transcribed."
                      : c.status === "recording"
                        ? "Recording now…"
                        : "Writing the summary…"}
                </span>
                <ClaimNote claim={c.speakerClaim} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `With ${open.personName ?? "someone"}` : ""}>
        {open && <Transcript id={open.id} />}
      </Modal>
    </Card>
  );
}
