import { requireCaregiverFor } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { contactOptIn } from "@/server/services/alertContacts";

export const runtime = "nodejs";

export const GET = route({}, async ({ req, params }) => {
  await requireCaregiverFor(req, params.pid);
  return contactOptIn(params.pid, params.cid);
});
