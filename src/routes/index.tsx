import { createFileRoute } from "@tanstack/react-router";
import { useTracking } from "@/hooks/useTracking";
import CodeEditor from "@/components/CodeEditor";
import CognitiveGraph from "@/components/CognitiveGraph";
import StatsPanel from "@/components/StatsPanel";
import StatusBadge from "@/components/StatusBadge";
import InsightsPanel from "@/components/InsightsPanel";
import DailyReport from "@/components/DailyReport";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "MindPulse — Cognitive Load Intelligence" },
      { name: "description", content: "Track your cognitive load, focus states, and coding productivity in real-time." },
    ],
  }),
});

function Dashboard() {
  const { state, handleKeyDown } = useTracking();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">M</span>
            </div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">MindPulse</h1>
            <span className="text-xs text-muted-foreground hidden sm:inline">Cognitive Intelligence</span>
          </div>
          <StatusBadge focusState={state.focusState} />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Editor */}
        <CodeEditor onKeyDown={handleKeyDown} />

        {/* Stats */}
        <StatsPanel
          typingSpeed={state.typingSpeed}
          backspaceRate={state.backspaceRate}
          cognitiveLoad={state.cognitiveLoad}
          focusScore={state.focusScore}
          sessionDuration={state.sessionDuration}
        />

        {/* Graph + Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CognitiveGraph data={state.graphData} />
          </div>
          <div className="space-y-6">
            <InsightsPanel insight={state.insight} focusState={state.focusState} />
            <DailyReport />
          </div>
        </div>
      </main>
    </div>
  );
}
