import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  AnalysisClassificationCountLinePlot as AnalysisClassificationCountLinePlotData,
  AnalysisDistributionComparisonScale,
} from "./helpers";

const LINE_COLORS = {
  scoped: "#2563eb",
  matched: "#059669",
  failed: "#dc2626",
};

function formatRelativeFrequency(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function buildDisplayedXTicks(tickLabels: string[]) {
  if (tickLabels.length <= 12) {
    return tickLabels.map((_, index) => index);
  }

  const maxDisplayedTicks = tickLabels.length > 48 ? 8 : 12;
  const step = Math.max(1, Math.ceil((tickLabels.length - 1) / (maxDisplayedTicks - 1)));
  const ticks: number[] = [];

  for (let index = 0; index < tickLabels.length; index += step) {
    ticks.push(index);
  }

  const lastIndex = tickLabels.length - 1;
  if (ticks[ticks.length - 1] !== lastIndex) {
    ticks.push(lastIndex);
  }

  return ticks;
}

function CountLineTooltip({ active, payload, scale }: any) {
  if (!active || !payload?.length) {
    return null;
  }

  const xLabel = payload[0]?.payload?.xLabel as string | undefined;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <p className="font-medium text-gray-900 dark:text-white">X bin: {xLabel ?? "-"}</p>
      <div className="mt-2 space-y-1">
        {payload.map((entry: any) => (
          <p key={entry.dataKey} className="text-gray-700 dark:text-gray-200">
            <span style={{ color: entry.color }}>{entry.name}</span>: {scale === "relativeFrequency" ? formatRelativeFrequency(entry.value) : Number(entry.value).toLocaleString()}
          </p>
        ))}
      </div>
    </div>
  );
}

interface AnalysisClassificationCountLinePlotProps {
  plot: AnalysisClassificationCountLinePlotData;
  scale: AnalysisDistributionComparisonScale;
  height?: number;
}

export function AnalysisClassificationCountLinePlot({
  plot,
  scale,
  height = 320,
}: AnalysisClassificationCountLinePlotProps) {
  if (plot.bins.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
        No classifications available for this count line plot.
      </div>
    );
  }

  const hasFailedSeries = plot.bins.some((bin) => bin.failedCount > 0);
  const showScopedSeries = !hasFailedSeries && plot.bins.every((bin) => bin.matchedCount === bin.scopedCount);
  const chartData = plot.bins.map((bin) => ({
    xIndex: bin.xIndex,
    xLabel: bin.xLabel,
    scoped:
      scale === "relativeFrequency" ? bin.scopedRelativeFrequency ?? 0 : bin.scopedCount,
    matched:
      scale === "relativeFrequency" ? bin.matchedRelativeFrequency ?? 0 : bin.matchedCount,
    failed:
      scale === "relativeFrequency" ? bin.failedRelativeFrequency ?? 0 : bin.failedCount,
  }));
  const displayedXTicks = buildDisplayedXTicks(plot.xTickLabels);
  const needsAngledTicks = displayedXTicks.length > 8;
  const valueFormatter = (value: number) =>
    scale === "relativeFrequency"
      ? formatRelativeFrequency(value)
      : value.toLocaleString();

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 32, right: 24, left: 0, bottom: needsAngledTicks ? 48 : 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            dataKey="xIndex"
            domain={[-0.5, Math.max(plot.xTickLabels.length - 0.5, 0.5)]}
            ticks={displayedXTicks}
            tickFormatter={(value) => plot.xTickLabels[Math.round(value)] ?? ""}
            tick={{ fontSize: 12 }}
            interval={0}
            angle={needsAngledTicks ? -30 : 0}
            textAnchor={needsAngledTicks ? "end" : "middle"}
            height={needsAngledTicks ? 60 : 32}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            allowDecimals={scale === "relativeFrequency"}
            domain={scale === "relativeFrequency" ? [0, 1] : undefined}
            tickFormatter={valueFormatter}
          />
          <Tooltip content={<CountLineTooltip scale={scale} />} />
          <Legend />
          {plot.thresholdMarkers.map((marker) => (
            <ReferenceLine
              key={marker.key}
              x={marker.xPosition}
              stroke="#64748b"
              strokeDasharray="5 5"
              label={{ value: marker.label, position: "top", fontSize: 11, offset: 10 }}
            />
          ))}
          {showScopedSeries ? (
            <Line
              type="monotone"
              dataKey="scoped"
              name="Scoped classifications"
              stroke={LINE_COLORS.scoped}
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ) : (
            <>
              <Line
                type="monotone"
                dataKey="matched"
                name="Matches thresholds"
                stroke={LINE_COLORS.matched}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 4 }}
              />
              {hasFailedSeries ? (
                <Line
                  type="monotone"
                  dataKey="failed"
                  name="Fails thresholds"
                  stroke={LINE_COLORS.failed}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ) : null}
            </>
          )}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>
          Line height uses {scale === "relativeFrequency" ? "share across each subset over time" : "classification count per X bin"}.
        </span>
        {plot.thresholdMarkers.length > 0 ? (
          <span>Split thresholds on the X axis are marked with vertical reference lines.</span>
        ) : null}
        {plot.note ? <span>{plot.note}</span> : null}
      </div>
    </div>
  );
}