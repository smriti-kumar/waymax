import { PeopleList } from "@/components/caregiver/PeopleList";

export const metadata = { title: "People · Waymax" };

export default async function PeoplePage({ params }: PageProps<"/caregiver/[pid]/people">) {
  const { pid } = await params;
  return <PeopleList pid={pid} />;
}
