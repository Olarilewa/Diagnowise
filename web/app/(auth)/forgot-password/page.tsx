"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { createBrowserClient } from "@/lib/database/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setLoading(true);
    const supabase = createBrowserClient();
    // Supabase returns success even for an unknown email (by design, to
    // avoid leaking which emails have accounts) — the UI reflects that
    // rather than distinguishing "sent" from "no such account."
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <div>
      {!sent ? (
        <div>
          <h1 className="font-display font-bold text-xl mb-1">Reset your password</h1>
          <p className="text-sm mb-6 text-slate">Enter your email and we&apos;ll send you a reset link.</p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@hospital.org"
            className="w-full text-sm rounded-lg p-2.5 border border-border focus:outline-none focus:ring-2 focus:ring-teal-accent"
          />
          <button
            onClick={handleSend}
            disabled={!email || loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold mt-5 bg-teal-deep text-white disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </div>
      ) : (
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl mx-auto mb-5 flex items-center justify-center bg-success-wash">
            <CheckCircle2 size={20} className="text-success" />
          </div>
          <h1 className="font-display font-bold text-xl mb-2">Check your inbox</h1>
          <p className="text-sm text-slate">If an account exists for that email, we&apos;ve sent a reset link.</p>
        </div>
      )}
      <Link href="/sign-in" className="text-xs mt-6 flex items-center gap-1.5 justify-center text-slate">
        <ArrowLeft size={12} /> Back to sign in
      </Link>
    </div>
  );
}
