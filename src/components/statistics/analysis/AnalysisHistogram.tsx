import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistogramDatum } from "./helpers";

function HistogramTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) {
    return null;
  }

  const datum = payload[0]?.payload as HistogramDatum | undefined;
  if (!datum) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <p className="font-medium text-gray-900 dark:text-white">{datum.metricLabel}</p>
      <p className="text-gray-600 dark:text-gray-300">Bucket: {label}</p>
      <p className="text-blue-600 dark:text-blue-400">
        {datum.count.toLocaleString()} galaxies
      </p>
    </div>
  );
}

interface AnalysisHistogramProps {
  data: HistogramDatum[];
  height?: number;
}

export function AnalysisHistogram({ data, height = 240 }: AnalysisHistogramProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
        No matching galaxies for this histogram.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12 }}
          interval={0}
          angle={data.length > 8 ? -30 : 0}
          textAnchor={data.length > 8 ? "end" : "middle"}
          height={data.length > 8 ? 56 : 32}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          allowDecimals={false}
          tickFormatter={(value: number) => value.toLocaleString()}
        />
        <Tooltip content={<HistogramTooltip />} />
        <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}