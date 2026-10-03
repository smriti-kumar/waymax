"use client";
import { useRef, useState } from "react";
import { resizeToJpeg } from "@/client/image/resize";
import { Button } from "@/components/ui/Button";

export type PhotoCheck = (file: Blob) => Promise<{ ok: true; meta?: unknown } | { ok: false; reason: string }>;

/**
 * Picks photos, resizes each to a ≤300 KB JPEG, optionally runs `check` (face
 * enrollment rules), uploads, then calls `onUploaded` with the media id.
 */
export function PhotoUploader({
  personId,
  check,
  onUploaded,
  label = "Upload photos",
}: {
  personId: string;
  check?: PhotoCheck;
  onUploaded: (mediaId: string, meta: unknown) => Promise<void> | void;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);

  async function handle(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const out: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const { blob } = await resizeToJpeg(file);
        let meta: unknown;
        if (check) {
          const res = await check(blob);
          if (!res.ok) {
            out.push(`${file.name}: ${res.reason}`);
            continue;
          }
          meta = res.meta;
        }
        const fd = new FormData();
        fd.append("file", blob, "photo.jpg");
        const r = await fetch(`/api/people/${personId}/photos`, { method: "POST", body: fd });
        const data = await r.json();
        if (!r.ok) {
          out.push(`${file.name}: ${data?.error?.message ?? "upload failed"}`);
          continue;
        }
        await onUploaded(data.mediaId, meta);
        out.push(`${file.name}: added ✓`);
      } catch (err) {
        out.push(`${file.name}: ${(err as Error).message || "couldn't read this image"}`);
      }
    }
    setNotes(out);
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        data-testid="photo-input"
        onChange={(e) => handle(e.target.files)}
      />
      <Button variant="secondary" loading={busy} onClick={() => input.current?.click()}>
        {busy ? "Checking photos…" : label}
      </Button>
      {notes.length > 0 && (
        <ul className="text-sm text-ink-soft" aria-live="polite">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
