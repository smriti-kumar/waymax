import { requireCaregiverFor } from "@/server/auth/guards";
import { noContent, route } from "@/server/http/route";
import { deleteContact } from "@/server/services/alertContacts";

export const runtime = "nodejs";

export const DELETE = route({}, async ({ req, params }) => {
  await requireCaregiverFor(req, params.pid);
  await deleteContact(params.pid, params.cid);
  return noContent();
});
