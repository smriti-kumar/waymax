import { patchQuestionBody } from "@/lib/contracts/questions";
import { requireCaregiverFor } from "@/server/auth/guards";
import { noContent, route } from "@/server/http/route";
import { deleteQuestion, updateQuestion } from "@/server/services/questions";

export const runtime = "nodejs";

export const PATCH = route({ body: patchQuestionBody }, async ({ req, params, body }) => {
  await requireCaregiverFor(req, params.pid);
  return { question: await updateQuestion(params.pid, params.id, body) };
});

export const DELETE = route({}, async ({ req, params }) => {
  await requireCaregiverFor(req, params.pid);
  await deleteQuestion(params.pid, params.id);
  return noContent();
});
