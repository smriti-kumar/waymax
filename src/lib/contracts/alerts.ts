import { z } from "zod";
import { e164, nonEmpty } from "./common";

export const alertContactBody = z.object({
  name: nonEmpty(80),
  phoneE164: e164,
  notifyGeofence: z.boolean().default(true),
});

export type AlertContactDto = { id: string; name: string; phoneE164: string; notifyGeofence: boolean };
