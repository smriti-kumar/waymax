import { eq } from "drizzle-orm";
import { deviceOrRedirect } from "@/server/auth/device-current";
import { db } from "@/server/db/client";
import { patients } from "@/server/db/schema";
import { CalmingFlow } from "@/components/patient/CalmingFlow";

export const dynamic = "force-dynamic";
export const metadata = { title: "You're safe · Waymax" };

export default async function CalmingPage() {
  const { patient } = await deviceOrRedirect("patient_display");
  const [p] = await db().select({ homeLabel: patients.homeLabel }).from(patients).where(eq(patients.id, patient.id));
  return <CalmingFlow timezone={patient.timezone} homeLabel={p?.homeLabel ?? "Home"} />;
}
