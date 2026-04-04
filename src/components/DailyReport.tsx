import { useState, useEffect } from "react";
import { getSession, getTodayKey, getYesterdayKey, getStreak } from "@/utils/storage";

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

  const diff = (a: number, b: number) => {
    const d = a - b;
    const sign = d > 0 ? "+" : "";
    return `${sign}${d}`;
  };

  const Row = ({ label, todayVal, yesterdayVal }: { label: string; todayVal?: number; yesterdayVal?: number }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-4">
        <span className="text-sm font-mono text-foreground">{todayVal ?? "—"}</span>
        {yesterday && yesterdayVal !== undefined && todayVal !== undefined && (
          <span className={`text-xs font-mono ${todayVal >= yesterdayVal ? "text-focus-green" : "text-struggle-red"}`}>
            {diff(todayVal, yesterdayVal)}
          </span>
        )}
      </div>
    </div>
  );

  const improvement = today && yesterday
    ? Math.round(today.focusScore - yesterday.focusScore)
    : null;

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
          <Row label="Focus Score" todayVal={today?.focusScore} yesterdayVal={yesterday?.focusScore} />
          <Row label="Productivity" todayVal={today?.productivity} yesterdayVal={yesterday?.productivity} />
          <Row label="Backspace Rate" todayVal={today?.backspaceRate} yesterdayVal={yesterday?.backspaceRate} />
          <Row label="Avg Cognitive Load" todayVal={today?.avgCognitiveLoad} yesterdayVal={yesterday?.avgCognitiveLoad} />

          {improvement !== null && (
            <p className={`text-sm mt-4 font-medium ${improvement >= 0 ? "text-focus-green" : "text-struggle-red"}`}>
              {improvement >= 0
                ? `You improved focus by ${improvement}% today ✨`
                : `Focus dropped by ${Math.abs(improvement)}% — take a break? 💆`}
            </p>
          )}
          {!yesterday && today && (
            <p className="text-sm mt-4 text-muted-foreground">No previous session found — keep going!</p>
          )}
        </>
      )}
    </div>
  );
}
