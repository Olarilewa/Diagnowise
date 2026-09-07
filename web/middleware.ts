import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every request. Without this,
 * a session that's still valid server-side can appear logged-out in the
 * browser once the access token nears expiry — this is the standard
 * @supabase/ssr + Next.js App Router pattern, not Diagnowise-specific.
 *
 * Route-level protection (redirecting an unauthenticated request away from
 * /dashboard, or an unauthorized role away from a case) happens in each
 * route's own layout/page via lib/security/auth.ts's requireAuth/requireRole
 * — this middleware's only job is keeping the session cookie fresh.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
