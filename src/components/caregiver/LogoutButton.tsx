"use client";
import { useRouter } from "next/navigation";
import { api } from "@/client/api";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-sand"
      onClick={async () => {
        await api("/api/auth/logout", { method: "POST" }).catch(() => {});
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
