import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
        {data.length < 2 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Start typing to generate data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0.02 260)" />
              <XAxis
                dataKey="time"
                stroke="oklch(0.5 0.02 260)"
                fontSize={11}
                tickFormatter={(v) => `${v}s`}
              />
              <YAxis stroke="oklch(0.5 0.02 260)" fontSize={11} />
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
                dataKey="load"
                stroke="oklch(0.72 0.19 160)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: "oklch(0.72 0.19 160)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
