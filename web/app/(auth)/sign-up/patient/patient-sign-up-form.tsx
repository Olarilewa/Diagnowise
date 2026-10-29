"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Notice, PasswordField, PrimaryButton, TextField } from "@/components/auth/fields";
import { createBrowserClient } from "@/lib/database/client";

export function PatientSignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        // account_type is the only value the signup trigger honours, and only to select the
        // LOWER-privilege patient role (migration 0006).
        data: { name: name.trim(), account_type: "patient", intent: "patient" },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/patient`,
      },
    });
    setLoading(false);
    if (err) return setError(err.message);
    router.push(data.session ? "/patient" : "/check-email");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <TextField label="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      <PasswordField value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters." autoComplete="new-password" required />
      {error && <Notice tone="error">{error}</Notice>}
      <PrimaryButton type="submit" loading={loading} disabled={!name.trim() || !email.trim() || password.length < 1}>
        Create account
      </PrimaryButton>
      <p className="text-center text-[13px] leading-relaxed text-slate">Diagnowise gives guidance, not a diagnosis. In an emergency, call your local emergency number.</p>
    </form>
  );
}
