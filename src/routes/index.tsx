import { createFileRoute, Link } from "@tanstack/react-router";
import { useTracking } from "@/hooks/useTracking";
import CodeEditor from "@/components/CodeEditor";
import CognitiveGraph from "@/components/CognitiveGraph";
import StatsPanel from "@/components/StatsPanel";
import StatusBadge from "@/components/StatusBadge";
import InsightsPanel from "@/components/InsightsPanel";
import DailyReport from "@/components/DailyReport";
import { signOutUser } from "@/firebase/auth";

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

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch {
      // Keep UI stable if sign-out fails transiently.
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute -top-20 -left-24 h-72 w-72 rounded-full bg-primary/12 blur-3xl" />
      <div className="pointer-events-none absolute top-28 -right-20 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-neutral-yellow/10 blur-3xl" />

      {/* Header */}
      <header className="border-b border-border/40 px-4 sm:px-6 xl:px-10 py-5 backdrop-blur-md bg-background/45 relative z-10">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/35 flex items-center justify-center shadow-[0_0_26px_oklch(0.72_0.19_160_/20%)]">
              <span className="text-primary font-extrabold text-base">M</span>
            </div>
            <div>
              <h1 className="text-[1.3rem] leading-none font-extrabold text-foreground tracking-tight">MindPulse</h1>
              <span className="text-xs text-muted-foreground tracking-[0.2em] uppercase hidden sm:inline">Cognitive Intelligence</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge focusState={state.focusState} />
            <Link
              to="/history"
              className="px-2.5 py-1 text-xs rounded-md border border-border/70 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              History
            </Link>
            <button
              type="button"
              onClick={() => {
                void handleSignOut();
              }}
              className="px-2.5 py-1 text-xs rounded-md border border-border/70 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 xl:px-10 py-8 space-y-7 relative z-10">
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
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.85fr)_minmax(360px,1fr)] gap-6 xl:gap-7">
          <div className="fade-in fade-in-delay-2 min-w-0">
            <CognitiveGraph data={state.graphData} />
          </div>
          <div className="space-y-6 fade-in fade-in-delay-3 min-w-0">
            <InsightsPanel insight={state.insight} focusState={state.focusState} />
            <DailyReport sessionDuration={state.sessionDuration} />
          </div>
        </div>
      </main>
    </div>
  );
}
