/**
 * Diagnowise — Supabase client factory
 *
 * Three distinct clients, on purpose:
 *
 *   createServerClient()   — used in API routes / server components. Reads
 *                             the caller's session from cookies, so every
 *                             query it makes runs AS that user and is
 *                             filtered by the RLS policies in
 *                             0003_rls_policies.sql. This is the client
 *                             almost everything in this codebase should use.
 *
 *   createBrowserClient()  — used in client components. Same RLS-respecting
 *                             behavior, browser-side session handling.
 *
 *   createServiceRoleClient() — bypasses RLS entirely. Reserved for the
 *                             handful of genuinely trusted server-only
 *                             operations (e.g. the AI orchestration layer
 *                             writing ai_interactions on a case it has
 *                             already verified access to, or scheduled jobs).
 *                             Never expose this client to a request handler
 *                             that hasn't independently checked authorization —
 *                             see lib/security/auth.ts.
 */

import { createBrowserClient as createSupabaseBrowserClient, createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example — ` +
        `this must be set before the app can talk to Supabase.`
    );
  }
  return value;
}

/**
 * Minimal cookie adapter shape, matching what @supabase/ssr expects from
 * Next.js's cookies() helper (App Router) without importing next/headers
 * directly here — callers pass their own adapter so this file stays
 * framework-agnostic and testable outside a request context.
 */
export interface CookieAdapter {
  getAll(): { name: string; value: string }[];
  setAll(cookies: { name: string; value: string; options?: Record<string, unknown> }[]): void;
}

export function createServerClient(cookies: CookieAdapter) {
  return createSupabaseServerClient<Database>(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll: () => cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) =>
          cookies.setAll(cookiesToSet),
      },
    }
  );
}

export function createBrowserClient() {
  return createSupabaseBrowserClient<Database>(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}

/**
 * Bypasses RLS. See module docstring — do not wire this into a route handler
 * without an explicit, independent authorization check first.
 */
export function createServiceRoleClient() {
  return createClient<Database>(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
