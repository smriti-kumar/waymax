"use client";
import { api } from "@/client/api";
import { FIREBASE_ENABLED, firebaseAuth } from "@/client/firebase";

export function LogoutButton() {
  return (
    <button
      className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-sand"
      onClick={async () => {
        await api("/api/auth/logout", { method: "POST" }).catch(() => {});
        if (FIREBASE_ENABLED) await firebaseAuth().signOut().catch(() => {});
        // Full load so no signed-in pages stay in the client cache.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/login");
      }}
    >
      Sign out
    </button>
  );
}
