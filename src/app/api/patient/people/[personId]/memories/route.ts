import { isUuid, requireDevice } from "@/server/auth/guards";
import { notFound } from "@/server/http/errors";
import { route } from "@/server/http/route";
import { buildSlideshow } from "@/server/services/memories";

export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = route({}, async ({ req, params }) => {
  const device = await requireDevice(req, ["patient_display"]);
  if (!isUuid(params.personId)) throw notFound("Person not found");
  return buildSlideshow(device.patientId, params.personId);
});
