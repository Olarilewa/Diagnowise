import Link from "next/link";
import { Stethoscope } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 backdrop-blur border-b border-border-soft bg-porcelain/90">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center bg-teal-deep">
            <Stethoscope size={15} color="white" />
          </div>
          <span className="font-semibold font-display text-[15px]">Diagnowise</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate">
          <a href="#product" className="hover:opacity-70">
            Product
          </a>
          <a href="#safety" className="hover:opacity-70">
            Clinical safety
          </a>
          <a href="#about" className="hover:opacity-70">
            About
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/sign-in" className="text-sm font-medium px-3 py-2 text-graphite">
            Sign in
          </Link>
          <Link href="/sign-up" className="text-sm rounded-lg px-4 py-2 font-semibold bg-teal-deep text-white">
            Start a Case
          </Link>
        </div>
      </div>
    </header>
  );
}
