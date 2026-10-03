import { questionBody } from "@/lib/contracts/questions";
import { requireCaregiverFor } from "@/server/auth/guards";
import { json, route } from "@/server/http/route";
import { createQuestion, listQuestions } from "@/server/services/questions";

export const runtime = "nodejs";

export const GET = route({}, async ({ req, params }) => {
  await requireCaregiverFor(req, params.pid);
  return { questions: await listQuestions(params.pid) };
});

export const POST = route({ body: questionBody }, async ({ req, params, body }) => {
  await requireCaregiverFor(req, params.pid);
  return json({ question: await createQuestion(params.pid, body) }, 201);
});
