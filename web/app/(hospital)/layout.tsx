import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { getCurrentUser } from "@/lib/security/auth";
import { signOut } from "@/app/actions/auth";
import { Wordmark } from "@/components/brand/logo";

export default async function HospitalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser(getRouteHandlerSupabaseClient());
  if (!user) redirect("/sign-in");
  if (user.profile.role === "patient") redirect("/patient");
  if (user.profile.role !== "hospital_admin") redirect("/dashboard");
  if (!user.profile.specialty) redirect("/onboarding");

  return (
    <div className="min-h-screen">
      <header className="border-b border-border-soft bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/hospital" aria-label="Diagnowise hospital home">
            <Wordmark />
          </Link>
          <form action={signOut}>
            <button type="submit" className="flex items-center gap-1.5 text-sm text-slate hover:text-graphite">
              <LogOut size={15} /> Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
