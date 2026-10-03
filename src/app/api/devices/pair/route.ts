import { pairBody } from "@/lib/contracts/patients";
import { setDeviceCookie } from "@/server/auth/cookies";
import { json, route } from "@/server/http/route";
import { pairDevice } from "@/server/services/devices";

export const runtime = "nodejs";

export const POST = route({ body: pairBody }, async ({ body }) => {
  const result = await pairDevice(body.code, body.label);
  const res = json(result, 201);
  setDeviceCookie(res, result.token);
  return res;
});
