import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackLink({ href = "/sign-up", children = "Choose a different account type" }: { href?: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="mb-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-slate hover:text-graphite">
      <ArrowLeft size={15} /> {children}
    </Link>
  );
}
