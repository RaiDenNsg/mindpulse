import type { FocusState } from "@/utils/cognitiveLogic";
import { getFocusColor } from "@/utils/cognitiveLogic";

interface StatusBadgeProps {
  focusState: FocusState;
}

export default function StatusBadge({ focusState }: StatusBadgeProps) {
  const colorClass = getFocusColor(focusState);
  const dotColor = focusState === "Deep Focus"
    ? "bg-focus-green"
    : focusState === "Struggling"
    ? "bg-struggle-red"
    : focusState === "Distracted"
    ? "bg-neutral-yellow"
    : "bg-muted-foreground";

  return (
    <div className="status-badge px-3 py-1.5 rounded-md flex items-center gap-2 fade-in fade-in-delay-1">
      <span className={`status-dot w-2.5 h-2.5 rounded-full ${dotColor} pulse-dot`} />
      <span className={`text-xs font-medium tracking-tight ${colorClass}`}>
        {focusState}
      </span>
    </div>
  );
}
