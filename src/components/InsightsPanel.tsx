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
    <div className={`glass-card p-6 border-l-4 ${borderColor} fade-in`}>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Live Insight
      </h3>
      <p className={`text-lg font-medium ${getFocusColor(focusState)}`}>
        {insight}
      </p>
    </div>
  );
}
