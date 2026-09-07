"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Sparkles } from "lucide-react";
import { analyzeCase } from "@/app/actions/cases";

export function ReanalyzeButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setRunning(true);
    setError(null);
    const result = await analyzeCase(caseId);
    setRunning(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleClick}
        disabled={running}
        className="rounded-lg px-4 py-2.5 text-sm font-semibold bg-teal-deep text-white flex items-center gap-2 disabled:opacity-60"
      >
        <Sparkles size={14} /> {running ? "Analyzing..." : "Re-run diagnostic analysis"}
      </button>
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-danger max-w-[280px] text-right">
          <AlertTriangle size={12} className="shrink-0" /> {error}
        </div>
      )}
    </div>
  );
}
