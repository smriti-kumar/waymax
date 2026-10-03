import { Skeleton } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
      <Skeleton className="h-24 md:col-span-2" />
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
    </div>
  );
}
