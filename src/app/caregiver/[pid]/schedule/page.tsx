import { ScheduleEditor } from "@/components/caregiver/ScheduleEditor";

export const metadata = { title: "Schedule · Waymax" };

export default async function SchedulePage({ params }: PageProps<"/caregiver/[pid]/schedule">) {
  const { pid } = await params;
  return <ScheduleEditor pid={pid} />;
}
