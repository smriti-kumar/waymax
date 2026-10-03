import { z } from "zod";
import { nonEmpty } from "./common";

export const questionBody = z.object({
  question: nonEmpty(120),
  answer: nonEmpty(500),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().default(true),
});
export const patchQuestionBody = z
  .object({ question: nonEmpty(120), answer: nonEmpty(500), sortOrder: z.number().int().min(0).max(10_000), isActive: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export const reorderBody = z.object({ ids: z.array(z.uuid()).min(1).max(200) });

export type QuestionDto = { id: string; question: string; answer: string; sortOrder: number; isActive: boolean };
