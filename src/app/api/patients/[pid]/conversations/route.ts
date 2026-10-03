import { conversationsQuery } from "@/lib/contracts/conversations";
import { requireCaregiverFor } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { listConversations } from "@/server/services/conversations";

export const runtime = "nodejs";

export const GET = route({ query: conversationsQuery }, async ({ req, params, query }) => {
  await requireCaregiverFor(req, params.pid);
  return { conversations: await listConversations(params.pid, query.personId) };
});
