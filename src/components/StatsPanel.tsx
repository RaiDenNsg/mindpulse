interface StatItemProps {
  label: string;
  value: string | number;
  unit?: string;
}

function StatItem({ label, value, unit }: StatItemProps) {
  const displayValue = unit ? `${value}${unit}` : String(value);

  return (
    <div className="metric-inline min-w-[118px] sm:min-w-[130px]">
      <p className="metric-inline-value text-foreground">{displayValue}</p>
      <p className="metric-inline-label">{label}</p>
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

  return (
    <section className="glass-card fade-in fade-in-delay-1">
      <div className="flex flex-wrap md:flex-nowrap items-center gap-3 md:gap-7 px-3 sm:px-4 py-3">
        <StatItem label="Session" value={formatDuration(sessionDuration)} />
        <div className="hidden md:block h-6 w-px bg-border shrink-0" />
        <StatItem label="Typing Speed" value={typingSpeed} unit=" wpm" />
        <div className="hidden md:block h-6 w-px bg-border shrink-0" />
        <StatItem label="Focus Score" value={focusScore} unit="%" />
        <div className="hidden md:block h-6 w-px bg-border shrink-0" />
        <StatItem label="Cognitive Load" value={cognitiveLoad} unit="/60" />
        <div className="hidden md:block h-6 w-px bg-border shrink-0" />
        <StatItem label="Backspace Rate" value={backspaceRate} unit="%" />
      </div>
    </section>
  );
}
