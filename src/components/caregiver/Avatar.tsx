import { cx } from "@/components/ui/cx";

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function Avatar({ url, name, className }: { url: string | null; name: string | null; className?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name ?? "Photo"} className={cx("rounded-2xl object-cover", className)} />;
  }
  return (
    <div className={cx("flex items-center justify-center rounded-2xl bg-sand font-bold text-sea-deep", className)} aria-label={name ?? "Unknown"}>
      {initials(name)}
    </div>
  );
}
