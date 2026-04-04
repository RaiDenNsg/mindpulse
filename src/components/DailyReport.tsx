import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getSession, getTodayKey, getYesterdayKey, getStreak, getLastNDaysSessions } from "@/utils/storage";

export default function DailyReport() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="glass-card p-6 fade-in">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
          Daily Report
        </h3>
        <p className="text-sm text-muted-foreground">Loading session data...</p>
      </div>
    );
  }

  return <DailyReportContent />;
}

function DailyReportContent() {
  const today = getSession(getTodayKey());
  const yesterday = getSession(getYesterdayKey());
  const streak = getStreak();
  const sevenDaySessions = getLastNDaysSessions(7);

  const chartData = sevenDaySessions.map(({ date, session }) => {
    const day = new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" });
    return {
      day,
      focusScore: session?.focusScore ?? null,
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
    suffix = "%",
  }: {
    label: string;
    todayVal?: number;
    yesterdayVal?: number;
    higherIsBetter: boolean;
    suffix?: string;
  }) => {
    const comparison = todayVal !== undefined && yesterdayVal !== undefined
      ? formatComparison(todayVal, yesterdayVal, higherIsBetter)
      : null;

    return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-4">
        <span className="text-sm font-mono text-foreground">{todayVal !== undefined ? `${todayVal}${suffix}` : "—"}</span>
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
    if (!today || !yesterday) {
      return null;
    }

    const focusDelta = getPercentChange(today.focusScore, yesterday.focusScore, true) ?? 0;
    const prodDelta = getPercentChange(today.productivity, yesterday.productivity, true) ?? 0;
    const backspaceDelta = getPercentChange(today.backspaceRate, yesterday.backspaceRate, false) ?? 0;

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
            todayVal={today?.focusScore}
            yesterdayVal={yesterday?.focusScore}
            higherIsBetter
          />
          <Row
            label="Productivity"
            todayVal={today?.productivity}
            yesterdayVal={yesterday?.productivity}
            higherIsBetter
          />
          <Row
            label="Backspace Rate"
            todayVal={today?.backspaceRate}
            yesterdayVal={yesterday?.backspaceRate}
            higherIsBetter={false}
          />
          <Row
            label="Avg Cognitive Load"
            todayVal={today?.avgCognitiveLoad}
            yesterdayVal={yesterday?.avgCognitiveLoad}
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
