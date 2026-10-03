import "server-only";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { mediaBlobs } from "@/server/db/schema";
import { env } from "@/server/env";

export const MAX_MEDIA_BYTES = 2_000_000;

export interface StoredMedia {
  id: string;
  patientId: string;
  mime: string;
  bytes: Buffer;
  sizeBytes: number;
}

/** Every binary (photos, face snapshots, cached TTS) goes through this seam. */
export interface StorageProvider {
  put(input: { patientId: string; mime: string; bytes: Buffer }): Promise<{ id: string; deduped: boolean }>;
  get(id: string): Promise<StoredMedia | null>;
  /** Metadata only (no bytes) — for access checks. */
  owner(id: string): Promise<{ patientId: string } | null>;
  delete(id: string): Promise<void>;
}

export class DbStorageProvider implements StorageProvider {
  async put({ patientId, mime, bytes }: { patientId: string; mime: string; bytes: Buffer }) {
    if (bytes.length > MAX_MEDIA_BYTES) throw new Error("media too large");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const inserted = await db()
      .insert(mediaBlobs)
      .values({ patientId, mime, bytes, sizeBytes: bytes.length, sha256 })
      .onConflictDoNothing()
      .returning({ id: mediaBlobs.id });
    if (inserted.length) return { id: inserted[0].id, deduped: false };
    const [existing] = await db()
      .select({ id: mediaBlobs.id })
      .from(mediaBlobs)
      .where(and(eq(mediaBlobs.patientId, patientId), eq(mediaBlobs.sha256, sha256)));
    return { id: existing.id, deduped: true };
  }

  async get(id: string) {
    const [row] = await db()
      .select({
        id: mediaBlobs.id,
        patientId: mediaBlobs.patientId,
        mime: mediaBlobs.mime,
        bytes: mediaBlobs.bytes,
        sizeBytes: mediaBlobs.sizeBytes,
      })
      .from(mediaBlobs)
      .where(eq(mediaBlobs.id, id));
    return row ?? null;
  }

  async owner(id: string) {
    const [row] = await db().select({ patientId: mediaBlobs.patientId }).from(mediaBlobs).where(eq(mediaBlobs.id, id));
    return row ?? null;
  }

  async delete(id: string) {
    await db().delete(mediaBlobs).where(eq(mediaBlobs.id, id));
  }
}

let provider: StorageProvider | undefined;

export function storage(): StorageProvider {
  if (!provider) {
    // STORAGE_PROVIDER only supports "db" today; Vercel Blob would plug in here.
    void env().STORAGE_PROVIDER;
    provider = new DbStorageProvider();
  }
  return provider;
}

export const mediaUrl = (id: string | null | undefined) => (id ? `/api/media/${id}` : null);

const MAGIC: [string, (b: Buffer) => boolean][] = [
  ["image/jpeg", (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ["image/png", (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))],
  ["image/webp", (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP"],
];

/** Returns the real image mime from magic bytes, or null when it isn't jpeg/png/webp. */
export function sniffImageMime(bytes: Buffer): string | null {
  for (const [mime, test] of MAGIC) if (bytes.length >= 12 && test(bytes)) return mime;
  return null;
}
