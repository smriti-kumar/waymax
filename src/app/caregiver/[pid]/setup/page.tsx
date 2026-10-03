import { SetupWizard } from "@/components/caregiver/SetupWizard";

export const metadata = { title: "Set up · Waymax" };

export default async function SetupPage({ params }: PageProps<"/caregiver/[pid]/setup">) {
  const { pid } = await params;
  return <SetupWizard pid={pid} />;
}
