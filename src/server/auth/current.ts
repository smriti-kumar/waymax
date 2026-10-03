import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "./cookies";
import { caregiverForToken } from "./sessions";
import { requirePatientAccess } from "./guards";
import { ApiError } from "@/server/http/errors";

/** For server components: the signed-in caregiver, or a redirect to /login. */
export async function currentCaregiverOrRedirect(next = "/caregiver") {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const cg = await caregiverForToken(token);
  if (!cg) redirect(`/login?next=${encodeURIComponent(next)}`);
  return cg;
}

/** For server components under /caregiver/[pid]: access check, redirecting home on failure. */
export async function caregiverForPatientOrRedirect(pid: string) {
  const cg = await currentCaregiverOrRedirect(`/caregiver/${pid}`);
  try {
    const { role } = await requirePatientAccess(cg.id, pid);
    return { caregiver: cg, role };
  } catch (err) {
    if (err instanceof ApiError) redirect("/caregiver");
    throw err;
  }
}
