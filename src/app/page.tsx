import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div>
        <h1 className="text-6xl font-bold text-sea-deep">Waymax</h1>
        <p className="mt-4 text-2xl text-ink">
          Who is here, what today holds, and where you are — with caregivers kept close.
        </p>
      </div>
      <div className="grid w-full gap-4 sm:grid-cols-2">
        <Link
          href="/login"
          className="rounded-3xl border-4 border-sea-deep bg-sea px-6 py-8 text-3xl font-bold text-white transition hover:bg-sea-deep"
        >
          I&apos;m a caregiver
        </Link>
        <Link
          href="/pair"
          className="rounded-3xl border-4 border-sea bg-white px-6 py-8 text-3xl font-bold text-sea-deep transition hover:bg-sky"
        >
          Set up this device
        </Link>
      </div>
    </main>
  );
}
