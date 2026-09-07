import Link from "next/link";
import { Stethoscope } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="px-6 py-5">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-7 h-7 rounded-md flex items-center justify-center bg-teal-deep">
            <Stethoscope size={15} color="white" />
          </div>
          <span className="font-semibold font-display text-[15px]">Diagnowise</span>
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-[400px]">{children}</div>
      </div>
    </div>
  );
}
