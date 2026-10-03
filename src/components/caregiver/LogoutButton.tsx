"use client";
import { api } from "@/client/api";
import { FIREBASE_ENABLED, firebaseAuth } from "@/client/firebase";

export function LogoutButton() {
  return (
    <button
      className="min-h-12 rounded-xl border-2 border-line bg-white px-4 text-lg font-bold text-ink hover:bg-sand"
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
