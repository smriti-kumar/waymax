import { requireCaregiverFor } from "@/server/auth/guards";
import { ApiError } from "@/server/http/errors";
import { route } from "@/server/http/route";
import { sendTest } from "@/server/services/notify";
import { getPatient } from "@/server/services/patients";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Sends a test iMessage to every alert contact. Always records an in-app `test` alert. */
export const POST = route({}, async ({ req, params }) => {
  await requireCaregiverFor(req, params.pid);
  const patient = await getPatient(params.pid);
  const r = await sendTest(params.pid, patient.preferredName);
  if (r.configured && r.anyFailed) {
    throw new ApiError("UPSTREAM", "Photon couldn't deliver the iMessage. Alerts still show here in the app.", { results: r.results });
  }
  return {
    configured: r.configured,
    results: r.results,
    ...(r.configured ? {} : { message: "Photon not set up yet — alerts show here in the app only." }),
  };
});
