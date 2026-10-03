"use client";
import useSWR from "swr";
import { fetcher } from "@/client/api";
import type { PersonSummary } from "@/lib/contracts/people";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { ApprovalCard } from "./ApprovalCard";

export function ApprovalsQueue({ pid }: { pid: string }) {
  const toast = useToast();
  const pending = useSWR<{ people: PersonSummary[] }>(`/api/patients/${pid}/people?status=pending`, fetcher, { refreshInterval: 5000 });
  const approved = useSWR<{ people: PersonSummary[] }>(`/api/patients/${pid}/people?status=approved`, fetcher);

  return (
    <Card>
      <CardTitle className="mb-1">Approvals</CardTitle>
      <p className="mb-4 text-ink-soft">
        When the patient taps &quot;Add this person&quot;, the face shows up here. Name them to have them recognized next time.
      </p>
      {pending.isLoading ? (
        <Skeleton className="h-40" />
      ) : pending.error ? (
        <ErrorState onRetry={() => pending.mutate()} />
      ) : !pending.data?.people.length ? (
        <EmptyState title="Nothing waiting" body="New faces the patient adds will appear here." />
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.data.people.map((p) => (
            <ApprovalCard
              key={p.id}
              person={p}
              existing={approved.data?.people ?? []}
              onDone={(msg) => {
                toast(msg, "success");
                void pending.mutate();
                void approved.mutate();
              }}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
