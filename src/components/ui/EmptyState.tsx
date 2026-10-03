import type { ReactNode } from "react";

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line bg-white/60 px-6 py-10 text-center">
      <p className="text-lg font-semibold text-ink">{title}</p>
      {body && <p className="max-w-md text-ink-soft">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-sun bg-[#fff6e6] px-6 py-8 text-center">
      <p className="font-semibold text-ink">{message ?? "We couldn't load this."}</p>
      {onRetry && (
        <button onClick={onRetry} className="rounded-xl bg-sea px-4 py-2 font-semibold text-white hover:bg-sea-deep">
          Try again
        </button>
      )}
    </div>
  );
}
