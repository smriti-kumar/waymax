import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-3xl font-bold">We couldn&apos;t find that page</h1>
      <Link href="/" className="inline-flex min-h-14 items-center rounded-xl border-2 border-sea-deep bg-sea px-6 text-lg font-bold text-white hover:bg-sea-deep">
        Go to the start
      </Link>
    </main>
  );
}
