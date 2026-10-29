"use client";

import { useState } from "react";
import { generateShareCode } from "@/app/actions/consent";

export function ShareCodeCard() {
  const [result, setResult] = useState<{ code: string; validUntil: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setError(null);
    const res = await generateShareCode();
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setResult({ code: res.code, validUntil: res.validUntil });
  }

  return (
    <div className="bg-white border border-border rounded-2xl p-5">
      <div className="text-sm font-semibold mb-1">Let a patient share their reports with you</div>
      <p className="text-xs text-slate mb-4">
        Generate a one-time-use style code and give it to your patient. It expires in 7 days, and generating a new one replaces the old. We only store a hash, so a code can&apos;t be shown again.
      </p>
      <button onClick={generate} disabled={busy} className="rounded-lg px-4 py-2.5 text-sm font-semibold bg-teal-deep text-white disabled:opacity-50">
        {busy ? "Generating..." : result ? "Generate a new code" : "Generate sharing code"}
      </button>
      {result && (
        <div className="mt-4 rounded-xl bg-teal-wash p-4">
          <div className="font-display font-bold text-2xl tracking-widest">{result.code}</div>
          <div className="text-xs mt-1 text-slate">Valid until {new Date(result.validUntil).toLocaleString()}. Copy it now: it won&apos;t be shown again.</div>
        </div>
      )}
      {error && <p className="text-sm mt-3 text-danger">{error}</p>}
    </div>
  );
}
