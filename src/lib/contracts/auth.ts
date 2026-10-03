import { z } from "zod";
import { e164 } from "./common";

export const signupBody = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8, "At least 8 characters").max(200),
  name: z.string().trim().min(1).max(100),
  phoneE164: e164.optional().or(z.literal("").transform(() => undefined)),
});
export type SignupBody = z.infer<typeof signupBody>;

export const loginBody = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string().min(1),
});

export type CaregiverDto = { id: string; email: string; name: string; phoneE164: string | null };
export type MeResponse = { caregiver: CaregiverDto; patients: { id: string; preferredName: string; name: string }[] };
