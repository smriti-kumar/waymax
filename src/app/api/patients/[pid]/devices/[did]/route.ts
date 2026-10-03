import { isUuid, requireCaregiverFor } from "@/server/auth/guards";
import { notFound } from "@/server/http/errors";
import { noContent, route } from "@/server/http/route";
import { revokeDevice } from "@/server/services/devices";

export const runtime = "nodejs";

export const DELETE = route({}, async ({ req, params }) => {
  await requireCaregiverFor(req, params.pid);
  if (!isUuid(params.did)) throw notFound("Device not found");
  await revokeDevice(params.pid, params.did);
  return noContent();
});
