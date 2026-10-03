import { z } from "zod";
import { requireDevice } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { buildPlan } from "@/server/services/schedule";

export const runtime = "nodejs";

const query = z.object({ offset: z.coerce.number().int().min(-7).max(14).default(0) });

export const GET = route({ query }, async ({ req, query }) => {
  const device = await requireDevice(req, ["patient_display"]);
  return buildPlan(device.patientId, query.offset);
});
