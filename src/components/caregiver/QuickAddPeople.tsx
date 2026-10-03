"use client";
import { useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/client/api";
import type { PersonSummary } from "@/lib/contracts/people";
import { Avatar } from "./Avatar";
import { SamplesBadge } from "./PeopleList";
import { PersonForm } from "./PersonForm";
import { PhotoUploader } from "./PhotoUploader";
import { usePhotoEnrollment } from "./usePhotoEnrollment";

function EnrollRow({ person, onChange }: { person: PersonSummary; onChange: () => void }) {
  const enrollment = usePhotoEnrollment(person.id);
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-line bg-white p-3">
      <Avatar url={person.photoUrl} name={person.name} className="h-14 w-14" />
      <div className="flex-1">
        <p className="font-semibold">
          {person.name} <span className="font-normal text-ink-soft">· {person.relationship}</span>
        </p>
        <SamplesBadge n={person.embeddingCount} />
        {enrollment.banner && <p className="text-sm text-sun-deep">{enrollment.banner}</p>}
      </div>
      <PhotoUploader
        personId={person.id}
        label="Add 3 face photos"
        check={enrollment.check}
        onUploaded={async (mediaId, meta) => {
          await enrollment.afterUpload(mediaId, meta);
          onChange();
        }}
      />
    </li>
  );
}

/** Wizard step: add people and their face photos without leaving the page. */
export function QuickAddPeople({ pid, onChange }: { pid: string; onChange: () => void }) {
  const key = `/api/patients/${pid}/people?status=approved`;
  const { data, mutate } = useSWR<{ people: PersonSummary[] }>(key, fetcher);
  const [formKey, setFormKey] = useState(0);
  const refresh = () => {
    mutate();
    onChange();
  };
  return (
    <div className="flex flex-col gap-4">
      {!!data?.people.length && (
        <ul className="flex flex-col gap-2">
          {data.people.map((p) => (
            <EnrollRow key={p.id} person={p} onChange={refresh} />
          ))}
        </ul>
      )}
      <PersonForm
        key={formKey}
        compact
        submitLabel="Add person"
        onSubmit={async (v) => {
          await api(`/api/patients/${pid}/people`, { method: "POST", json: v });
          setFormKey((k) => k + 1);
          refresh();
        }}
      />
    </div>
  );
}
