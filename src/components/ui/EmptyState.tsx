import type { ReactNode } from "react";

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line bg-cream px-6 py-10 text-center">
      <p className="text-xl font-bold text-ink">{title}</p>
      {body && <p className="max-w-lg text-ink-soft">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 rounded-2xl border-2 border-sun-deep bg-sun-wash px-6 py-8 text-center">
      <p className="text-lg font-bold text-ink">{message ?? "We couldn't load this."}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="min-h-14 rounded-xl border-2 border-sea bg-sea px-6 py-3 text-lg font-bold text-white hover:bg-sea-deep"
        >
          Try again
        </button>
      )}
    </div>
  );
}
