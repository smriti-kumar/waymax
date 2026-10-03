import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div>
        <h1 className="text-5xl font-bold tracking-tight text-sea-deep">Waymax</h1>
        <p className="mt-4 text-xl text-ink-soft">
          Who is here, what today holds, and where you are — with caregivers kept close.
        </p>
      </div>
      <div className="grid w-full gap-4 sm:grid-cols-2">
        <Link
          href="/login"
          className="rounded-3xl bg-sea px-6 py-8 text-2xl font-semibold text-white shadow-sm transition hover:bg-sea-deep"
        >
          I&apos;m a caregiver
        </Link>
        <Link
          href="/pair"
          className="rounded-3xl border-2 border-sea bg-white px-6 py-8 text-2xl font-semibold text-sea-deep shadow-sm transition hover:bg-sky"
        >
          Set up this device
        </Link>
      </div>
    </main>
  );
}
