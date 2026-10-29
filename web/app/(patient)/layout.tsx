import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut, Stethoscope } from "lucide-react";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { getCurrentUser } from "@/lib/security/auth";
import { signOut } from "@/app/actions/auth";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser(getRouteHandlerSupabaseClient());
  if (!user) redirect("/sign-in");
  if (user.profile.role !== "patient") redirect("/dashboard");

  return (
    <div className="min-h-screen">
      <header className="border-b border-border-soft bg-white">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/patient" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-teal-deep">
              <Stethoscope size={15} color="white" />
            </div>
            <span className="font-semibold font-display text-[15px]">Diagnowise</span>
          </Link>
<nav className="flex items-center gap-5 text-sm">
            <Link href="/patient" className="text-slate">Reports</Link>
            <Link href="/patient/sharing" className="text-slate">Sharing</Link>
            <form action={signOut}>
              <button type="submit" className="flex items-center gap-1.5 text-slate">
                <LogOut size={15} /> Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
