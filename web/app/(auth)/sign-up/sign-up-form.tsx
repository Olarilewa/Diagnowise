"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/database/client";

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const valid = name.trim().length > 0 && email.trim().length > 0 && password.length >= 8;

  async function handleSignUp() {
    setLoading(true);
    setError(null);
    const supabase = createBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    // If email confirmation is disabled on the Supabase project, signUp()
    // already returns an active session — skip straight to onboarding
    // rather than showing a "check your email" screen that would never
    // resolve. If confirmation IS required, there's no session yet.
    if (data.session) {
      router.push("/onboarding");
    } else {
      router.push("/check-email");
    }
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display font-bold text-xl mb-1">Create your workspace</h1>
      <p className="text-sm mb-6 text-slate">Set up your Diagnowise account.</p>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-slate-2">Full name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dr. Jordan Ade"
            className="w-full text-sm rounded-lg p-2.5 mt-1 border border-border focus:outline-none focus:ring-2 focus:ring-teal-accent"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-2">Work email</label>
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
            placeholder="At least 8 characters"
            className="w-full text-sm rounded-lg p-2.5 mt-1 border border-border focus:outline-none focus:ring-2 focus:ring-teal-accent"
          />
        </div>
      </div>

      {error && <p className="text-xs mt-3 text-danger">{error}</p>}

      <button
        onClick={handleSignUp}
        disabled={!valid || loading}
        className="w-full py-2.5 rounded-lg text-sm font-semibold mt-5 bg-teal-deep text-white disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Create account"}
      </button>

      <p className="text-xs text-center mt-6 text-slate">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-teal-deep">
          Sign in
        </Link>
      </p>
    </div>
  );
}
