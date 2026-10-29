"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Notice, PasswordField, PrimaryButton, TextField } from "@/components/auth/fields";
import { createBrowserClient } from "@/lib/database/client";

export function ClinicianSignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workplace, setWorkplace] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Your password needs at least 8 characters.");
    setLoading(true);
    const { data, error: err } = await createBrowserClient().auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { name: name.trim(), intent: "clinician", workplace_name: workplace.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });
    setLoading(false);
    if (err) return setError(err.message);
    router.push(data.session ? "/onboarding" : "/check-email");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Amara Okafor" autoComplete="name" required />
      <TextField label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hospital.org" autoComplete="email" required />
      <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters." autoComplete="new-password" required />
      <TextField
        label="Hospital or clinic where you work"
        value={workplace}
        onChange={(e) => setWorkplace(e.target.value)}
        placeholder="e.g. Northbridge General Hospital"
        hint="We'll set up a workplace profile for you to complete after you verify your email."
        autoComplete="organization"
        required
      />
      {error && <Notice tone="error">{error}</Notice>}
      <PrimaryButton type="submit" loading={loading} disabled={!name.trim() || !email.trim() || password.length < 1 || workplace.trim().length < 2}>
        Create account
      </PrimaryButton>
      <p className="text-center text-[13px] leading-relaxed text-slate">Diagnowise supports your judgment. It never replaces it.</p>
    </form>
  );
}
