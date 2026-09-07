import Link from "next/link";
import { Stethoscope } from "lucide-react";

export function SiteFooter() {
  return (
    <footer id="about" className="border-t border-border-soft">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center bg-teal-deep">
              <Stethoscope size={13} color="white" />
            </div>
            <span className="font-semibold font-display text-sm">Diagnowise</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-medium text-slate">
            <Link href="/sign-up" className="hover:opacity-70">
              For Clinicians
            </Link>
            <Link href="/sign-in" className="hover:opacity-70">
              Sign in
            </Link>
          </div>
        </div>
        <p className="text-xs text-center text-slate-2">
          Diagnowise is a clinical reasoning and diagnostic safety layer. It does not provide autonomous diagnosis — all
          outputs require clinician review.
        </p>
      </div>
    </footer>
  );
}
