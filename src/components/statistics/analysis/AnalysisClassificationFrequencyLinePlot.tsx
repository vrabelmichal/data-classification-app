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
  AnalysisClassificationFrequencyPlot as AnalysisClassificationFrequencyPlotData,
  AnalysisDistributionComparisonScale,
} from "./helpers";

const LINE_COLORS = [
  "#2563eb",
  "#dc2626",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#be123c",
  "#4f46e5",
];

function formatRelativeFrequency(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function FrequencyLineTooltip({ active, payload, scale }: any) {
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

interface AnalysisClassificationFrequencyLinePlotProps {
  plot: AnalysisClassificationFrequencyPlotData;
  scale: AnalysisDistributionComparisonScale;
  height?: number;
}

export function AnalysisClassificationFrequencyLinePlot({
  plot,
  scale,
  height = 320,
}: AnalysisClassificationFrequencyLinePlotProps) {
  if (plot.cells.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
        No classifications available for this frequency line plot.
      </div>
    );
  }

  const chartData = plot.xTickLabels.map((xLabel, xIndex) => {
    const row: Record<string, number | string | null> = {
      xIndex,
      xLabel,
    };

    plot.yTickLabels.forEach((yLabel, yIndex) => {
      const cell = plot.cells.find(
        (candidate) => candidate.xIndex === xIndex && candidate.yIndex === yIndex
      );
      row[`series-${yIndex}`] =
        scale === "relativeFrequency"
          ? cell?.totalRelativeFrequency ?? 0
          : cell?.totalCount ?? 0;
    });

    return row;
  });

  const valueFormatter = (value: number) =>
    scale === "relativeFrequency"
      ? formatRelativeFrequency(value)
      : value.toLocaleString();
  const needsAngledTicks = plot.xTickLabels.length > 10;

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 24, left: 0, bottom: needsAngledTicks ? 48 : 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            dataKey="xIndex"
            domain={[-0.5, Math.max(plot.xTickLabels.length - 0.5, 0.5)]}
            ticks={plot.xTickLabels.map((_, index) => index)}
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
          <Tooltip content={<FrequencyLineTooltip scale={scale} />} />
          <Legend />
          {plot.thresholdMarkers.map((marker) => (
            <ReferenceLine
              key={marker.key}
              x={marker.xPosition}
              stroke="#64748b"
              strokeDasharray="5 5"
              label={{ value: marker.label, position: "top", fontSize: 11 }}
            />
          ))}
          {plot.yTickLabels.map((yLabel, yIndex) => (
            <Line
              key={yLabel}
              type="monotone"
              dataKey={`series-${yIndex}`}
              name={yLabel}
              stroke={LINE_COLORS[yIndex % LINE_COLORS.length]}
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>
          Line height uses {scale === "relativeFrequency" ? "relative frequency" : "count"} per X bin.
        </span>
        {plot.thresholdMarkers.length > 0 ? (
          <span>Split thresholds on the X axis are marked with vertical reference lines.</span>
        ) : null}
        {plot.note ? <span>{plot.note}</span> : null}
      </div>
    </div>
  );
}