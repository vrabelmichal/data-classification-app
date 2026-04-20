import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import type {
  AnalysisClassificationFrequencyPlot as AnalysisClassificationFrequencyPlotData,
  AnalysisDistributionComparisonScale,
} from "./helpers";

function formatRelativeFrequency(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function FrequencyPlotTooltip({ active, payload, scale }: any) {
  if (!active || !payload?.length) {
    return null;
  }

  const datum = payload[0]?.payload as
    | {
        seriesLabel: string;
        xLabel: string;
        yLabel: string;
        count: number;
        relativeFrequency: number | null;
      }
    | undefined;
  if (!datum) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <p className="font-medium text-gray-900 dark:text-white">{datum.seriesLabel}</p>
      <p className="text-gray-600 dark:text-gray-300">X bin: {datum.xLabel}</p>
      <p className="text-gray-600 dark:text-gray-300">Y bucket: {datum.yLabel}</p>
      <p className="text-gray-700 dark:text-gray-200">
        Count: {datum.count.toLocaleString()}
      </p>
      <p className="text-gray-700 dark:text-gray-200">
        {scale === "relativeFrequency" ? "Relative frequency" : "Share of subset"}: {formatRelativeFrequency(datum.relativeFrequency)}
      </p>
    </div>
  );
}

interface AnalysisClassificationFrequencyPlotProps {
  plot: AnalysisClassificationFrequencyPlotData;
  scale: AnalysisDistributionComparisonScale;
  height?: number;
}

export function AnalysisClassificationFrequencyPlot({
  plot,
  scale,
  height,
}: AnalysisClassificationFrequencyPlotProps) {
  if (plot.cells.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-400">
        No classifications available for this frequency plot.
      </div>
    );
  }

  const matchedSeries = plot.cells
    .filter((cell) => cell.matchedCount > 0)
    .map((cell) => ({
      xValue: cell.xIndex - 0.16,
      yValue: cell.yIndex,
      zValue:
        scale === "relativeFrequency"
          ? cell.matchedRelativeFrequency ?? 0
          : cell.matchedCount,
      seriesLabel: "Matches thresholds",
      xLabel: cell.xLabel,
      yLabel: cell.yLabel,
      count: cell.matchedCount,
      relativeFrequency: cell.matchedRelativeFrequency,
    }));
  const failedSeries = plot.cells
    .filter((cell) => cell.failedCount > 0)
    .map((cell) => ({
      xValue: cell.xIndex + 0.16,
      yValue: cell.yIndex,
      zValue:
        scale === "relativeFrequency"
          ? cell.failedRelativeFrequency ?? 0
          : cell.failedCount,
      seriesLabel: "Fails thresholds",
      xLabel: cell.xLabel,
      yLabel: cell.yLabel,
      count: cell.failedCount,
      relativeFrequency: cell.failedRelativeFrequency,
    }));

  const chartHeight =
    height ?? Math.max(300, Math.min(460, 220 + plot.yTickLabels.length * 30));
  const xTicks = plot.xTickLabels.map((_, index) => index);
  const yTicks = plot.yTickLabels.map((_, index) => index);
  const xAxisMax = Math.max(plot.xTickLabels.length - 0.5, 0.5);
  const yAxisMax = Math.max(plot.yTickLabels.length - 0.5, 0.5);
  const maxZ =
    scale === "relativeFrequency"
      ? Math.max(plot.maxRelativeFrequency, 0.001)
      : Math.max(plot.maxCount, 1);
  const needsAngledTicks = plot.xTickLabels.length > 10;

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ScatterChart
          margin={{
            top: 8,
            right: 24,
            left: 0,
            bottom: needsAngledTicks ? 48 : 8,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            type="number"
            dataKey="xValue"
            domain={[-0.5, xAxisMax]}
            ticks={xTicks}
            tickFormatter={(value) => plot.xTickLabels[Math.round(value)] ?? ""}
            tick={{ fontSize: 12 }}
            interval={0}
            angle={needsAngledTicks ? -30 : 0}
            textAnchor={needsAngledTicks ? "end" : "middle"}
            height={needsAngledTicks ? 60 : 32}
          />
          <YAxis
            type="number"
            dataKey="yValue"
            domain={[-0.5, yAxisMax]}
            ticks={yTicks}
            tickFormatter={(value) => plot.yTickLabels[Math.round(value)] ?? ""}
            tick={{ fontSize: 12 }}
            width={100}
          />
          <ZAxis type="number" dataKey="zValue" domain={[0, maxZ]} range={[60, 420]} />
          <Tooltip content={<FrequencyPlotTooltip scale={scale} />} />
          <Legend />
          <Scatter
            name="Matches thresholds"
            data={matchedSeries}
            fill="#059669"
            fillOpacity={0.72}
          />
          <Scatter
            name="Fails thresholds"
            data={failedSeries}
            fill="#e11d48"
            fillOpacity={0.58}
          />
        </ScatterChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        <span>
          Bubble size uses {scale === "relativeFrequency" ? "relative frequency" : "count"} per X/Y bin.
        </span>
        {plot.note ? <span>{plot.note}</span> : null}
      </div>
    </div>
  );
}