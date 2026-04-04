import type { FocusState } from "@/utils/cognitiveLogic";
import { getFocusColor } from "@/utils/cognitiveLogic";

interface InsightsPanelProps {
  insight: string;
  focusState: FocusState;
}

export default function InsightsPanel({ insight, focusState }: InsightsPanelProps) {
  const borderColor = focusState === "Deep Focus"
    ? "border-focus-green/30"
    : focusState === "Struggling"
    ? "border-struggle-red/30"
    : focusState === "Distracted"
    ? "border-neutral-yellow/30"
    : "border-border";

  return (
    <div className={`glass-card p-6 border-l-4 ${borderColor} fade-in fade-in-delay-2`}>
      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.22em] mb-3">
        Live Insight
      </h3>
      <p className={`text-[1.08rem] leading-relaxed font-semibold ${getFocusColor(focusState)}`}>
        {insight}
      </p>
    </div>
  );
}
