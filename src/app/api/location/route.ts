import { locationBody } from "@/lib/contracts/location";
import { requireDevice } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { recordPing } from "@/server/services/geofence";

export const runtime = "nodejs";

/** Patient phone page, iOS Shortcuts (Authorization: Device <token>) or future hardware. */
export const POST = route({ body: locationBody }, async ({ req, body }) => {
  const device = await requireDevice(req);
  const r = await recordPing(device.patientId, device.id, {
    lat: body.lat,
    lng: body.lng,
    accuracyM: body.accuracyM ?? null,
    recordedAt: body.recordedAt ? new Date(body.recordedAt) : undefined,
    source: body.source,
  });
  return { state: r.state, transition: r.transition };
});
