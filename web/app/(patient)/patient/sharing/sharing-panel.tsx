"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { shareWithClinician, stopSharing } from "@/app/actions/consent";
import type { MyConsent } from "@/lib/patient/consent";

export function SharingPanel({ consents }: { consents: MyConsent[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const active = consents.filter((c) => !c.revokedAt);
  const past = consents.filter((c) => c.revokedAt);

  async function submit() {
    setBusy(true);
    setMessage(null);
    const res = await shareWithClinician(code);
    setBusy(false);
    if (!res.ok) return setMessage({ tone: "error", text: res.error });
    setCode("");
    setMessage({ tone: "ok", text: res.status === "already_shared" ? `You were already sharing with ${res.clinicianName}.` : `You're now sharing with ${res.clinicianName}.` });
    router.refresh();
  }

  async function stop(id: string) {
    const res = await stopSharing(id);
    if (!res.ok) return setMessage({ tone: "error", text: res.error ?? "Could not stop sharing." });
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="bg-white border border-border rounded-2xl p-5">
        <label className="text-xs font-semibold text-slate-2">Sharing code from your clinician</label>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. A1B2C-3D4E5" className="w-full text-sm rounded-lg p-2.5 mt-1 border border-border uppercase tracking-wider" />
        <p className="text-xs mt-3 text-slate">
          By entering a code you let that clinician read <strong>all</strong> of your reports, past and future, and your name, until you stop sharing here.
          Only enter a code from a clinician you know.
        </p>
        <button onClick={submit} disabled={busy || code.trim().length < 6} className="w-full py-2.5 rounded-lg text-sm font-semibold mt-4 bg-teal-deep text-white disabled:opacity-50">
          {busy ? "Checking..." : "Share my reports"}
        </button>
        {message && <p className={`text-sm mt-3 ${message.tone === "ok" ? "text-success" : "text-danger"}`}>{message.text}</p>}
      </div>

      <div>
        <h2 className="text-sm font-semibold font-display mb-3">Currently sharing with</h2>
        {active.length === 0 ? (
          <p className="text-sm text-slate-2">No one.</p>
        ) : (
          <ul className="space-y-2">
            {active.map((c) => (
              <li key={c.consentId} className="bg-white border border-border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{c.clinicianName}</div>
                  <div className="text-xs text-slate-2">Since {new Date(c.grantedAt).toLocaleDateString()}</div>
                </div>
                <button onClick={() => stop(c.consentId)} className="text-sm font-semibold text-danger">Stop sharing</button>
              </li>
            ))}
          </ul>
        )}
        {past.length > 0 && (
          <p className="text-xs text-slate-2 mt-4">Previously shared with: {past.map((c) => c.clinicianName).join(", ")}.</p>
        )}
      </div>
    </div>
  );
}
