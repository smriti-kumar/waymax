import { z } from "zod";
import { isUuid, requireDeviceOrCaregiver, requirePatientAccess } from "@/server/auth/guards";
import { json, route } from "@/server/http/route";
import { patientsForCaregiver } from "@/server/services/caregivers";
import { speech } from "@/server/services/tts";
import { badRequest } from "@/server/http/errors";

export const runtime = "nodejs";

const body = z.object({
  text: z.string().trim().min(1).max(500),
  /** Caregivers only: which patient's storage holds the clip. Defaults to their first patient. */
  patientId: z.string().optional(),
});

export const POST = route({ body }, async ({ req, body }) => {
  const who = await requireDeviceOrCaregiver(req);
  let patientId: string;
  if (who.device) patientId = who.device.patientId;
  else if (body.patientId && isUuid(body.patientId)) {
    await requirePatientAccess(who.caregiver!.id, body.patientId);
    patientId = body.patientId;
  } else {
    const first = (await patientsForCaregiver(who.caregiver!.id))[0];
    if (!first) throw badRequest("Add a patient first");
    patientId = first.id;
  }
  const result = await speech(body.text, patientId);
  if (result.kind === "fallback") return json({ fallback: true, text: body.text, reason: result.reason });
  return new Response(new Uint8Array(result.bytes), {
    status: 200,
    headers: {
      "content-type": "audio/mpeg",
      "content-length": String(result.bytes.length),
      "cache-control": "private, max-age=86400",
      "x-tts-cache": result.cached ? "hit" : "miss",
    },
  });
});
