"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiClientError } from "@/client/api";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const body: Record<string, string> = {
      email: String(f.get("email") ?? ""),
      password: String(f.get("password") ?? ""),
    };
    if (mode === "signup") {
      body.name = String(f.get("name") ?? "");
      const phone = String(f.get("phone") ?? "").trim();
      if (phone) body.phoneE164 = phone;
    }
    try {
      await api(`/api/auth/${mode}`, { method: "POST", json: body });
      const next = params.get("next");
      router.push(next && next.startsWith("/caregiver") ? next : "/caregiver");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {mode === "signup" && (
        <Field label="Your name">
          <Input name="name" autoComplete="name" required maxLength={100} />
        </Field>
      )}
      <Field label="Email">
        <Input name="email" type="email" autoComplete="email" required />
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
      <Button type="submit" size="lg" loading={busy}>
        {mode === "signup" ? "Create account" : "Sign in"}
      </Button>
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
