import { redirect } from "next/navigation";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { getCurrentUser } from "@/lib/security/auth";
import { BackLink } from "@/components/auth/back-link";
import { HospitalSignUpForm } from "./hospital-sign-up-form";

export default async function HospitalSignUpPage() {
  if (await getCurrentUser(getRouteHandlerSupabaseClient())) redirect("/dashboard");
  return (
    <div>
      <BackLink />
      <HospitalSignUpForm />
    </div>
  );
}
