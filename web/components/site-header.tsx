import Link from "next/link";
import { Github, Menu } from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { REPO_URL } from "@/lib/home/links";
import { ExternalLink } from "@/components/home/ui";

const SECTIONS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#patients", label: "Patients" },
  { href: "#clinicians", label: "Clinicians" },
  { href: "#hospitals", label: "Hospitals" },
  { href: "#open-source", label: "Open source" },
];

export function SiteHeader({ tryHref }: { tryHref: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border-soft bg-porcelain/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Diagnowise home">
          <Wordmark />
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-6 text-[15px] text-slate lg:flex">
          {SECTIONS.map((s) => (
            <a key={s.href} href={s.href} className="hover:text-graphite">
              {s.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <ExternalLink href={REPO_URL} aria-label="Diagnowise on GitHub" className="flex h-10 items-center gap-2 rounded-lg px-2.5 text-[15px] font-medium text-graphite hover:bg-white">
            <Github size={19} aria-hidden="true" />
            <span className="hidden md:inline">GitHub</span>
          </ExternalLink>
          <Link href="/sign-in" className="hidden h-10 items-center rounded-lg px-3 text-[15px] font-medium text-graphite hover:bg-white sm:flex">
            Sign in
          </Link>
          <Link href={tryHref} className="flex h-10 items-center rounded-[10px] bg-teal-deep px-4 text-[15px] font-semibold text-white hover:bg-[#094f4a]">
            Try a case
          </Link>
          <details className="group relative lg:hidden">
            <summary aria-label="Menu" className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg text-graphite hover:bg-white [&::-webkit-details-marker]:hidden">
              <Menu size={20} aria-hidden="true" />
            </summary>
            <nav aria-label="Sections (menu)" className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-white p-2 shadow-card">
              {SECTIONS.map((s) => (
                <a key={s.href} href={s.href} className="block rounded-lg px-3 py-2.5 text-[15px] text-graphite hover:bg-porcelain">
                  {s.label}
                </a>
              ))}
              <Link href="/sign-in" className="block rounded-lg px-3 py-2.5 text-[15px] font-medium text-graphite hover:bg-porcelain sm:hidden">
                Sign in
              </Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
