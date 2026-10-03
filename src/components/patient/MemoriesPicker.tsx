"use client";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/client/api";
import type { PatientPerson } from "@/lib/contracts/patient";
import { BigButton } from "@/components/ui/BigButton";
import { PatientFrame } from "./PatientFrame";

const backLink = "flex min-h-[72px] items-center rounded-3xl border-4 border-sea bg-white px-8 text-[28px] font-bold text-sea-deep";

export function MemoriesPicker() {
  const { data } = useSWR<{ people: PatientPerson[] }>("/api/patient/people", fetcher, { keepPreviousData: true });
  const [page, setPage] = useState(0);
  const all = data?.people ?? [];
  const perPage = all.length > 3 ? 2 : 3;
  const pages = Math.max(1, Math.ceil(all.length / perPage));
  const shown = all.slice(page * perPage, page * perPage + perPage);

  return (
    <PatientFrame
      buttons={
        <>
          {pages > 1 && (
            <BigButton tone="light" onClick={() => setPage((p) => (p + 1) % pages)}>
              More people
            </BigButton>
          )}
          <Link href="/patient" className={backLink}>
            Back to today
          </Link>
        </>
      }
    >
      <section className="flex h-full flex-col gap-6 px-10 py-8">
        <h1 className="text-[56px] font-bold">Memories with…</h1>
        {!data ? (
          <p>One moment…</p>
        ) : all.length === 0 ? (
          <p className="text-[36px]">Your family will add photos soon.</p>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-3 gap-8">
            {shown.map((p) => (
              <Link
                key={p.personId}
                href={`/patient/memories/${p.personId}`}
                className="flex min-h-0 flex-col items-center gap-4 rounded-[40px] bg-white p-6 shadow-sm hover:bg-sky"
              >
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photoUrl} alt="" className="aspect-square min-h-0 w-full flex-1 rounded-3xl object-cover" />
                ) : (
                  <span className="flex aspect-square w-full flex-1 items-center justify-center rounded-3xl bg-sand text-[120px] font-bold text-sea-deep">
                    {p.name[0]}
                  </span>
                )}
                <span className="text-[40px] font-bold">{p.name}</span>
                <span className="text-[28px] text-ink-soft">your {p.relationship}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PatientFrame>
  );
}
