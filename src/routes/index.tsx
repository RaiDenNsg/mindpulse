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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 sm:px-6 xl:px-10 py-3.5 sm:py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/15 border border-primary/25 flex items-center justify-center">
              <span className="text-primary font-semibold text-sm">M</span>
            </div>
            <div>
              <h1 className="text-lg leading-none font-semibold text-foreground tracking-tight">MindPulse</h1>
              <span className="text-[11px] text-muted-foreground tracking-[0.12em] uppercase hidden sm:inline">Focus Tracker</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <StatusBadge focusState={state.focusState} />
            </div>
            <Link
              to="/history"
              className="hidden sm:inline-flex px-3.5 py-2 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150"
            >
              History
            </Link>
            <a
              href="https://github.com/RaiDenNsg/mindpulse/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Extension
            </a>
            <button
              type="button"
              onClick={() => {
                void handleSignOut();
              }}
              className="hidden sm:inline-flex px-3.5 py-2 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 xl:px-10 py-6 sm:py-7 pb-24 sm:pb-7 space-y-5 sm:space-y-6">
        <CodeEditor onKeyDown={handleKeyDown} />
        <StatsPanel
          typingSpeed={state.typingSpeed}
          backspaceRate={state.backspaceRate}
          cognitiveLoad={state.cognitiveLoad}
          focusScore={state.focusScore}
          sessionDuration={state.sessionDuration}
        />

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.85fr)_minmax(360px,1fr)] gap-4 sm:gap-5 xl:gap-6">
          <div className="fade-in fade-in-delay-2 min-w-0">
            <CognitiveGraph data={state.graphData} />
          </div>
          <div className="space-y-5 fade-in fade-in-delay-3 min-w-0">
            <InsightsPanel insight={state.insight} focusState={state.focusState} />
            <DailyReport sessionDuration={state.sessionDuration} />
          </div>
        </div>
      </main>

      <div className="sm:hidden fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="px-4 py-3 grid grid-cols-2 gap-2">
          <Link
            to="/history"
            className="h-10 inline-flex items-center justify-center rounded-md border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors"
          >
            History
          </Link>
          <button
            type="button"
            onClick={() => {
              void handleSignOut();
            }}
            className="h-10 inline-flex items-center justify-center rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
