import { getRouteHandlerSupabaseClient } from "@/lib/database/server-client";
import { listMyConsents } from "@/lib/patient/consent";
import { SharingPanel } from "./sharing-panel";

export default async function SharingPage() {
  const consents = await listMyConsents(getRouteHandlerSupabaseClient());
  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="font-display font-bold text-2xl">Sharing with your clinician</h1>
      <p className="text-sm mt-1 mb-8 text-slate">
        Nobody can see your reports unless you choose to share them. You&apos;re in control, and you can stop at any time.
      </p>
      <SharingPanel consents={consents} />
    </main>
  );
}
