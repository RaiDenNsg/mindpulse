import type { FocusState } from "@/utils/cognitiveLogic";
import { getFocusColor, getFocusGlow } from "@/utils/cognitiveLogic";

interface StatusBadgeProps {
  focusState: FocusState;
}

export default function StatusBadge({ focusState }: StatusBadgeProps) {
  const colorClass = getFocusColor(focusState);
  const glowClass = getFocusGlow(focusState);
  const dotColor = focusState === "Deep Focus"
    ? "bg-focus-green"
    : focusState === "Struggling"
    ? "bg-struggle-red"
    : focusState === "Distracted"
    ? "bg-neutral-yellow"
    : "bg-muted-foreground";

  return (
    <div className="glass-card status-badge px-6 py-3.5 flex items-center gap-3.5 fade-in fade-in-delay-1">
      <span className={`status-dot w-3 h-3 rounded-full ${dotColor} pulse-dot`} />
      <span className={`text-base font-bold tracking-tight ${colorClass} ${glowClass}`}>
        {focusState}
      </span>
    </div>
  );
}
