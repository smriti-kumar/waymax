"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiClientError } from "@/client/api";
import { FIREBASE_ENABLED, firebaseAuth, friendlyFirebaseError } from "@/client/firebase";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

type Values = { email: string; password: string; name?: string; phoneE164?: string };

/** Firebase sign-in (when configured) → exchange the ID token for the app's session cookie. */
async function viaFirebase(mode: "login" | "signup", v: Values) {
  const { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } = await import("firebase/auth");
  const auth = firebaseAuth();
  const cred =
    mode === "signup"
      ? await createUserWithEmailAndPassword(auth, v.email, v.password)
      : await signInWithEmailAndPassword(auth, v.email, v.password);
  if (mode === "signup" && v.name) await updateProfile(cred.user, { displayName: v.name });
  const idToken = await cred.user.getIdToken();
  await api("/api/auth/firebase", { method: "POST", json: { idToken, name: v.name, phoneE164: v.phoneE164 } });
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNote(null);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const v: Values = { email: String(f.get("email") ?? "").trim(), password: String(f.get("password") ?? "") };
    if (mode === "signup") {
      v.name = String(f.get("name") ?? "").trim();
      const phone = String(f.get("phone") ?? "").trim();
      if (phone) v.phoneE164 = phone;
    }
    try {
      if (FIREBASE_ENABLED) await viaFirebase(mode, v);
      else await api(`/api/auth/${mode}`, { method: "POST", json: v });
      const next = params.get("next");
      // Full page load (not a client push): a cached "signed out → /login" redirect
      // from before sign-in can otherwise leave the user stuck on this page.
      window.location.assign(next && next.startsWith("/caregiver") ? next : "/caregiver");
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(err instanceof ApiClientError ? err.message : code?.startsWith("auth/") ? friendlyFirebaseError(code) : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  async function forgot() {
    setError(null);
    if (!email) return setError("Type your email above first.");
    try {
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail(firebaseAuth(), email);
    } catch {
      /* same message either way, so emails can't be probed */
    }
    setNote("If that email has an account, a reset link is on its way.");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {mode === "signup" && (
        <Field label="Your name">
          <Input name="name" autoComplete="name" required maxLength={100} />
        </Field>
      )}
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password" hint={mode === "signup" ? "At least 8 characters" : undefined}>
        <Input
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={mode === "signup" ? 8 : 1}
        />
      </Field>
      {mode === "signup" && (
        <Field label="Mobile number (optional)" hint="International format, like +16075551234">
          <Input name="phone" type="tel" autoComplete="tel" placeholder="+1…" />
        </Field>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-[#fff6e6] px-3 py-2 font-medium text-sun-deep">
          {error}
        </p>
      )}
      {note && (
        <p role="status" className="rounded-xl bg-sky px-3 py-2 font-medium text-sea-deep">
          {note}
        </p>
      )}
      <Button type="submit" size="lg" loading={busy}>
        {mode === "signup" ? "Create account" : "Sign in"}
      </Button>
      {mode === "login" && FIREBASE_ENABLED && (
        <button type="button" onClick={forgot} className="self-center text-sm font-semibold text-sea-deep underline">
          Forgot password?
        </button>
      )}
      <p className="text-center text-ink-soft">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link className="font-semibold text-sea-deep underline" href="/login">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to Waymax?{" "}
            <Link className="font-semibold text-sea-deep underline" href="/signup">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
