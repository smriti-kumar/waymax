import { badRequest, tooLarge } from "@/server/http/errors";
import { json, route } from "@/server/http/route";
import { personForCaregiver, setPrimary, setPrimaryIfMissing } from "@/server/services/people";
import { MAX_MEDIA_BYTES, sniffImageMime, storage } from "@/server/storage";

export const runtime = "nodejs";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export const POST = route({}, async ({ req, params }) => {
  const { person } = await personForCaregiver(req, params.personId);
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_MEDIA_BYTES + 64_000) throw tooLarge("Photos must be under 2 MB");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest("Send the photo as multipart form data with a 'file' field");
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) throw badRequest("Missing 'file'");
  if (file.size > MAX_MEDIA_BYTES) throw tooLarge("Photos must be under 2 MB");
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniffImageMime(bytes);
  if (!mime || !ALLOWED.includes(mime)) throw badRequest("Use a JPEG, PNG or WebP photo");
  const { id } = await storage().put({ patientId: person.patientId, mime, bytes });
  const setPrimaryFlag = String(form.get("setPrimary") ?? "") === "true";
  if (setPrimaryFlag) await setPrimary(person.id, id);
  else await setPrimaryIfMissing(person.id, id);
  return json({ mediaId: id }, 201);
});
