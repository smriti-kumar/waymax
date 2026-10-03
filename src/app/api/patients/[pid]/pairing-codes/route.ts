import { pairingCodeBody } from "@/lib/contracts/patients";
import { requireCaregiverFor } from "@/server/auth/guards";
import { json, route } from "@/server/http/route";
import { createPairingCode } from "@/server/services/devices";

export const runtime = "nodejs";

export const POST = route({ body: pairingCodeBody }, async ({ req, params, body }) => {
  const { caregiver } = await requireCaregiverFor(req, params.pid);
  return json(await createPairingCode(params.pid, caregiver.id, body.deviceKind), 201);
});
