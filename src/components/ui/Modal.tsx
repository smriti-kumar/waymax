"use client";
import { useEffect, useRef, type ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(94vw,640px)] rounded-2xl border-4 border-ink bg-white p-0 text-ink shadow-xl backdrop:bg-ink/60"
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-4 border-b-2 border-line px-6 py-4">
        <h2 className="text-2xl font-bold">{title}</h2>
        <button
          onClick={onClose}
          className="min-h-12 rounded-xl border-2 border-line bg-white px-4 text-lg font-bold text-ink hover:bg-sand"
          aria-label="Close"
        >
          ✕ Close
        </button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  );
}
