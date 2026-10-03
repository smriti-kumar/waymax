import { deviceForRequest, isUuid, optionalCaregiver, requirePatientAccess } from "@/server/auth/guards";
import { forbidden, notFound, unauthorized } from "@/server/http/errors";
import { route } from "@/server/http/route";
import { storage } from "@/server/storage";

export const runtime = "nodejs";

export const GET = route({}, async ({ req, params }) => {
  if (!isUuid(params.mediaId)) throw notFound();
  const owner = await storage().owner(params.mediaId);
  const device = await deviceForRequest(req);
  const caregiver = device ? null : await optionalCaregiver(req);
  if (!device && !caregiver) throw unauthorized();
  if (!owner) throw notFound();
  if (device) {
    if (device.patientId !== owner.patientId) throw forbidden();
  } else {
    await requirePatientAccess(caregiver!.id, owner.patientId);
  }
  const media = (await storage().get(params.mediaId))!;
  return new Response(new Uint8Array(media.bytes), {
    status: 200,
    headers: {
      "content-type": media.mime,
      "content-length": String(media.sizeBytes),
      "cache-control": "private, max-age=86400",
    },
  });
});
