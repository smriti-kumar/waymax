import { deviceOrRedirect } from "@/server/auth/device-current";
import { env } from "@/server/env";
import { Slideshow } from "@/components/patient/Slideshow";

export const dynamic = "force-dynamic";
export const metadata = { title: "Memories · Waymax" };

export default async function SlideshowPage({ params, searchParams }: PageProps<"/patient/memories/[personId]">) {
  await deviceOrRedirect("patient_display");
  const { personId } = await params;
  const q = await searchParams;
  // Demo mode lets tests speed slides up (?slideMs=1500); real use is always 8 s.
  const fast = env().NEXT_PUBLIC_DEMO_MODE ? Number(q.slideMs) : NaN;
  return <Slideshow personId={personId} slideMs={Number.isFinite(fast) && fast >= 500 ? fast : 8000} />;
}
