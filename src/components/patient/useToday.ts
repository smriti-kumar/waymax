"use client";
import useSWR from "swr";
import { fetcher } from "@/client/api";
import type { TodayResponse } from "@/lib/contracts/schedule";

/** Today card data; refreshes every minute and keeps the last good copy when offline. */
export function useToday() {
  const { data } = useSWR<TodayResponse>("/api/patient/today", fetcher, {
    refreshInterval: 60_000,
    keepPreviousData: true,
    shouldRetryOnError: true,
    errorRetryInterval: 15_000,
  });
  return data ?? null;
}
