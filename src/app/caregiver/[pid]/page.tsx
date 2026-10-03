import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";

export default async function Overview({ params }: PageProps<"/caregiver/[pid]">) {
  const { pid } = await params;
  return (
    <Card>
      <CardTitle>Getting started</CardTitle>
      <p className="mt-2 text-ink-soft">
        Pair the patient&apos;s laptop and phone from the{" "}
        <Link className="font-semibold text-sea-deep underline" href={`/caregiver/${pid}/safety`}>
          Safety
        </Link>{" "}
        page.
      </p>
    </Card>
  );
}
