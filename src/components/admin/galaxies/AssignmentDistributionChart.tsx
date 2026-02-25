import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Rectangle,
} from "recharts";

interface ChartDatum {
  assignments: number;
  galaxies: number;
}

interface AssignmentDistributionChartProps {
  chartData: ChartDatum[];
  targetN: number;
  barColor: (assignments: number) => string;
  fmt: (n: number) => string;
}

interface BarShapeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: ChartDatum;
}

function CustomTooltip({ active, payload, label, fmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-gray-900 dark:text-white mb-1">
        Assigned {label} time{label !== 1 ? "s" : ""}
      </p>
      <p className="text-blue-600 dark:text-blue-400">
        {fmt(payload[0].value)} galaxies
      </p>
    </div>
  );
}

export default function AssignmentDistributionChart({
  chartData,
  targetN,
  barColor,
  fmt,
}: AssignmentDistributionChartProps) {
  const renderBarShape = (props: BarShapeProps) => (
    <Rectangle
      {...props}
      radius={[3, 3, 0, 0]}
      fill={barColor(props.payload?.assignments ?? 0)}
    />
  );

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="assignments"
          label={{
            value: "Times assigned",
            position: "insideBottom",
            offset: -2,
            style: { fontSize: 12, fill: "#6b7280" },
          }}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          tickFormatter={(v: number) =>
            v >= 1_000_000
              ? `${(v / 1_000_000).toFixed(1)}M`
              : v >= 1_000
              ? `${(v / 1_000).toFixed(0)}k`
              : String(v)
          }
          tick={{ fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip fmt={fmt} />} />
        <ReferenceLine
          x={targetN}
          stroke="#6366f1"
          strokeDasharray="6 3"
          label={{
            value: `Target: ${targetN}`,
            position: "insideTopRight",
            style: { fontSize: 11, fill: "#6366f1" },
          }}
        />
        <Bar dataKey="galaxies" shape={renderBarShape} />
      </BarChart>
    </ResponsiveContainer>
  );
}
