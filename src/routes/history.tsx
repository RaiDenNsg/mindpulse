import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { getUserSessions } from "@/firebase/sessions";
import { subscribeToAuthState } from "@/firebase/auth";

interface SessionRecord {
  id: string;
  date: string;
  focusScore: number;
  productivity: number;
  sessionDuration: number;
  avgCognitiveLoad: number;
  source?: string;
}

type SourceFilter = "all" | "web" | "extension";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({
    meta: [
      { title: "MindPulse — Session History" },
      { name: "description", content: "View historical focus and productivity sessions." },
    ],
  }),
});

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function normalizeSession(raw: Record<string, unknown>): SessionRecord {
  return {
    id: String(raw.id ?? ""),
    date: String(raw.date ?? ""),
    focusScore: toNumber(raw.focusScore),
    productivity: toNumber(raw.productivity),
    sessionDuration: toNumber(raw.sessionDuration),
    avgCognitiveLoad: toNumber(raw.avgCognitiveLoad),
    source: typeof raw.source === "string" ? raw.source : undefined,
  };
}

function matchesSourceFilter(session: SessionRecord, filter: SourceFilter): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "extension") {
    return session.source === "extension";
  }

  // Web includes explicit "web" and legacy docs with no source field.
  return session.source === "web" || !session.source;
}

function getFocusTone(score: number): "good" | "avg" | "poor" {
  if (score >= 75) {
    return "good";
  }

  if (score >= 45) {
    return "avg";
  }

  return "poor";
}

function getToneStyles(score: number): { card: string; badge: string; label: string } {
  const tone = getFocusTone(score);

  if (tone === "good") {
    return {
      card: "border-focus-green/30 bg-focus-green/5",
      badge: "bg-focus-green/12 text-focus-green border-focus-green/30",
      label: "Good Focus",
    };
  }

  if (tone === "avg") {
    return {
      card: "border-neutral-yellow/30 bg-neutral-yellow/5",
      badge: "bg-neutral-yellow/12 text-neutral-yellow border-neutral-yellow/30",
      label: "Average Focus",
    };
  }

  return {
    card: "border-struggle-red/30 bg-struggle-red/5",
    badge: "bg-struggle-red/12 text-struggle-red border-struggle-red/30",
    label: "Poor Focus",
  };
}

function getCurrentStreak(sessions: SessionRecord[]): number {
  if (sessions.length === 0) {
    return 0;
  }

  const uniqueDates = new Set(sessions.map((session) => session.date));
  const cursor = new Date();
  let streak = 0;

  while (true) {
    const key = cursor.toISOString().split("T")[0];
    if (!uniqueDates.has(key)) {
      break;
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function formatSessionDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function HistoryPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const activeUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadSessions = async (userId: string | null | undefined) => {
      if (!active) {
        return;
      }

      activeUserIdRef.current = userId ?? null;

      if (!userId) {
        setSessions([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const result = await getUserSessions(userId);
        if (!active) {
          return;
        }

        const mapped = result
          .map((item: Record<string, unknown>) => normalizeSession(item))
          .filter((item: SessionRecord) => Boolean(item.date))
          .sort((a: SessionRecord, b: SessionRecord) => b.date.localeCompare(a.date));

        setSessions(mapped);
      } catch {
        if (active) {
          setSessions([]);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    const unsubscribe = subscribeToAuthState((nextUser: { uid: string } | null) => {
      console.log("[MindPulse History] Auth uid:", nextUser?.uid ?? null);
      void loadSessions(nextUser?.uid);
    });

    const handleSessionSaved = (event: Event) => {
      const customEvent = event as CustomEvent<{ userId?: string }>;
      const savedUserId = customEvent.detail?.userId;
      if (!savedUserId || savedUserId !== activeUserIdRef.current) {
        return;
      }

      void loadSessions(savedUserId);
    };

    window.addEventListener("mindpulse:session-saved", handleSessionSaved);

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("mindpulse:session-saved", handleSessionSaved);
    };
  }, []);

  const filteredSessions = useMemo(
    () => sessions.filter((session) => matchesSourceFilter(session, sourceFilter)),
    [sessions, sourceFilter],
  );

  const overallStats = useMemo(() => {
    const totalSessions = filteredSessions.length;

    const avgFocusScore = totalSessions > 0
      ? Math.round(filteredSessions.reduce((sum, session) => sum + session.focusScore, 0) / totalSessions)
      : 0;

    const bestSession = totalSessions > 0
      ? filteredSessions.reduce(
        (best, session) => (session.focusScore > best.focusScore ? session : best),
        filteredSessions[0],
      )
      : null;

    const currentStreak = getCurrentStreak(filteredSessions);

    return {
      totalSessions,
      avgFocusScore,
      bestSession,
      currentStreak,
    };
  }, [filteredSessions]);

  const sevenDayFocusData = useMemo(() => {
    const byDate = new Map<string, { sum: number; count: number }>();
    filteredSessions.forEach((session) => {
      if (!session.date) {
        return;
      }

      const current = byDate.get(session.date) ?? { sum: 0, count: 0 };
      byDate.set(session.date, {
        sum: current.sum + session.focusScore,
        count: current.count + 1,
      });
    });

    const points: Array<{ day: string; focusScore: number | null }> = [];

    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const key = day.toISOString().split("T")[0];

      points.push({
        day: day.toLocaleDateString("en-US", { weekday: "short" }),
        focusScore: byDate.has(key)
          ? Math.round((byDate.get(key)?.sum ?? 0) / Math.max(1, byDate.get(key)?.count ?? 1))
          : null,
      });
    }

    return points;
  }, [filteredSessions]);

  const hasSevenDayPoints = sevenDayFocusData.some((point) => point.focusScore !== null);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="pointer-events-none absolute -top-20 -left-24 h-72 w-72 rounded-full bg-primary/12 blur-3xl" />
      <div className="pointer-events-none absolute top-28 -right-20 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-neutral-yellow/10 blur-3xl" />

      <header className="border-b border-border/40 px-4 sm:px-6 xl:px-10 py-5 backdrop-blur-md bg-background/45 relative z-10">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/35 flex items-center justify-center shadow-[0_0_26px_oklch(0.72_0.19_160_/20%)]">
              <span className="text-primary font-extrabold text-base">M</span>
            </div>
            <div>
              <h1 className="text-[1.3rem] leading-none font-extrabold text-foreground tracking-tight">MindPulse History</h1>
              <span className="text-xs text-muted-foreground tracking-[0.2em] uppercase hidden sm:inline">Session Timeline</span>
            </div>
          </div>
          <Link
            to="/"
            className="px-2.5 py-1 text-xs rounded-md border border-border/70 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 xl:px-10 py-8 space-y-6 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="glass-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Sessions</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{overallStats.totalSessions}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Avg Focus Score</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{overallStats.avgFocusScore}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Best Session</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{overallStats.bestSession?.focusScore ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">{overallStats.bestSession ? formatSessionDate(overallStats.bestSession.date) : "No data"}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Current Streak</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{overallStats.currentStreak} days</p>
          </div>
        </div>

        <div className="glass-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">7-Day Focus Trend</h3>
          <div className="h-[240px]">
            {!hasSevenDayPoints ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Not enough data for trend yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sevenDayFocusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 260)" />
                  <XAxis dataKey="day" stroke="oklch(0.5 0.02 260)" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="oklch(0.5 0.02 260)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.18 0.02 260 / 90%)",
                      border: "1px solid oklch(0.3 0.02 260)",
                      borderRadius: "8px",
                      color: "oklch(0.93 0.01 260)",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="focusScore"
                    connectNulls={false}
                    stroke="oklch(0.72 0.19 160)"
                    strokeWidth={2.6}
                    dot={false}
                    activeDot={{ r: 4, fill: "oklch(0.72 0.19 160)", strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Sessions</h3>
            <div className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/50 p-1">
              <button
                type="button"
                onClick={() => setSourceFilter("all")}
                className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
                  sourceFilter === "all"
                    ? "bg-primary/20 text-foreground border border-primary/35"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter("web")}
                className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
                  sourceFilter === "web"
                    ? "bg-primary/20 text-foreground border border-primary/35"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                Web
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter("extension")}
                className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
                  sourceFilter === "extension"
                    ? "bg-primary/20 text-foreground border border-primary/35"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                Extension
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="glass-card p-6 text-sm text-muted-foreground">Loading history...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="glass-card p-6 text-sm text-muted-foreground">No sessions yet. Start a coding session to build your history.</div>
          ) : (
            filteredSessions.map((session) => {
              const tone = getToneStyles(session.focusScore);

              return (
                <div key={session.id || `${session.date}-${session.focusScore}`} className={`glass-card p-5 border ${tone.card}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{formatSessionDate(session.date)}</p>
                      <p className="text-xl font-semibold text-foreground mt-1">Focus {Math.round(session.focusScore)}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full border ${tone.badge}`}>{tone.label}</span>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                    <div className="rounded-md bg-background/50 p-3 border border-border/40">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Focus Score</p>
                      <p className="text-lg font-semibold text-foreground mt-1">{Math.round(session.focusScore)}</p>
                    </div>
                    <div className="rounded-md bg-background/50 p-3 border border-border/40">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Productivity</p>
                      <p className="text-lg font-semibold text-foreground mt-1">{Math.round(session.productivity)}</p>
                    </div>
                    <div className="rounded-md bg-background/50 p-3 border border-border/40">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Session Duration</p>
                      <p className="text-lg font-semibold text-foreground mt-1">{formatDuration(session.sessionDuration)}</p>
                    </div>
                    <div className="rounded-md bg-background/50 p-3 border border-border/40">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Avg Cognitive Load</p>
                      <p className="text-lg font-semibold text-foreground mt-1">{Math.round(session.avgCognitiveLoad)}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
