"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api, fetcher } from "@/client/api";
import type { PersonDetail } from "@/lib/contracts/people";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "./Avatar";
import { MemoriesEditor } from "./MemoriesEditor";
import { SamplesBadge } from "./PeopleList";
import { PersonForm } from "./PersonForm";
import { PhotoUploader } from "./PhotoUploader";
import { usePhotoEnrollment } from "./usePhotoEnrollment";
import { PreviewVoiceButton } from "./PreviewVoiceButton";
import { DatesEditor } from "./DatesEditor";

export function PersonEditor({ pid, personId }: { pid: string; personId: string }) {
  const router = useRouter();
  const toast = useToast();
  const key = `/api/people/${personId}`;
  const { data, error, isLoading, mutate } = useSWR<PersonDetail>(key, fetcher);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const enrollment = usePhotoEnrollment(personId);

  if (isLoading) return <Skeleton className="h-64" />;
  if (error || !data) return <ErrorState message="We couldn't load this person." onRetry={() => mutate()} />;
  const { person, photos, memories, dates } = data;

  return (
    <>
      <Card className="flex flex-wrap items-center gap-5">
        <Avatar url={person.photoUrl} name={person.name} className="h-24 w-24 text-3xl" />
        <div className="flex flex-1 flex-col gap-1">
          <h2 className="text-2xl font-bold">{person.name ?? "Unnamed"}</h2>
          <p className="text-lg capitalize text-ink-soft">{person.relationship}</p>
          <SamplesBadge n={person.embeddingCount} />
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-4">Details</CardTitle>
        <PersonForm
          key={person.id + person.name}
          initial={{ ...person, name: person.name ?? "", relationship: person.relationship ?? "" }}
          submitLabel="Save"
          onSubmit={async (v) => {
            await api(key, { method: "PATCH", json: v });
            toast("Saved", "success");
            mutate();
          }}
          extra={(cur) => <PreviewVoiceButton name={cur.spokenName || cur.name} relationship={cur.relationship} />}
        />
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Photos</CardTitle>
          <SamplesBadge n={person.embeddingCount} />
        </div>
        <p className="mb-4 text-ink-soft">
          Upload 3 clear photos with just this person&apos;s face, looking at the camera. Each photo becomes a face sample.
        </p>
        {enrollment.banner && (
          <p className="mb-4 rounded-xl border-2 border-sun-deep bg-sun-wash px-4 py-3 font-bold text-sun-deep" role="status">
            {enrollment.banner}
          </p>
        )}
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {photos.map((ph) => (
            <figure key={ph.mediaId} className="flex flex-col gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ph.url}
                alt=""
                className={"aspect-square w-full rounded-xl border-4 object-cover " + (ph.isPrimary ? "border-sea" : "border-line")}
              />
              <figcaption className="flex flex-col gap-2">
                {ph.hasEmbedding && <span className="font-bold text-leaf">✓ Face sample</span>}
                {ph.isPrimary ? (
                  <span className="font-bold text-sea-deep">★ Main photo</span>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await api(key, { method: "PATCH", json: { primaryPhotoId: ph.mediaId } });
                      mutate();
                    }}
                  >
                    Make main photo
                  </Button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
        <PhotoUploader
          personId={personId}
          check={enrollment.check}
          onUploaded={async (mediaId, meta) => {
            await enrollment.afterUpload(mediaId, meta);
            mutate();
          }}
        />
      </Card>

      <Card>
        <CardTitle className="mb-4">Important dates</CardTitle>
        <DatesEditor personId={personId} dates={dates} onChange={() => mutate()} />
      </Card>

      <Card>
        <CardTitle className="mb-4">Memories</CardTitle>
        <MemoriesEditor personId={personId} memories={memories} photos={photos} onChange={() => mutate()} />
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft">Removing a person deletes their photos, face samples and memories.</p>
        {confirmDelete ? (
          <div className="flex gap-2">
            <Button
              variant="warn"
              onClick={async () => {
                await api(key, { method: "DELETE" });
                router.push(`/caregiver/${pid}/people`);
              }}
            >
              Yes, remove {person.name}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
            Remove person
          </Button>
        )}
      </Card>
    </>
  );
}
