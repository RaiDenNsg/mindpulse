import type { FocusState } from "@/utils/cognitiveLogic";
import { getFocusColor } from "@/utils/cognitiveLogic";

interface InsightsPanelProps {
  insight: string;
  focusState: FocusState;
}

export default function InsightsPanel({ insight, focusState }: InsightsPanelProps) {
  const borderColor = focusState === "Deep Focus"
    ? "border-focus-green/50"
    : focusState === "Struggling"
    ? "border-border"
    : focusState === "Distracted"
    ? "border-border"
    : "border-border";

  return (
    <section className={`glass-card p-5 border-l-2 ${borderColor} fade-in fade-in-delay-2`}>
      <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.1em] mb-2">
        Live Insight
      </h3>
      <p className={`text-[15px] leading-6 font-medium ${getFocusColor(focusState)}`}>
        {insight}
      </p>
    </section>
  );
}
