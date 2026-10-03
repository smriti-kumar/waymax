"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * How many fixed-height rows fit in a container, so lists never overflow.
 * Returns a callback ref: it re-measures whenever the element mounts or resizes
 * (lists often mount only after data arrives).
 */
export function useFitCount<T extends HTMLElement>(rowPx: number, gapPx = 0) {
  const [el, setEl] = useState<T | null>(null);
  const [count, setCount] = useState(3);
  const ref = useCallback((node: T | null) => setEl(node), []);
  useEffect(() => {
    if (!el) return;
    const measure = () => setCount(Math.max(1, Math.floor((el.clientHeight + gapPx) / (rowPx + gapPx))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el, rowPx, gapPx]);
  return [ref, count] as const;
}
