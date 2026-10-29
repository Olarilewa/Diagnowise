"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Notice, PasswordField, PrimaryButton, TextField } from "@/components/auth/fields";
import { createBrowserClient } from "@/lib/database/client";

export function SignInForm({ linkFailed }: { linkFailed: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await createBrowserClient().auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) return setError(err.message);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <h1 className="font-display text-[30px] font-semibold leading-tight tracking-tight">Welcome back</h1>
      <p className="mb-8 mt-2 text-[16px] leading-relaxed text-slate">Sign in to continue where you left off.</p>
      {linkFailed && (
        <div className="mb-5">
          <Notice tone="error">That confirmation link didn&apos;t work or has expired. Sign in, or create your account again.</Notice>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hospital.org" autoComplete="email" required />
        <div>
          <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          <div className="mt-2 text-right">
            <Link href="/forgot-password" className="text-[13px] font-semibold text-teal-deep underline-offset-4 hover:underline">
              Forgot your password?
            </Link>
          </div>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <PrimaryButton type="submit" loading={loading} disabled={!email.trim() || !password}>
          Sign in
        </PrimaryButton>
      </form>
    </div>
  );
}
