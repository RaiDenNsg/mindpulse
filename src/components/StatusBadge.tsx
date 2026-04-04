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
    <div className="glass-card px-5 py-3 flex items-center gap-3 fade-in">
      <span className={`w-2.5 h-2.5 rounded-full ${dotColor} pulse-dot`} />
      <span className={`text-sm font-semibold ${colorClass} ${glowClass}`}>
        {focusState}
      </span>
    </div>
  );
}
