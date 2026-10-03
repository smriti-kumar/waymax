import { z } from "zod";

export const uuid = z.uuid();
export const e164 = z
  .string()
  .trim()
  .regex(/^\+[1-9][0-9]{7,14}$/, "Use international format, like +16075551234");
export const nonEmpty = (max = 200) => z.string().trim().min(1, "Required").max(max);
export const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
export const timezone = z.string().refine(isValidTimezone, "Unknown timezone");

export type ApiErrorBody = { error: { code: string; message: string; details?: unknown } };
