"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Search, Settings, Stethoscope } from "lucide-react";
import { signOut } from "@/app/actions/auth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/cases/new", label: "New Case" },
  { href: "/patient-reports", label: "Patient reports" },
];

export function AppShell({ children, userName }: { children: React.ReactNode; userName: string }) {
  const pathname = usePathname();
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border-soft bg-white">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center bg-teal-deep">
                <Stethoscope size={15} color="white" />
              </div>
              <span className="font-semibold font-display text-[15px] hidden sm:inline">Diagnowise</span>
            </Link>
            <nav className="hidden lg:flex items-center gap-6 text-sm">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="font-medium"
                  style={{ color: pathname === item.href ? "var(--teal-deep)" : "var(--slate)" }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2 rounded-lg hover:bg-porcelain" title="Search (coming soon)">
              <Search size={17} className="text-slate" />
            </button>
            <button className="p-2 rounded-lg hover:bg-porcelain relative" title="Alerts (coming soon)">
              <Bell size={17} className="text-slate" />
            </button>
            <button className="p-2 rounded-lg hover:bg-porcelain" title="Settings (coming soon)">
              <Settings size={17} className="text-slate" />
            </button>
            <div className="w-8 h-8 rounded-full ml-2 flex items-center justify-center text-xs font-semibold bg-teal-wash text-teal-deep">
              {initials}
            </div>
            <form action={signOut}>
              <button type="submit" className="p-2 rounded-lg hover:bg-porcelain ml-1" title="Sign out">
                <LogOut size={16} className="text-slate" />
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
