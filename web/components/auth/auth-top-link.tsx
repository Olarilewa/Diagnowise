"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AuthTopLink() {
  const path = usePathname();
  const link = "font-semibold text-teal-deep underline-offset-4 hover:underline";
  if (path.startsWith("/sign-in")) {
    return (
      <span className="shrink-0 whitespace-nowrap text-[14px] text-slate">
        <span className="hidden sm:inline">New to Diagnowise? </span>
        <Link href="/sign-up" className={link}>
          Create an account
        </Link>
      </span>
    );
  }
  if (path.startsWith("/sign-up")) {
    return (
      <span className="shrink-0 whitespace-nowrap text-[14px] text-slate">
        <span className="hidden sm:inline">Already have an account? </span>
        <Link href="/sign-in" className={link}>
          Sign in
        </Link>
      </span>
    );
  }
  return null;
}
