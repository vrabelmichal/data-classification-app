import {
  type AnalysisDistributionComparisonScale,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ComparisonHistogramDatum } from "./helpers";

function formatRelativeFrequency(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function ComparisonHistogramTooltip({
  active,
  payload,
  label,
  scale,
  subjectLabelPlural,
}: any) {
  if (!active || !payload?.length) {
    return null;
  }

  const datum = payload[0]?.payload as ComparisonHistogramDatum | undefined;
  if (!datum) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <p className="font-medium text-gray-900 dark:text-white">{datum.metricLabel}</p>
      <p className="text-gray-600 dark:text-gray-300">Bucket: {label}</p>
      <p className="text-emerald-700 dark:text-emerald-300">
        Matches thresholds: {datum.matchedCount.toLocaleString()} {subjectLabelPlural}
        {scale === "relativeFrequency"
          ? ` (${formatRelativeFrequency(datum.matchedRelativeFrequency)})`
          : ""}
      </p>
      <p className="text-rose-700 dark:text-rose-300">
        Fails thresholds: {datum.failedCount.toLocaleString()} {subjectLabelPlural}
        {scale === "relativeFrequency"
          ? ` (${formatRelativeFrequency(datum.failedRelativeFrequency)})`
          : ""}
      </p>
    </div>
  );
}

interface AnalysisComparisonHistogramProps {
  data: ComparisonHistogramDatum[];
  scale: AnalysisDistributionComparisonScale;
  subjectLabelPlural?: string;
  height?: number;
}

export function AnalysisComparisonHistogram({
  data,
  scale,
  subjectLabelPlural = "records",
  height = 280,
}: AnalysisComparisonHistogramProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
        No matching galaxies for this histogram.
      </div>
    );
  }

  const chartData = data.map((datum) => ({
    ...datum,
    matchedValue:
      scale === "relativeFrequency"
        ? datum.matchedRelativeFrequency ?? 0
        : datum.matchedCount,
    failedValue:
      scale === "relativeFrequency"
        ? datum.failedRelativeFrequency ?? 0
        : datum.failedCount,
  }));

  const valueFormatter = (value: number) =>
    scale === "relativeFrequency"
      ? formatRelativeFrequency(value)
      : value.toLocaleString();

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
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
          allowDecimals={scale === "relativeFrequency"}
          domain={scale === "relativeFrequency" ? [0, 1] : undefined}
          tickFormatter={valueFormatter}
        />
        <Tooltip
          content={
            <ComparisonHistogramTooltip
              scale={scale}
              subjectLabelPlural={subjectLabelPlural}
            />
          }
        />
        <Legend />
        <Line
          type="stepAfter"
          dataKey="matchedValue"
          name="Matches thresholds"
          stroke="#059669"
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="stepAfter"
          dataKey="failedValue"
          name="Fails thresholds"
          stroke="#e11d48"
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}