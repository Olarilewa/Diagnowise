import { redirect } from "next/navigation";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { getCurrentUser } from "@/lib/security/auth";
import { SignUpForm } from "./sign-up-form";

export default async function SignUpPage() {
  const supabase = getRouteHandlerSupabaseClient();
  const user = await getCurrentUser(supabase);
  if (user) redirect("/dashboard");
  return <SignUpForm />;
}
