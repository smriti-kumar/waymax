import { requireWorker } from "@/server/auth/guards";
import { route } from "@/server/http/route";
import { retryPending } from "@/server/services/notify";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = route({}, async ({ req }) => {
  requireWorker(req);
  return retryPending();
});
