import { redirect } from "next/navigation";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { getCurrentUser } from "@/lib/security/auth";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({ searchParams }: { searchParams: { error?: string } }) {
  if (await getCurrentUser(getRouteHandlerSupabaseClient())) redirect("/dashboard");
  return <SignInForm linkFailed={searchParams.error === "confirmation_failed"} />;
}
