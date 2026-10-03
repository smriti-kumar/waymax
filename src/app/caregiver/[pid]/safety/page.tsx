import { caregiverForPatientOrRedirect } from "@/server/auth/current";
import { Card, CardTitle } from "@/components/ui/Card";
import { DevicesPanel } from "@/components/caregiver/DevicesPanel";
import { CareTeamPanel } from "@/components/caregiver/CareTeamPanel";

export const metadata = { title: "Safety · Waymax" };

export default async function SafetyPage({ params }: PageProps<"/caregiver/[pid]/safety">) {
  const { pid } = await params;
  const { role } = await caregiverForPatientOrRedirect(pid);
  return (
    <>
      <Card>
        <CardTitle className="mb-4">Devices</CardTitle>
        <DevicesPanel pid={pid} />
      </Card>
      <Card>
        <CardTitle className="mb-4">Care team</CardTitle>
        <CareTeamPanel pid={pid} canInvite={role === "owner"} />
      </Card>
    </>
  );
}
