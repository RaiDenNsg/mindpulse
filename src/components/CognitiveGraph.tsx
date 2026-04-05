import { Area, AreaChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface CognitiveGraphProps {
  data: Array<{ time: number; load: number }>;
}

export default function CognitiveGraph({ data }: CognitiveGraphProps) {
  return (
    <div className="glass-card p-6 fade-in">
      <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
        Cognitive Load Over Time
      </h3>
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
                  <stop offset="0%" stopColor="oklch(0.72 0.19 160 / 40%)" />
                  <stop offset="60%" stopColor="oklch(0.72 0.19 160 / 16%)" />
                  <stop offset="100%" stopColor="oklch(0.72 0.19 160 / 2%)" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 260)" />
              <XAxis
                dataKey="time"
                stroke="oklch(0.5 0.02 260)"
                fontSize={11}
                tickFormatter={(v) => `${v}s`}
              />
              <YAxis
                stroke="oklch(0.5 0.02 260)"
                fontSize={11}
                width={30}
                domain={[(dataMin: number) => Math.max(0, Math.floor(dataMin - 5)), (dataMax: number) => Math.ceil(dataMax + 5)]}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.18 0.02 260 / 90%)",
                  border: "1px solid oklch(0.3 0.02 260)",
                  borderRadius: "8px",
                  color: "oklch(0.93 0.01 260)",
                  fontSize: 12,
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
                stroke="oklch(0.72 0.19 160)"
                strokeWidth={2.8}
                dot={false}
                activeDot={{ r: 4, fill: "oklch(0.72 0.19 160)", strokeWidth: 0 }}
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
