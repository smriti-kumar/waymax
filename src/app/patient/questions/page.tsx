import { deviceOrRedirect } from "@/server/auth/device-current";
import { QuestionsScreen } from "@/components/patient/QuestionsScreen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Questions · Waymax" };

export default async function PatientQuestionsPage() {
  await deviceOrRedirect("patient_display");
  return <QuestionsScreen />;
}
