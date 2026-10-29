import { MailCheck } from "lucide-react";

export default function CheckEmailPage() {
  return (
    <div>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-wash text-teal-deep">
        <MailCheck size={24} strokeWidth={1.75} />
      </span>
      <h1 className="mt-6 font-display text-[28px] font-semibold leading-tight tracking-tight">Check your email</h1>
      <p className="mt-3 text-[16px] leading-relaxed text-slate">We&apos;ve sent a confirmation link to the address you signed up with. Open it to finish setting up your account.</p>
      <p className="mt-6 text-[14px] leading-relaxed text-slate">Nothing arrived? Check your spam folder, or go back and sign up again with the correct address.</p>
    </div>
  );
}
