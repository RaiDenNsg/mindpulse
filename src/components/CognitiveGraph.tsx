import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface CognitiveGraphProps {
  data: Array<{ time: number; load: number }>;
}

export default function CognitiveGraph({ data }: CognitiveGraphProps) {
  const avgLoad = data.length > 0 ? Math.round(data.reduce((sum, d) => sum + d.load, 0) / data.length) : 0;

  return (
    <section className="glass-card p-5 fade-in fade-in-delay-2">
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <div>
            <h3 className="text-sm font-medium text-foreground">Real-time Cognitive Effort</h3>
            <p className="text-xs text-muted-foreground mt-1">Current mental workload over time</p>
          </div>
          {data.length > 0 && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Average</p>
              <p className="text-lg font-semibold text-primary">{avgLoad}/60</p>
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
            <LineChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.005 260)" opacity={0.6} />
              <XAxis
                dataKey="time"
                stroke="oklch(0.6 0.01 260)"
                fontSize={11}
                tickFormatter={(v) => `${v}s`}
              />
              <YAxis
                stroke="oklch(0.6 0.01 260)"
                fontSize={11}
                width={30}
                domain={[(dataMin: number) => Math.max(0, Math.floor(dataMin - 5)), (dataMax: number) => Math.ceil(dataMax + 5)]}
              />
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
                dataKey="load"
                stroke="oklch(0.72 0.18 158)"
                strokeWidth={2.2}
                dot={false}
                activeDot={{ r: 4, fill: "oklch(0.72 0.18 158)", strokeWidth: 0 }}
                isAnimationActive
                animationDuration={550}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
