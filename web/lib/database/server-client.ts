/**
 * Diagnowise web — Next.js App Router Supabase client.
 *
 * Adapts `cookies()` from `next/headers` (Next.js 14's App Router cookie
 * store) into the framework-agnostic `CookieAdapter` shape
 * `lib/database/client.ts` expects, so that file itself never has to import
 * `next/headers` — it stays usable from anywhere, not just Route Handlers.
 *
 * Verified against the actual installed `next@14.2.35` type definitions for
 * `ReadonlyRequestCookies` (getAll() from RequestCookies, set()/delete()
 * from ResponseCookies) rather than guessed from memory — Next's cookie API
 * has changed across versions and getting this wrong fails silently in a
 * way that's easy to miss until a route actually runs.
 */

import { cookies } from "next/headers";
import { createServerClient, type CookieAdapter } from "./client";

export function getRouteHandlerSupabaseClient() {
  const cookieStore = cookies();
  const adapter: CookieAdapter = {
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options);
      });
    },
  };
  return createServerClient(adapter);
}
