import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-3xl font-bold">We couldn&apos;t find that page</h1>
      <Link href="/" className="rounded-xl bg-sea px-4 py-2.5 font-semibold text-white">
        Go to the start
      </Link>
    </main>
  );
}
