"use client";

import { useEffect, useState } from "react";

const FLOW_STAGES = ["Symptoms", "Clinical Context", "Differential", "Red Flags", "Investigation", "Reassessment"];

export function FlowDiagram() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % FLOW_STAGES.length), 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="w-full overflow-x-auto" role="group" aria-label="Clinical reasoning loop. Scrolls sideways on small screens." tabIndex={0}>
      <div className="flex items-center min-w-[640px] px-2 py-8">
        {FLOW_STAGES.map((stage, i) => {
          const filled = i <= active;
          const isActive = i === active;
          return (
            <div key={stage} className="flex items-center" style={{ flex: i < FLOW_STAGES.length - 1 ? 1 : "0 0 auto" }}>
              <div className="flex flex-col items-center gap-3 shrink-0" style={{ width: 108 }}>
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 transition-colors duration-500 ${
                    filled ? "bg-teal-deep border-teal-deep" : "bg-white border-border"
                  } ${isActive ? "animate-pulse" : ""}`}
                />
                <span className={`text-xs font-semibold text-center font-display transition-colors duration-500 ${filled ? "text-graphite" : "text-slate-2"}`}>
                  {stage}
                </span>
              </div>
              {i < FLOW_STAGES.length - 1 && (
                <div className="flex-1 h-[2px] -mt-6 bg-border-soft relative min-w-[32px]">
                  <div
                    className="absolute inset-0 bg-teal-accent origin-left transition-transform duration-500"
                    style={{ transform: `scaleX(${i < active ? 1 : 0})` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
