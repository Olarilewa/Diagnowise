"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";
import { PrimaryButton, TextField } from "@/components/auth/fields";
import { createBrowserClient } from "@/lib/database/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Supabase answers the same for unknown addresses (by design, so account existence isn't leaked).
    await createBrowserClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` });
    setLoading(false);
    setSent(true);
  }

  return (
    <div>
      <Link href="/sign-in" className="mb-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-slate hover:text-graphite">
        <ArrowLeft size={15} /> Back to sign in
      </Link>
      {sent ? (
        <>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-wash text-teal-deep">
            <MailCheck size={24} strokeWidth={1.75} />
          </span>
          <h1 className="mt-6 font-display text-[28px] font-semibold leading-tight tracking-tight">Check your inbox</h1>
          <p className="mt-3 text-[16px] leading-relaxed text-slate">If an account exists for that address, we&apos;ve sent a link to reset your password.</p>
        </>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <div>
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">Reset your password</h1>
            <p className="mt-2 text-[16px] leading-relaxed text-slate">Enter your email and we&apos;ll send you a reset link.</p>
          </div>
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hospital.org" autoComplete="email" required />
          <PrimaryButton type="submit" loading={loading} disabled={!email.trim()}>
            Send reset link
          </PrimaryButton>
        </form>
      )}
    </div>
  );
}
