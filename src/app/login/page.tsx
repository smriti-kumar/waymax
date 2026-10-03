import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/caregiver/AuthForm";

export const metadata = { title: "Sign in · Waymax" };

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <Link href="/" className="text-2xl font-bold text-sea-deep">
        Waymax
      </Link>
      <h1 className="text-3xl font-bold">Welcome back</h1>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </main>
  );
}
