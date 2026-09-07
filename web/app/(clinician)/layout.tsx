import { redirect } from "next/navigation";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { getCurrentUser } from "@/lib/security/auth";
import { AppShell } from "@/components/app-shell";

export default async function ClinicianLayout({ children }: { children: React.ReactNode }) {
  const supabase = getRouteHandlerSupabaseClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/sign-in");
  if (!user.profile.specialty) redirect("/onboarding");

  return <AppShell userName={user.profile.name}>{children}</AppShell>;
}
