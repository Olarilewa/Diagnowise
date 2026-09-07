import { redirect } from "next/navigation";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { getCurrentUser } from "@/lib/security/auth";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage() {
  const supabase = getRouteHandlerSupabaseClient();
  const user = await getCurrentUser(supabase);
  if (user) redirect("/dashboard");
  return <SignInForm />;
}
