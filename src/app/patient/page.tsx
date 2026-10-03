import { deviceOrRedirect } from "@/server/auth/device-current";
import { PatientHome } from "@/components/patient/PatientHome";

export const dynamic = "force-dynamic";
export const metadata = { title: "Today · Waymax" };

export default async function PatientPage() {
  const { patient } = await deviceOrRedirect("patient_display");
  return <PatientHome preferredName={patient.preferredName} timezone={patient.timezone} />;
}
