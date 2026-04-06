interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  color?: "green" | "yellow" | "red" | "default";
  icon?: string;
}

function StatCard({ label, value, unit, color = "default", icon }: StatCardProps) {
  const colorMap = {
    green: "text-focus-green",
    yellow: "text-neutral-yellow",
    red: "text-struggle-red",
    default: "text-foreground",
  };

  const borderColorMap = {
    green: "border-t-focus-green/40",
    yellow: "border-t-neutral-yellow/40",
    red: "border-t-struggle-red/40",
    default: "border-t-primary/20",
  };

  return (
    <div className={`glass-card p-6 lg:p-6.5 fade-in fade-in-delay-1 border-t-2 ${borderColorMap[color]} hover:bg-accent/20 hover:shadow-[0_0_20px_rgba(0,0,0,0.3)] transition-all duration-300 cursor-default`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[11px] text-muted-foreground uppercase tracking-[0.22em] font-semibold">{label}</p>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <p className={`stat-value ${colorMap[color]}`}>
        {value}
        {unit && <span className="text-base font-medium text-muted-foreground ml-1.5">{unit}</span>}
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
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 lg:gap-5 fade-in fade-in-delay-1">
      <StatCard label="Session" value={formatDuration(sessionDuration)} color="default" icon="⏱" />
      <StatCard label="Typing Speed" value={typingSpeed} unit="WPM" color="green" icon="⌨️" />
      <StatCard label="Focus Score" value={focusScore} unit="%" color={focusScore > 60 ? "green" : "yellow"} icon="🎯" />
      <StatCard label="Cognitive Load" value={cognitiveLoad} unit="/60" color={loadColor} icon="🧠" />
      <StatCard label="Backspace Rate" value={backspaceRate} unit="%" color={backspaceRate > 25 ? "red" : "default"} icon="⌫" />
    </div>
  );
}
