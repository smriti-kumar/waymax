import { QuestionsEditor } from "@/components/caregiver/QuestionsEditor";

export const metadata = { title: "Questions · Waymax" };

export default async function QuestionsPage({ params }: PageProps<"/caregiver/[pid]/questions">) {
  const { pid } = await params;
  return <QuestionsEditor pid={pid} />;
}
