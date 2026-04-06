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
  keystrokes: number;
  typingSpeed: number;
  sessionDuration: number;
  avgCognitiveLoad: number;
  source?: string;
  platform?: string;
  site?: string;
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

function toText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function toTitleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function isExtensionSession(raw: Record<string, unknown>): boolean {
  return String(raw.source ?? "") === "extension";
}

function getSessionTitle(session: SessionRecord): string {
  if (session.source === "extension") {
    const siteValue = session.site || session.platform;
    return siteValue ? toTitleCase(siteValue) : "Extension Session";
  }

  return `Focus ${Math.round(session.focusScore)}`;
}

function normalizeSession(raw: Record<string, unknown>): SessionRecord {
  const extensionSession = isExtensionSession(raw);
  const keystrokes = toNumber(raw.keystrokes ?? raw.keystrokeCount);
  const typingSpeed = toNumber(raw.typingSpeed);
  const productivity = extensionSession
    ? Math.round(Math.min(100, (keystrokes / 20) + (typingSpeed * 1.5)))
    : toNumber(raw.productivity);

  return {
    id: String(raw.id ?? ""),
    date: String(raw.date ?? ""),
    focusScore: toNumber(raw.focusScore),
    productivity,
    keystrokes,
    typingSpeed,
    sessionDuration: toNumber(raw.sessionDuration),
    avgCognitiveLoad: extensionSession
      ? toNumber(raw.cognitiveLoad ?? raw.avgCognitiveLoad)
      : toNumber(raw.avgCognitiveLoad ?? raw.cognitiveLoad),
    source: toText(raw.source),
    platform: toText(raw.platform),
    site: toText(raw.site),
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
      card: "border-l-primary",
      badge: "text-primary border-primary/30",
      label: "Good Focus",
    };
  }

  if (tone === "avg") {
    return {
      card: "border-l-border",
      badge: "text-muted-foreground border-border",
      label: "Average Focus",
    };
  }

  return {
    card: "border-l-border",
    badge: "text-muted-foreground border-border",
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 sm:px-6 xl:px-10 py-3.5 sm:py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary/15 border border-primary/25 flex items-center justify-center">
              <span className="text-primary font-semibold text-sm">M</span>
            </div>
            <div>
              <h1 className="text-lg leading-none font-semibold text-foreground tracking-tight">MindPulse History</h1>
              <span className="text-[11px] text-muted-foreground tracking-[0.12em] uppercase hidden sm:inline">Session Timeline</span>
            </div>
          </div>
          <Link
            to="/"
            className="px-2.5 sm:px-3 py-1.5 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 xl:px-10 py-6 sm:py-7 space-y-6 sm:space-y-7">
        <section className="flex flex-wrap items-end gap-x-5 sm:gap-x-8 gap-y-3 sm:gap-y-4 pb-1 border-b border-border/70">
          <div className="metric-inline">
            <p className="metric-inline-value">{overallStats.totalSessions}</p>
            <p className="metric-inline-label">Total Sessions</p>
          </div>
          <div className="metric-inline">
            <p className="metric-inline-value">{overallStats.avgFocusScore}</p>
            <p className="metric-inline-label">Avg Focus</p>
          </div>
          <div className="metric-inline">
            <p className="metric-inline-value">{overallStats.bestSession?.focusScore ?? 0}</p>
            <p className="metric-inline-label">Best Score</p>
          </div>
          <div className="metric-inline">
            <p className="metric-inline-value">{overallStats.currentStreak}</p>
            <p className="metric-inline-label">Day Streak</p>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 sm:mb-4 uppercase tracking-[0.1em]">7-Day Focus Trend</h3>
          <div className="h-[210px] sm:h-[240px]">
            {!hasSevenDayPoints ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                Not enough data for trend yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sevenDayFocusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.005 260)" />
                  <XAxis dataKey="day" stroke="oklch(0.6 0.01 260)" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="oklch(0.6 0.01 260)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "#111111",
                      border: "1px solid oklch(0.3 0.005 260)",
                      borderRadius: "6px",
                      color: "oklch(0.95 0.005 260)",
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="focusScore"
                    connectNulls={false}
                    stroke="oklch(0.72 0.18 158)"
                    strokeWidth={2.2}
                    dot={false}
                    activeDot={{ r: 4, fill: "oklch(0.72 0.18 158)", strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border/70 pb-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Sessions</h3>
            <div className="inline-flex items-center gap-3 sm:gap-5">
              <button
                type="button"
                onClick={() => setSourceFilter("all")}
                className={`pb-1 text-xs border-b transition-colors ${
                  sourceFilter === "all"
                    ? "text-foreground border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter("web")}
                className={`pb-1 text-xs border-b transition-colors ${
                  sourceFilter === "web"
                    ? "text-foreground border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                Web
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter("extension")}
                className={`pb-1 text-xs border-b transition-colors ${
                  sourceFilter === "extension"
                    ? "text-foreground border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                Extension
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8">Loading history...</div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8">No sessions yet. Start a coding session to build your history.</div>
          ) : (
            filteredSessions.map((session) => {
              const tone = getToneStyles(session.focusScore);

              return (
                <article
                  key={session.id || `${session.date}-${session.focusScore}`}
                  className={`border border-border rounded-md border-l-2 ${tone.card} bg-card px-3.5 sm:px-4 py-3.5 sm:py-4 hover:bg-accent/35 transition-colors`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{formatSessionDate(session.date)}</p>
                      <p className="text-base sm:text-lg font-semibold text-foreground mt-1">{getSessionTitle(session)}</p>
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-md border ${tone.badge}`}>{tone.label}</span>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mt-3.5 sm:mt-4 border-t border-border/60 pt-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Focus Score</p>
                      <p className="text-lg font-semibold text-foreground mt-1">{Math.round(session.focusScore)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                        {session.source === "extension" ? "Keystrokes" : "Productivity"}
                      </p>
                      <p className="text-lg font-semibold text-foreground mt-1">
                        {session.source === "extension"
                          ? Math.round(session.keystrokes)
                          : Math.round(session.productivity)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Session Duration</p>
                      <p className="text-lg font-semibold text-foreground mt-1">{formatDuration(session.sessionDuration)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Avg Cognitive Load</p>
                      <p className="text-lg font-semibold text-foreground mt-1">{Math.round(session.avgCognitiveLoad)}</p>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
