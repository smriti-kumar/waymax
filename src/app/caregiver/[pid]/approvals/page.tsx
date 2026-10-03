import { ApprovalsQueue } from "@/components/caregiver/ApprovalsQueue";

export const metadata = { title: "Approvals · Waymax" };

export default async function ApprovalsPage({ params }: PageProps<"/caregiver/[pid]/approvals">) {
  const { pid } = await params;
  return <ApprovalsQueue pid={pid} />;
}
