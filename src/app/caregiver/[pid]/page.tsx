import { DashboardView } from "@/components/caregiver/DashboardView";

export const metadata = { title: "Overview · Waymax" };

export default async function Overview({ params }: PageProps<"/caregiver/[pid]">) {
  const { pid } = await params;
  return <DashboardView pid={pid} />;
}
