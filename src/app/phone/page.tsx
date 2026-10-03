import { asc, eq } from "drizzle-orm";
import { deviceOrRedirect } from "@/server/auth/device-current";
import { db } from "@/server/db/client";
import { caregivers, patientCaregivers } from "@/server/db/schema";
import { PhoneSharing } from "@/components/phone/PhoneSharing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sharing location · Waymax" };

export default async function PhonePage() {
  const { patient } = await deviceOrRedirect("patient_phone");
  const team = await db()
    .select({ name: caregivers.name, role: patientCaregivers.role })
    .from(patientCaregivers)
    .innerJoin(caregivers, eq(caregivers.id, patientCaregivers.caregiverId))
    .where(eq(patientCaregivers.patientId, patient.id))
    .orderBy(asc(patientCaregivers.role));
  const owner = team.find((t) => t.role === "owner") ?? team[0];
  const caregiverName = owner ? owner.name.split(" ")[0]! : "your family";
  return <PhoneSharing preferredName={patient.preferredName} caregiverName={caregiverName} />;
}
