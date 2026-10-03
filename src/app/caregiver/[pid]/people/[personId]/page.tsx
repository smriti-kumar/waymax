import Link from "next/link";
import { PersonEditor } from "@/components/caregiver/PersonEditor";

export const metadata = { title: "Person · Waymax" };

export default async function PersonPage({ params }: PageProps<"/caregiver/[pid]/people/[personId]">) {
  const { pid, personId } = await params;
  return (
    <>
      <Link href={`/caregiver/${pid}/people`} className="text-sm font-semibold text-sea-deep underline">
        ← All people
      </Link>
      <PersonEditor pid={pid} personId={personId} />
    </>
  );
}
