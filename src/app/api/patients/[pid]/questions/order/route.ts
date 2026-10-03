import { reorderBody } from "@/lib/contracts/questions";
import { requireCaregiverFor } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { reorderQuestions } from "@/server/services/questions";

export const runtime = "nodejs";

/** Up/down reorder: the full list of ids in the new order. */
export const PUT = route({ body: reorderBody }, async ({ req, params, body }) => {
  await requireCaregiverFor(req, params.pid);
  return { questions: await reorderQuestions(params.pid, body.ids) };
});
