import { requireCaregiverFor } from "@/server/auth/guards";
import { ApiError } from "@/server/http/errors";
import { route } from "@/server/http/route";
import { friendlyDeliveryError } from "@/lib/delivery";
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
    throw new ApiError("UPSTREAM", "Some test messages didn't go through. Alerts always show here in the app too.", {
      results: r.results.map((x) => ("error" in x && x.error ? { ...x, error: friendlyDeliveryError(x.error) } : x)),
    });
  }
  return {
    configured: r.configured,
    results: r.results,
    ...(r.configured ? {} : { message: "Text alerts aren't switched on yet — alerts show here in the app for now." }),
  };
});
