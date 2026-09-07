import { Mail } from "lucide-react";

export default function CheckEmailPage() {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-xl mx-auto mb-5 flex items-center justify-center bg-teal-wash">
        <Mail size={20} className="text-teal-deep" />
      </div>
      <h1 className="font-display font-bold text-xl mb-2">Check your email</h1>
      <p className="text-sm text-slate">
        We&apos;ve sent a confirmation link to the address you signed up with. Click it to finish setting up your
        workspace.
      </p>
    </div>
  );
}
