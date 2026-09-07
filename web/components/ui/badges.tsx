import { Sparkles } from "lucide-react";

const RISK_STYLES: Record<string, string> = {
  low: "bg-success-wash text-success",
  moderate: "bg-warning-wash text-warning",
  high: "bg-danger-wash text-danger",
  critical: "bg-critical-wash text-critical",
};

export function RiskBadge({ risk }: { risk: string }) {
  const style = RISK_STYLES[risk.toLowerCase()] ?? RISK_STYLES.moderate;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${style}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {risk} risk
    </span>
  );
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  awaiting_investigation: "Awaiting Investigation",
  awaiting_followup: "Awaiting Follow-up",
  reassessment_required: "Reassessment Required",
  resolved: "Resolved",
  archived: "Archived",
};

const STATUS_COLORS: Record<string, string> = {
  reassessment_required: "var(--danger)",
  awaiting_investigation: "var(--info)",
  awaiting_followup: "var(--warning)",
  resolved: "var(--success)",
};

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "var(--slate)";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border bg-white"
      style={{ borderColor: color, color }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

const LIKELIHOOD_STYLES: Record<string, { className: string; label: string }> = {
  high: { className: "bg-danger-wash text-danger", label: "Higher likelihood" },
  moderate: { className: "bg-warning-wash text-warning", label: "Moderate likelihood" },
  low: { className: "bg-border-soft text-slate", label: "Lower likelihood" },
};

export function LikelihoodBadge({ level }: { level: string }) {
  const style = LIKELIHOOD_STYLES[level] ?? LIKELIHOOD_STYLES.moderate!;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.className}`}>{style.label}</span>;
}

const SOURCE_STYLES: Record<string, { className: string; label: string }> = {
  patient: { className: "text-info", label: "Patient-reported" },
  clinician: { className: "text-teal-deep", label: "Clinician-confirmed" },
  ai: { className: "text-slate", label: "AI-generated" },
  system: { className: "text-slate-2", label: "System-derived" },
};

export function SourceTag({ source }: { source: string }) {
  const style = SOURCE_STYLES[source] ?? SOURCE_STYLES.system!;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${style.className}`}>
      <span className="w-1 h-1 rounded-full bg-current" />
      {style.label}
    </span>
  );
}

export function AIBanner({ label = "AI-generated — requires clinician review" }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-teal-wash text-teal-deep">
      <Sparkles size={12} strokeWidth={2.5} />
      {label}
    </div>
  );
}
