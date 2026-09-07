import { NextResponse, type NextRequest } from "next/server";
import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";

/**
 * Handles the redirect Supabase sends after a user clicks an email
 * confirmation or password-reset link. Exchanges the one-time `code` for a
 * real session, then continues to wherever the flow that sent the email
 * intended (onboarding for a fresh signup, /reset-password for a password
 * reset — controlled by the `next` param each flow sets on its redirectTo).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = getRouteHandlerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=confirmation_failed`);
}
