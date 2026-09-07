"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/database/client";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    const supabase = createBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display font-bold text-xl mb-1">Welcome back</h1>
      <p className="text-sm mb-6 text-slate">Sign in to your clinical workspace.</p>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-slate-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@hospital.org"
            className="w-full text-sm rounded-lg p-2.5 mt-1 border border-border focus:outline-none focus:ring-2 focus:ring-teal-accent"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full text-sm rounded-lg p-2.5 mt-1 border border-border focus:outline-none focus:ring-2 focus:ring-teal-accent"
          />
        </div>
      </div>

      <Link href="/forgot-password" className="text-xs mt-2 inline-block text-teal-deep">
        Forgot password?
      </Link>

      {error && <p className="text-xs mt-3 text-danger">{error}</p>}

      <button
        onClick={handleSignIn}
        disabled={loading || !email || !password}
        className="w-full py-2.5 rounded-lg text-sm font-semibold mt-5 bg-teal-deep text-white disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>

      <p className="text-xs text-center mt-6 text-slate">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="font-semibold text-teal-deep">
          Sign up
        </Link>
      </p>
    </div>
  );
}
