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
    <div className="glass-card status-badge px-7 py-3 flex items-center gap-3 fade-in fade-in-delay-1 border-l-4 border-l-primary/30">
      <span className={`status-dot w-3.5 h-3.5 rounded-full ${dotColor} pulse-dot pulse-glow`} />
      <span className={`text-sm font-bold tracking-tight ${colorClass} ${glowClass} drop-shadow-[0_0_12px_currentColor]`}>
        {focusState}
      </span>
    </div>
  );
}
