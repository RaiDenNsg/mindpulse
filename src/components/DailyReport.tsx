import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { subscribeToAuthState } from "@/firebase/auth";
import { getUserSessions, getYesterdaySession } from "@/firebase/sessions";
import { getTodayKey, getYesterdayKey, type SessionData } from "@/utils/storage";

const SESSION_SAVED_EVENT = "mindpulse:session-saved";

export default function DailyReport() {
  const [isLoading, setIsLoading] = useState(true);
  const [sessionsByDate, setSessionsByDate] = useState<Record<string, SessionData>>({});
  const [cachedYesterdaySession, setCachedYesterdaySession] = useState<SessionData | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadSessions = async (userId: string | null | undefined) => {
      setActiveUserId(userId ?? null);

      if (!userId) {
        if (active) {
          setSessionsByDate({});
          setCachedYesterdaySession(null);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);

      try {
        const [allSessions, yesterdaySession] = await Promise.all([
          getUserSessions(userId),
          getYesterdaySession(userId),
        ]);

        if (!active) {
          return;
        }

        const mapped: Record<string, SessionData> = {};
        allSessions.forEach((session) => {
          if (!session.date) {
            return;
          }

          mapped[session.date] = {
            date: session.date,
            avgCognitiveLoad: Number(session.avgCognitiveLoad ?? 0),
            focusScore: Number(session.focusScore ?? 0),
            productivity: Number(session.productivity ?? 0),
            backspaceRate: Number(session.backspaceRate ?? 0),
            sessionDuration: Number(session.sessionDuration ?? 0),
          };
        });

        setSessionsByDate(mapped);
        setCachedYesterdaySession(
          yesterdaySession
            ? {
              date: String(yesterdaySession.date ?? getYesterdayKey()),
              avgCognitiveLoad: Number(yesterdaySession.avgCognitiveLoad ?? 0),
              focusScore: Number(yesterdaySession.focusScore ?? 0),
              productivity: Number(yesterdaySession.productivity ?? 0),
              backspaceRate: Number(yesterdaySession.backspaceRate ?? 0),
              sessionDuration: Number(yesterdaySession.sessionDuration ?? 0),
            }
            : null
        );
      } catch {
        if (active) {
          setSessionsByDate({});
          setCachedYesterdaySession(null);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    const unsubscribe = subscribeToAuthState((nextUser) => {
      void loadSessions(nextUser?.uid);
    });

    const handleSessionSaved = (event: Event) => {
      const customEvent = event as CustomEvent<{ userId?: string }>;
      const savedUserId = customEvent.detail?.userId;

      if (!savedUserId || savedUserId !== activeUserId) {
        return;
      }

      void loadSessions(savedUserId);
    };

    window.addEventListener(SESSION_SAVED_EVENT, handleSessionSaved);

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener(SESSION_SAVED_EVENT, handleSessionSaved);
    };
  }, [activeUserId]);

  if (isLoading) {
    return (
      <div className="glass-card p-6 fade-in">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Daily Report
        </h3>
        <p className="text-sm text-muted-foreground">Loading session data...</p>
      </div>
    );
  }

  return <DailyReportContent sessionsByDate={sessionsByDate} cachedYesterdaySession={cachedYesterdaySession} />;
}

function DailyReportContent({
  sessionsByDate,
  cachedYesterdaySession,
}: {
  sessionsByDate: Record<string, SessionData>;
  cachedYesterdaySession: SessionData | null;
}) {
  const todayKey = getTodayKey();
  const yesterdayKey = getYesterdayKey();
  const today = sessionsByDate[todayKey] ?? null;
  const yesterday = sessionsByDate[yesterdayKey] ?? cachedYesterdaySession;

  let streak = 0;
  const streakCursor = new Date();
  while (true) {
    const key = streakCursor.toISOString().split("T")[0];
    if (sessionsByDate[key]) {
      streak += 1;
      streakCursor.setDate(streakCursor.getDate() - 1);
    } else {
      break;
    }
  }

  const sevenDaySessions: Array<{ date: string; session: SessionData | null }> = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    sevenDaySessions.push({ date: key, session: sessionsByDate[key] ?? null });
  }

  const clampMetric = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
  const safeMetric = (value?: number) => clampMetric(value ?? 0);

  const todayMetrics = {
    focusScore: safeMetric(today?.focusScore),
    productivity: safeMetric(today?.productivity),
    backspaceRate: safeMetric(today?.backspaceRate),
    avgCognitiveLoad: safeMetric(today?.avgCognitiveLoad),
  };

  const yesterdayMetrics = {
    focusScore: safeMetric(yesterday?.focusScore),
    productivity: safeMetric(yesterday?.productivity),
    backspaceRate: safeMetric(yesterday?.backspaceRate),
    avgCognitiveLoad: safeMetric(yesterday?.avgCognitiveLoad),
  };

  const chartData = sevenDaySessions.map(({ date, session }) => {
    const day = new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" });
    return {
      day,
      focusScore: session ? clampMetric(session.focusScore) : null,
    };
  });

  const getPercentChange = (todayVal: number, yesterdayVal: number, higherIsBetter: boolean): number | null => {
    if (todayVal === yesterdayVal) {
      return 0;
    }

    if (yesterdayVal === 0) {
      return todayVal === 0 ? 0 : 100;
    }

    const rawChange = higherIsBetter
      ? ((todayVal - yesterdayVal) / Math.abs(yesterdayVal)) * 100
      : ((yesterdayVal - todayVal) / Math.abs(yesterdayVal)) * 100;

    return Math.round(rawChange);
  };

  const formatComparison = (todayVal: number, yesterdayVal: number, higherIsBetter: boolean) => {
    const percent = getPercentChange(todayVal, yesterdayVal, higherIsBetter);

    if (percent === null) {
      return null;
    }

    if (percent === 0) {
      return { text: "0%", improved: true };
    }

    const improved = percent > 0;
    const arrow = improved ? "↑" : "↓";
    return {
      text: `${arrow} ${Math.abs(percent)}%`,
      improved,
    };
  };

  const Row = ({
    label,
    todayVal,
    yesterdayVal,
    higherIsBetter,
  }: {
    label: string;
    todayVal?: number;
    yesterdayVal?: number;
    higherIsBetter: boolean;
  }) => {
    const comparison = todayVal !== undefined && yesterdayVal !== undefined
      ? formatComparison(todayVal, yesterdayVal, higherIsBetter)
      : null;

    return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-4">
        <span className="text-sm font-mono text-foreground">{todayVal !== undefined ? todayVal : 0}</span>
        {comparison && (
          <span className={`text-xs font-mono ${comparison.improved ? "text-focus-green" : "text-struggle-red"}`}>
            {comparison.text}
          </span>
        )}
      </div>
    </div>
    );
  };

  const getComparisonInsight = () => {
    if (!today && !yesterday) {
      return null;
    }

    const focusDelta = getPercentChange(todayMetrics.focusScore, yesterdayMetrics.focusScore, true) ?? 0;
    const prodDelta = getPercentChange(todayMetrics.productivity, yesterdayMetrics.productivity, true) ?? 0;
    const backspaceDelta = getPercentChange(todayMetrics.backspaceRate, yesterdayMetrics.backspaceRate, false) ?? 0;

    const improvedCount = [focusDelta, prodDelta, backspaceDelta].filter((d) => d > 0).length;
    const declinedCount = [focusDelta, prodDelta, backspaceDelta].filter((d) => d < 0).length;

    if (improvedCount === 3) {
      return { text: "Excellent momentum: focus, productivity, and editing accuracy all improved versus yesterday.", positive: true };
    }

    if (declinedCount === 3) {
      return { text: "All key metrics dipped today. Consider shorter sessions and a reset break to recover focus.", positive: false };
    }

    if (focusDelta > 0 && prodDelta > 0) {
      return { text: "Focus and productivity are both trending up today. Keep your current rhythm.", positive: true };
    }

    if (backspaceDelta < 0) {
      return { text: "Backspace rate increased versus yesterday, which may signal uncertainty. Slow down and plan before typing.", positive: false };
    }

    return {
      text: improvedCount >= declinedCount
        ? "Overall trend is positive with incremental gains across core metrics."
        : "Mixed performance today. Tightening attention cycles could improve consistency.",
      positive: improvedCount >= declinedCount,
    };
  };

  const comparisonInsight = getComparisonInsight();

  const hasSevenDayData = chartData.some((point) => point.focusScore !== null);

  return (
    <div className="glass-card p-6 fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Daily Report
        </h3>
        {streak > 0 && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-focus-green/10 text-focus-green">
            🔥 {streak} day streak
          </span>
        )}
      </div>

      {!today && !yesterday ? (
        <p className="text-sm text-muted-foreground">No session data yet. Start typing!</p>
      ) : (
        <>
          <Row
            label="Focus Score"
            todayVal={todayMetrics.focusScore}
            yesterdayVal={yesterdayMetrics.focusScore}
            higherIsBetter
          />
          <Row
            label="Productivity"
            todayVal={todayMetrics.productivity}
            yesterdayVal={yesterdayMetrics.productivity}
            higherIsBetter
          />
          <Row
            label="Backspace Rate"
            todayVal={todayMetrics.backspaceRate}
            yesterdayVal={yesterdayMetrics.backspaceRate}
            higherIsBetter={false}
          />
          <Row
            label="Avg Cognitive Load"
            todayVal={todayMetrics.avgCognitiveLoad}
            yesterdayVal={yesterdayMetrics.avgCognitiveLoad}
            higherIsBetter={false}
          />

          {comparisonInsight && (
            <p className={`text-sm mt-4 font-medium ${comparisonInsight.positive ? "text-focus-green" : "text-struggle-red"}`}>
              {comparisonInsight.text}
            </p>
          )}
          {!yesterday && today && (
            <p className="text-sm mt-4 text-muted-foreground">No previous session found — keep going!</p>
          )}

          <div className="mt-6 pt-4 border-t border-border/50">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              7-Day Focus Progress
            </h4>
            <div className="h-[170px]">
              {!hasSevenDayData ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  Not enough data for trend yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
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
                      stroke="oklch(0.72 0.19 160)"
                      strokeWidth={2.2}
                      connectNulls={false}
                      dot={{ r: 3, fill: "oklch(0.72 0.19 160)" }}
                      activeDot={{ r: 4, fill: "oklch(0.72 0.19 160)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
