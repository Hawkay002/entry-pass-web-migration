import { Lock } from "lucide-react";
import { STAFF } from "./data";

export function StaffControlPanel() {
  return (
    <div className="w-full max-w-md border border-steel-800 bg-surface">
      <div className="flex items-center justify-between px-6 py-4 border-b border-steel-800">
        <span className="font-mono text-xs uppercase tracking-widest text-steel-300">
          Staff Access
        </span>
        <span className="font-mono text-[11px] text-steel-500">
          {STAFF.filter((s) => s.status === "active").length}/{STAFF.length} ACTIVE
        </span>
      </div>
      <div>
        {STAFF.map((member) => (
          <div
            key={member.name}
            className="flex items-center justify-between px-6 py-4 border-b border-steel-800 last:border-b-0"
          >
            <div className="min-w-0">
              <div className="font-body text-sm text-bone truncate">
                {member.name}
              </div>
              <div className="font-mono text-[11px] text-steel-500 tracking-widest">
                {member.role} · {member.gate}
              </div>
            </div>
            {member.status === "active" ? (
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-signal-soft shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-signal" />
                Active
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-steel-500 shrink-0">
                <Lock size={11} strokeWidth={2} />
                Locked
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
