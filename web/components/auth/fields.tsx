"use client";

import { forwardRef, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";

const inputBase =
  "h-11 w-full rounded-[10px] border bg-white px-3.5 text-[15px] text-graphite placeholder:text-slate-2/70 outline-none transition " +
  "focus:border-teal-accent focus:ring-4 focus:ring-teal-accent/15 disabled:bg-porcelain disabled:text-slate-2";

export function FieldShell({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-graphite">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="mt-1.5 flex items-center gap-1.5 text-[13px] text-danger">
          <AlertCircle size={13} /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="mt-1.5 text-[13px] leading-snug text-slate">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string | null };

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField({ label, hint, error, className = "", ...props }, ref) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input ref={ref} id={id} aria-invalid={!!error} aria-describedby={error || hint ? `${id}-msg` : undefined} className={`${inputBase} ${error ? "border-danger" : "border-border"} ${className}`} {...props} />
    </FieldShell>
  );
});

export function PasswordField({ label = "Password", hint, error, ...props }: Omit<TextFieldProps, "type" | "label"> & { label?: string }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <input id={id} type={shown ? "text" : "password"} aria-invalid={!!error} aria-describedby={error || hint ? `${id}-msg` : undefined} className={`${inputBase} pr-11 ${error ? "border-danger" : "border-border"}`} {...props} />
        <button type="button" onClick={() => setShown((s) => !s)} aria-label={shown ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-2 hover:text-graphite">
          {shown ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </FieldShell>
  );
}

export function SelectField({ label, hint, children, ...props }: InputHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; children: ReactNode }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <select id={id} className={`${inputBase} border-border appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9`} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%2353605d' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")" }} {...(props as object)}>
        {children}
      </select>
    </FieldShell>
  );
}

export function PrimaryButton({ loading, children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-teal-deep px-5 text-[15px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-[#094f4a] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={`flex h-11 items-center justify-center gap-2 rounded-[10px] border border-border bg-white px-5 text-[15px] font-semibold text-graphite transition hover:border-slate-2 ${className}`}>
      {children}
    </button>
  );
}

export function OptionCard({ selected, title, description, onSelect }: { selected: boolean; title: string; description: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition ${selected ? "border-teal-deep bg-teal-wash ring-1 ring-teal-deep" : "border-border bg-white hover:border-slate-2"}`}
    >
      <span className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-teal-deep" : "border-border"}`}>
        {selected && <span className="h-2 w-2 rounded-full bg-teal-deep" />}
      </span>
      <span>
        <span className="block text-[15px] font-semibold text-graphite">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-slate">{description}</span>
      </span>
    </button>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  const style = tone === "error" ? "border-danger/30 bg-danger-wash text-danger" : tone === "success" ? "border-success/30 bg-success-wash text-success" : "border-teal-soft bg-teal-wash text-teal-deep";
  return (
    <div role={tone === "error" ? "alert" : undefined} className={`rounded-xl border px-4 py-3 text-[14px] leading-snug ${style}`}>
      {children}
    </div>
  );
}
