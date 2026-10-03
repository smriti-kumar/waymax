"use client";
import useSWR from "swr";
import { fetcher } from "@/client/api";
import type { PatientPerson } from "@/lib/contracts/patient";

/** Manual "Who's here?" — works even when the camera or face model doesn't. */
export function WhoIsHerePicker({ onPick, onClose }: { onPick: (personId: string) => void; onClose: () => void }) {
  const { data } = useSWR<{ people: PatientPerson[] }>("/api/patient/people", fetcher);
  return (
    <div role="dialog" aria-modal="true" aria-label="Who's here?" className="absolute inset-0 z-20 flex flex-col gap-6 overflow-y-auto bg-cream px-10 py-8">
      <div className="flex items-center justify-between gap-6">
        <h1 className="text-[56px] font-bold">Who&apos;s here?</h1>
        <button onClick={onClose} className="min-h-[72px] rounded-3xl border-4 border-sea bg-white px-8 text-[28px] font-bold text-sea-deep">
          Back
        </button>
      </div>
      {!data ? (
        <p>One moment…</p>
      ) : data.people.length === 0 ? (
        <p>No one has been added yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          {data.people.map((p) => (
            <li key={p.personId}>
              <button
                onClick={() => onPick(p.personId)}
                className="flex w-full flex-col items-center gap-3 rounded-3xl bg-white p-5 shadow-sm hover:bg-sky"
              >
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photoUrl} alt="" className="aspect-square w-full rounded-2xl object-cover" />
                ) : (
                  <span className="flex aspect-square w-full items-center justify-center rounded-2xl bg-sand text-[72px] font-bold text-sea-deep">
                    {p.name[0]}
                  </span>
                )}
                <span className="text-[32px] font-bold">{p.name}</span>
                <span className="capitalize text-ink-soft">{p.relationship}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
