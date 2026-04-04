interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  color?: "green" | "yellow" | "red" | "default";
}

function StatCard({ label, value, unit, color = "default" }: StatCardProps) {
  const colorMap = {
    green: "text-focus-green glow-green",
    yellow: "text-neutral-yellow glow-yellow",
    red: "text-struggle-red glow-red",
    default: "text-foreground",
  };

  return (
    <div className="glass-card p-5 fade-in">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      <p className={`stat-value ${colorMap[color]}`}>
        {value}
        {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
      </p>
    </div>
  );
}

interface StatsPanelProps {
  typingSpeed: number;
  backspaceRate: number;
  cognitiveLoad: number;
  focusScore: number;
  sessionDuration: number;
}

export default function StatsPanel({
  typingSpeed,
  backspaceRate,
  cognitiveLoad,
  focusScore,
  sessionDuration,
}: StatsPanelProps) {
  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const loadColor = cognitiveLoad < 20 ? "green" : cognitiveLoad < 50 ? "yellow" : "red";

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <StatCard label="Typing Speed" value={typingSpeed} unit="k/min" color="green" />
      <StatCard label="Backspace Rate" value={`${backspaceRate}%`} color={backspaceRate > 25 ? "red" : "default"} />
      <StatCard label="Cognitive Load" value={cognitiveLoad} color={loadColor} />
      <StatCard label="Focus Score" value={`${focusScore}%`} color={focusScore > 60 ? "green" : "yellow"} />
      <StatCard label="Session" value={formatDuration(sessionDuration)} />
    </div>
  );
}
