import { Area, AreaChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface CognitiveGraphProps {
  data: Array<{ time: number; load: number }>;
}

export default function CognitiveGraph({ data }: CognitiveGraphProps) {
  const avgLoad = data.length > 0 ? Math.round(data.reduce((sum, d) => sum + d.load, 0) / data.length) : 0;
  const maxLoad = data.length > 0 ? Math.max(...data.map(d => d.load)) : 0;
  
  // Dynamic gradient based on cognitive load intensity
  const getGradientColor = (load: number) => {
    if (load < 20) return "oklch(0.72 0.19 160"; // Blue-green (calm)
    if (load < 40) return "oklch(0.75 0.18 120"; // Green (focused)
    if (load < 50) return "oklch(0.80 0.18 85"; // Yellow (challenged)
    return "oklch(0.60 0.20 20"; // Red (struggling)
  };
  
  const gradientColor = getGradientColor(avgLoad);
  const lineColor = getGradientColor(maxLoad);

  return (
    <div className="glass-card p-6 fade-in fade-in-delay-2">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Real-time Cognitive Effort</h3>
            <p className="text-xs text-muted-foreground mt-1">Monitoring your mental workload during this session</p>
          </div>
          {data.length > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Average</p>
              <p className="text-lg font-bold text-primary">{avgLoad}/60</p>
            </div>
          )}
        </div>
      </div>
      <div className="h-[250px]">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Start typing to generate data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cognitiveLoadGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`${gradientColor} / 45%)`} />
                  <stop offset="60%" stopColor={`${gradientColor} / 20%)`} />
                  <stop offset="100%" stopColor={`${gradientColor} / 3%)`} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="6 4" stroke="oklch(0.25 0.01 260)" opacity={0.5} />
              <XAxis
                dataKey="time"
                stroke="oklch(0.45 0.01 260)"
                fontSize={11}
                tickFormatter={(v) => `${v}s`}
              />
              <YAxis
                stroke="oklch(0.45 0.01 260)"
                fontSize={11}
                width={30}
                domain={[(dataMin: number) => Math.max(0, Math.floor(dataMin - 5)), (dataMax: number) => Math.ceil(dataMax + 5)]}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.18 0.02 260 / 92%)",
                  border: "1px solid oklch(0.4 0.02 260)",
                  borderRadius: "8px",
                  color: "oklch(0.93 0.01 260)",
                  fontSize: 12,
                  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
                }}
              />
              <Area
                type="monotone"
                dataKey="load"
                stroke="none"
                fill="url(#cognitiveLoadGradient)"
                isAnimationActive
                animationDuration={900}
              />
              <Line
                type="monotone"
                dataKey="load"
                stroke={lineColor}
                strokeWidth={2.8}
                dot={false}
                activeDot={{ r: 5, fill: lineColor, strokeWidth: 0 }}
                isAnimationActive
                animationDuration={900}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
