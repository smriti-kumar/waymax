import { z } from "zod";
import { requireCaregiverFor } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { confusionStats } from "@/server/services/dashboard";

export const runtime = "nodejs";

const query = z.object({ days: z.coerce.number().int().min(1).max(60).default(14) });

export const GET = route({ query }, async ({ req, params, query }) => {
  await requireCaregiverFor(req, params.pid);
  const { daily, byHour } = await confusionStats(params.pid, query.days);
  return { daily, byHour };
});
