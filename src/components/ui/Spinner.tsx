import { cx } from "./cx";

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cx("inline-flex items-center gap-2 text-ink-soft", className)}>
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-sea border-t-transparent" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-xl bg-sand", className)} aria-hidden />;
}
