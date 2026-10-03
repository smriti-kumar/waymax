"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { api, fetcher } from "@/client/api";
import { REQUIRED_SAMPLES, type PersonSummary } from "@/lib/contracts/people";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Spinner";
import { Avatar } from "./Avatar";
import { PersonForm } from "./PersonForm";
import { StrictnessSetting } from "./StrictnessSetting";

export function SamplesBadge({ n }: { n: number }) {
  if (n >= REQUIRED_SAMPLES)
    return <span className="text-sm font-semibold text-leaf">{n} face samples ✓</span>;
  return (
    <span className="text-sm font-semibold text-sun-deep">
      {n} of {REQUIRED_SAMPLES} face samples
    </span>
  );
}

export function PeopleList({ pid }: { pid: string }) {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<{ people: PersonSummary[] }>(
    `/api/patients/${pid}/people?status=approved`,
    fetcher,
  );

  return (
    <>
      <Card>
        <CardTitle className="mb-4">Family and friends</CardTitle>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : error ? (
          <ErrorState onRetry={() => mutate()} />
        ) : !data?.people.length ? (
          <EmptyState title="No one added yet" body="Add the people who visit most, then upload 3 clear photos of each face." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.people.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/caregiver/${pid}/people/${p.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-line bg-white p-3 hover:border-sea"
                >
                  <Avatar url={p.photoUrl} name={p.name} className="h-16 w-16 text-xl" />
                  <span className="flex flex-col">
                    <span className="text-lg font-semibold">{p.name}</span>
                    <span className="text-ink-soft capitalize">{p.relationship}</span>
                    <SamplesBadge n={p.embeddingCount} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardTitle className="mb-3">Face recognition</CardTitle>
        <StrictnessSetting pid={pid} />
      </Card>
      <Card>
        <CardTitle className="mb-4">Add a person</CardTitle>
        <PersonForm
          compact
          submitLabel="Add person"
          onSubmit={async (v) => {
            const r = await api<{ person: PersonSummary }>(`/api/patients/${pid}/people`, { method: "POST", json: v });
            router.push(`/caregiver/${pid}/people/${r.person.id}`);
          }}
        />
      </Card>
    </>
  );
}
