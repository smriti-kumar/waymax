import Link from "next/link";
import { PersonEditor } from "@/components/caregiver/PersonEditor";

export const metadata = { title: "Person · Waymax" };

export default async function PersonPage({ params }: PageProps<"/caregiver/[pid]/people/[personId]">) {
  const { pid, personId } = await params;
  return (
    <>
      <Link href={`/caregiver/${pid}/people`} className="inline-flex min-h-12 items-center self-start rounded-xl border-2 border-line bg-white px-4 text-lg font-bold text-ink hover:bg-sand">
        ← All people
      </Link>
      <PersonEditor pid={pid} personId={personId} />
    </>
  );
}
