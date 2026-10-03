"use client";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { ApiClientError, fetcher } from "@/client/api";
import type { TodayResponse } from "@/lib/contracts/schedule";

/** Today card data; refreshes every minute and keeps the last good copy when offline. */
export function useToday() {
  const router = useRouter();
  const { data } = useSWR<TodayResponse>("/api/patient/today", fetcher, {
    refreshInterval: 60_000,
    keepPreviousData: true,
    shouldRetryOnError: true,
    errorRetryInterval: 15_000,
    onError: (err) => {
      // Revoked or unpaired: go back to the pairing screen.
      if (err instanceof ApiClientError && err.status === 401) router.replace("/pair");
    },
  });
  return data ?? null;
}
