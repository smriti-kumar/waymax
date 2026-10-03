import Link from "next/link";
import { currentCaregiverOrRedirect } from "@/server/auth/current";
import { LogoutButton } from "@/components/caregiver/LogoutButton";
import { ToastProvider } from "@/components/ui/Toast";

export default async function CaregiverLayout({ children }: LayoutProps<"/caregiver">) {
  const cg = await currentCaregiverOrRedirect();
  return (
    <ToastProvider>
      <div className="flex min-h-full flex-1 flex-col bg-[#f7f3ec]">
        <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/caregiver" className="text-xl font-bold text-sea-deep">
              Waymax
            </Link>
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-ink-soft sm:inline">{cg.name}</span>
              <LogoutButton />
            </div>
          </div>
        </header>
        {children}
      </div>
    </ToastProvider>
  );
}
