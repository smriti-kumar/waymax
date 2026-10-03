import { z } from "zod";

export const dateBody = z.object({
  kind: z.enum(["birthday", "anniversary", "other"]),
  label: z
    .string()
    .trim()
    .max(120)
    .nullish()
    .transform((v) => v || null),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  year: z.number().int().min(1900).max(2100).nullish().transform((v) => v ?? null),
});

export type PersonDateDto = { id: string; kind: "birthday" | "anniversary" | "other"; label: string | null; month: number; day: number; year: number | null };
