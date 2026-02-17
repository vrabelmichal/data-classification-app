import { useMemo, useState } from "react";
import { defaultImageDisplaySettings } from "../../../images/defaultImageDisplaySettings";
import {
  decodeQuantile,
  imageTypeMap,
  parseImageLabel,
  scaleMap,
  thresholdRefMap,
} from "../imageDocs/labelDecoder";

const symbolRows = [
  ["≡", "Unified threshold", "≡b means 'use band threshold'"] as const,
  ["Q", "Quantile / normalization marker", "Q99.9 or Qzs"] as const,
  ["lin", "Linear scale", "Direct pixel mapping"] as const,
  ["log", "Logarithmic scale", "Boosts faint structures"] as const,
  ["sym", "Symlog scale", "Useful for residuals with negatives"] as const,
  ["asi", "Asinh scale", "Used in Lupton RGB"] as const,
  ["apt", "APLpy stretch", "Used in APLpy RGB"] as const,
  ["b", "Band threshold reference", "≡b means unified to band"] as const,
  ["m", "Model threshold reference", "≡m means unified to model"] as const,
  ["r", "Residual threshold reference", "≡r means unified to residual"] as const,
];

const cellStyle =
  "rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 p-3 min-h-[110px] flex flex-col justify-between";

function gridCellTitle(index: number) {
  if (index === 0) return "Observed data (g-band)";
  if (index === 1) return "Residual (data - fit)";
  if (index === 2) return "Fit / model";
  return `Comparison view ${index - 2}`;
}

function shortLabel(labelOrKey: string | undefined) {
  if (!labelOrKey) return "(missing label)";
  return labelOrKey.replace(/\n/g, " ");
}

export function ImageDocumentationSection() {
  const [labelInput, setLabelInput] = useState("123456789 (g ≡b lin Q99.9)");
  const decodedLabel = useMemo(() => parseImageLabel(labelInput), [labelInput]);
  const contrastGroups = defaultImageDisplaySettings.classification.contrastGroups;
  const mobileOrder = defaultImageDisplaySettings.classification.defaultMobileOrder ?? [0, 1, 2, 3, 4, 5];
  const firstGroup = contrastGroups[0] ?? [];
  const mobileExamples = mobileOrder.map((index) => firstGroup[index]);
  const imagesByPosition = Array.from({ length: 6 }, (_, positionIndex) =>
    contrastGroups.map((group, groupIndex) => ({
      groupNumber: groupIndex + 1,
      entry: group[positionIndex],
    })),
  );

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Images in Classification Interface</h2>

        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 mb-4">
          <h3 className="text-base font-semibold text-blue-900 dark:text-blue-100 mb-1">💡 Quick Start</h3>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Each view is a contrast group with exactly six images. Press
            <kbd className="mx-1 px-2 py-0.5 text-xs rounded border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-900">C</kbd>
            for next group and
            <kbd className="mx-1 px-2 py-0.5 text-xs rounded border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-900">
              Shift+C
            </kbd>
            for previous group.
          </p>
        </div>

        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
          <p>
            On desktop, the first three images are always the single-band analysis set: observed g-band data, residual
            (data - fit), and fit/model.
          </p>
          <p>
            Positions 4-6 provide additional RGB comparison views (APLpy/Lupton variants) that help reveal faint structure,
            check color balance, and reduce stretch-specific interpretation bias.
          </p>
          <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4 bg-gray-50 dark:bg-gray-900">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Display toggles</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-semibold">Mask toggle (Shift+M):</span> switches between masked and unmasked image
                variants (when both are available) to help isolate target structure from contaminants.
              </li>
              <li>
                <span className="font-semibold">Effective radius overlay (Shift+R):</span> shows/hides the fitted
                effective radius marker so users can compare visible morphology against model size.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Grid Layout & Mobile Reordering</h3>
        <div className="space-y-5 text-sm text-gray-600 dark:text-gray-300">
          <section>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Desktop layout (visual)</h4>
            <div className="grid grid-cols-3 gap-2">
              <div className={cellStyle}>
                <div className="text-xs font-mono text-gray-500">index 0</div>
                <div className="text-2xl">📡</div>
                <div className="font-semibold text-gray-900 dark:text-white">Observed data</div>
                <div className="text-xs">g-band image</div>
              </div>
              <div className={cellStyle}>
                <div className="text-xs font-mono text-gray-500">index 1</div>
                <div className="text-2xl">➖</div>
                <div className="font-semibold text-gray-900 dark:text-white">Residual</div>
                <div className="text-xs">data - fit</div>
              </div>
              <div className={cellStyle}>
                <div className="text-xs font-mono text-gray-500">index 2</div>
                <div className="text-2xl">🧩</div>
                <div className="font-semibold text-gray-900 dark:text-white">Fit / model</div>
                <div className="text-xs">GALFIT model</div>
              </div>
              <div className={cellStyle}>
                <div className="text-xs font-mono text-gray-500">index 3</div>
                <div className="text-2xl">🌈</div>
                <div className="font-semibold text-gray-900 dark:text-white">RGB compare A</div>
                <div className="text-xs">APLpy/Lupton</div>
              </div>
              <div className={cellStyle}>
                <div className="text-xs font-mono text-gray-500">index 4</div>
                <div className="text-2xl">🌈</div>
                <div className="font-semibold text-gray-900 dark:text-white">RGB compare B</div>
                <div className="text-xs">APLpy/Lupton</div>
              </div>
              <div className={cellStyle}>
                <div className="text-xs font-mono text-gray-500">index 5</div>
                <div className="text-2xl">🌈</div>
                <div className="font-semibold text-gray-900 dark:text-white">RGB compare C</div>
                <div className="text-xs">APLpy/Lupton</div>
              </div>
            </div>
          </section>

          <section>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Mobile order</h4>
            <pre className="text-xs sm:text-sm font-mono bg-gray-50 dark:bg-gray-900 rounded p-3 overflow-x-auto">
{`Configured order: [${mobileOrder.join(", ")}]

Example sequence:
1) index ${mobileOrder[0]}
2) index ${mobileOrder[1]}
3) index ${mobileOrder[2]}
4) index ${mobileOrder[3]}
5) index ${mobileOrder[4]}
6) index ${mobileOrder[5]}`}
            </pre>
            <p className="mt-2">This means mobile starts with index 3, then 0, 1, 4, 5, and finally 2.</p>
            <div className="mt-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 p-3">
              <p className="font-semibold text-sky-900 dark:text-sky-100 mb-2">Example using Contrast Group 1</p>
              <ol className="list-decimal list-inside space-y-1 text-sky-900/90 dark:text-sky-100/90">
                {mobileExamples.map((entry, position) => (
                  <li key={`${position}-${entry?.key ?? "missing"}`}>
                    Position {position + 1}: {shortLabel(entry?.label ?? entry?.key)}
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Current Contrast Groups (all 6 images)</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Each position below lists all images that can appear there across contrast groups. Numbering uses
          <span className="font-mono mx-1">G1</span>, <span className="font-mono mr-1">G2</span>, ... to show which
          contrast group each image belongs to.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {imagesByPosition.map((entriesForPosition, positionIndex) => (
            <div
              key={positionIndex}
              className={`p-3 rounded-lg ${
                positionIndex < 3 ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-indigo-50 dark:bg-indigo-950/20"
              }`}
            >
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                index {positionIndex}: {gridCellTitle(positionIndex)}
              </h4>
              <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-200">
                {entriesForPosition.map(({ groupNumber, entry }) => (
                  <li key={`${positionIndex}-${groupNumber}`}>
                    <span className="font-mono font-semibold text-gray-500 dark:text-gray-400">G{groupNumber}</span>{" "}
                    {shortLabel(entry?.label ?? entry?.key)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Image Labels & Reading Guide</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
          This subsection explains labels used on classification interface images: the single-band analysis set (observed
          data, model, residual). Use it to decode symbols, understand label
          format, and interpret examples consistently.
        </p>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section>
            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Label Structure</h4>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <div className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 p-3 font-mono text-sky-900 dark:text-sky-100">
                <span className="bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 px-2 py-0.5 rounded font-bold">ObjectID</span>{" "}
                (
                <span className="bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 px-2 py-0.5 rounded font-bold">ImageType</span>{" "}
                <span className="bg-rose-200 dark:bg-rose-800 text-rose-900 dark:text-rose-100 px-2 py-0.5 rounded font-bold">[≡ref]</span>{" "}
                <span className="bg-violet-200 dark:bg-violet-800 text-violet-900 dark:text-violet-100 px-2 py-0.5 rounded font-bold">Scale</span>{" "}
                <span className="bg-cyan-200 dark:bg-cyan-800 text-cyan-900 dark:text-cyan-100 px-2 py-0.5 rounded font-bold">Qquantile</span>
                )
              </div>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  <span className="bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 px-2 py-0.5 rounded font-bold">ObjectID</span>: unique galaxy identifier.
                </li>
                <li>
                  <span className="bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 px-2 py-0.5 rounded font-bold">ImageType</span>: g/r/i/mdl/res.
                </li>
                <li>
                  <span className="bg-rose-200 dark:bg-rose-800 text-rose-900 dark:text-rose-100 px-2 py-0.5 rounded font-bold">[≡ref]</span>: optional unified-threshold reference (b/m/r).
                </li>
                <li>
                  <span className="bg-violet-200 dark:bg-violet-800 text-violet-900 dark:text-violet-100 px-2 py-0.5 rounded font-bold">Scale</span>: lin/log/sym/asi/apt.
                </li>
                <li>
                  <span className="bg-cyan-200 dark:bg-cyan-800 text-cyan-900 dark:text-cyan-100 px-2 py-0.5 rounded font-bold">Qquantile</span>: percentile value or zscale marker.
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Image Type Abbreviations</h4>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <th className="text-left p-3 border border-gray-200 dark:border-gray-600">Abbreviation</th>
                    <th className="text-left p-3 border border-gray-200 dark:border-gray-600">Full Name</th>
                    <th className="text-left p-3 border border-gray-200 dark:border-gray-600">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="even:bg-gray-50 dark:even:bg-gray-900/40 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                    <td className="p-3 border border-gray-200 dark:border-gray-600 font-mono">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">g, r, i</span>
                    </td>
                    <td className="p-3 border border-gray-200 dark:border-gray-600">Band</td>
                    <td className="p-3 border border-gray-200 dark:border-gray-600">Observed photometric image</td>
                  </tr>
                  <tr className="even:bg-gray-50 dark:even:bg-gray-900/40 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                    <td className="p-3 border border-gray-200 dark:border-gray-600 font-mono">
                      <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">mdl</span>
                    </td>
                    <td className="p-3 border border-gray-200 dark:border-gray-600">Model</td>
                    <td className="p-3 border border-gray-200 dark:border-gray-600">GALFIT fit image</td>
                  </tr>
                  <tr className="even:bg-gray-50 dark:even:bg-gray-900/40 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">
                    <td className="p-3 border border-gray-200 dark:border-gray-600 font-mono">
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">res</span>
                    </td>
                    <td className="p-3 border border-gray-200 dark:border-gray-600">Residual</td>
                    <td className="p-3 border border-gray-200 dark:border-gray-600">Observed minus model</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">

          <section>
            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Symbol Reference</h4>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <th className="text-left p-3 border border-gray-200 dark:border-gray-600">Symbol</th>
                    <th className="text-left p-3 border border-gray-200 dark:border-gray-600">Meaning</th>
                    <th className="text-left p-3 border border-gray-200 dark:border-gray-600">Example</th>
                  </tr>
                </thead>
                <tbody>
                  {symbolRows.map(([symbol, meaning, example]) => (
                    <tr key={symbol} className="even:bg-gray-50 dark:even:bg-gray-900/40 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                      <td className="p-3 border border-gray-200 dark:border-gray-600 font-mono text-red-600 dark:text-red-300">{symbol}</td>
                      <td className="p-3 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200">{meaning}</td>
                      <td className="p-3 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300">{example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Complete Examples</h4>
            <div className="grid grid-cols-1 gap-3 text-sm text-gray-700 dark:text-gray-200">
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3">
                <p className="font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded mb-2">123456789 (g lin Q99.9)</p>
                <p>g-band image, linear scale, 99.9th percentile normalization.</p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3">
                <p className="font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded mb-2">987654321 (mdl log Q99.7)</p>
                <p>Model image, logarithmic scale, 99.7th percentile normalization.</p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3">
                <p className="font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded mb-2">123456789 (res ≡b sym Q99.9)</p>
                <p>Residual image unified to band threshold using symlog.</p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3">
                <p className="font-mono bg-gray-50 dark:bg-gray-900 p-2 rounded mb-2">123456789 (mdl ≡m log Q99.9)</p>
                <p>Model image unified to model threshold for direct comparison.</p>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-6">
          <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Interactive Label Decoder</h4>
          <div className="rounded-lg border border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 p-3 mb-3 text-sm text-yellow-900 dark:text-yellow-100">
            Paste a label to decode image type, unified threshold mode, scale, and quantile metadata fields.
          </div>
          <input
            type="text"
            value={labelInput}
            onChange={(event) => setLabelInput(event.target.value)}
            placeholder="Example: 123456789 (g ≡b lin Q99.9)"
            className="w-full px-3 py-2 rounded-md border-2 border-blue-400 dark:border-blue-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />

          <div className="mt-4 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-sm text-gray-700 dark:text-gray-200">
            {decodedLabel.kind === "invalid" && <p>{decodedLabel.message}</p>}

            {decodedLabel.kind === "unknown" && (
              <div className="space-y-2">
                <p>
                  <span className="font-semibold">Object ID:</span>{" "}
                  <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200">
                    {decodedLabel.objectId}
                  </span>
                </p>
                <p>
                  <span className="font-semibold">Details:</span>{" "}
                  <span className="font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800">{decodedLabel.details}</span>
                </p>
                <p className="text-gray-500 dark:text-gray-400">Pattern not recognized fully; this may be a custom format.</p>
              </div>
            )}

            {decodedLabel.kind === "standard" && (
              <div className="space-y-2">
                <p>
                  <span className="font-semibold">Object ID:</span>{" "}
                  <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200">
                    {decodedLabel.objectId}
                  </span>
                </p>
                <p>
                  <span className="font-semibold">Image Type:</span>{" "}
                  <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
                    {imageTypeMap[decodedLabel.imageType]}
                  </span>
                </p>
                <p>
                  <span className="font-semibold">Unified Mode:</span>{" "}
                  <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200">no</span>
                </p>
                <p>
                  <span className="font-semibold">Scale:</span>{" "}
                  <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200">
                    {scaleMap[decodedLabel.scale]}
                  </span>
                </p>
                <p>
                  <span className="font-semibold">Quantile:</span>{" "}
                  <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200">
                    {decodeQuantile(decodedLabel.quantile)}
                  </span>
                </p>
                <div className="mt-3 rounded bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-3 font-mono text-xs">
                  Label Image Type: {decodedLabel.imageType}
                  <br />
                  Label Scale: {decodedLabel.scale}
                  <br />
                  Label Quantile: {decodedLabel.quantile}
                  <br />
                  Label Unified: no
                </div>
              </div>
            )}

            {decodedLabel.kind === "unified" && (
              <div className="space-y-2">
                <p>
                  <span className="font-semibold">Object ID:</span>{" "}
                  <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200">
                    {decodedLabel.objectId}
                  </span>
                </p>
                <p>
                  <span className="font-semibold">Image Type:</span>{" "}
                  <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
                    {imageTypeMap[decodedLabel.imageType]}
                  </span>
                </p>
                <p>
                  <span className="font-semibold">Unified Mode:</span>{" "}
                  <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">
                    yes (uses {thresholdRefMap[decodedLabel.thresholdRef]} threshold)
                  </span>
                </p>
                <p>
                  <span className="font-semibold">Scale:</span>{" "}
                  <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200">
                    {scaleMap[decodedLabel.scale]}
                  </span>
                </p>
                <p>
                  <span className="font-semibold">Quantile:</span>{" "}
                  <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200">
                    {decodeQuantile(decodedLabel.quantile)}
                  </span>
                </p>
                <div className="mt-3 rounded bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-3 font-mono text-xs">
                  Label Image Type: {decodedLabel.imageType}
                  <br />
                  Label Scale: {decodedLabel.scale}
                  <br />
                  Label Quantile: {decodedLabel.quantile}
                  <br />
                  Label Unified: yes
                  <br />
                  Label Threshold Ref: {decodedLabel.thresholdRef}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">APLpy vs Lupton (in-depth)</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-300">
          <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">APLpy RGB</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Flexible per-channel control for i→R, r→G, g→B mapping.</li>
              <li>Supports linear, arcsinh, and log stretches.</li>
              <li>Uses percentile (<span className="font-mono">pmin/pmax</span>) or absolute (<span className="font-mono">vmin/vmax</span>) limits.</li>
              <li>
                <span className="font-mono">vmid</span> controls midpoint emphasis for non-linear stretches.
              </li>
              <li>
                "based_on" configurations reuse calibrated absolute scales for more consistent object-to-object comparison.
              </li>
              <li>Masked variants suppress contaminants; unmasked variants preserve full field context.</li>
            </ul>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Lupton RGB</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Asinh softening approach designed for astronomical dynamic range.</li>
              <li>Main parameters: <span className="font-mono">Q</span>, <span className="font-mono">stretch</span>, <span className="font-mono">minimum</span>.</li>
              <li>Higher Q usually reveals more faint structure; lower Q boosts bright-core contrast.</li>
              <li>Typical interface defaults are near Q=5, stretch=20, minimum=0.</li>
              <li>Preserves color ratios while compressing intensity range.</li>
            </ul>
            <div className="mt-3 rounded bg-gray-50 dark:bg-gray-900 p-3">
              <p className="font-semibold text-gray-900 dark:text-white mb-1">Lupton formula sketch</p>
              <p className="font-mono text-xs">I=(R+G+B)/3, f=asinh(Q×I)/(Q×I), then scale channels by f before clipping.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">❓ Common Questions</h3>
        <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
          <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Why do groups look different?</h4>
            <p>Each group uses different stretch/normalization choices to expose different structures.</p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Why different quantiles?</h4>
            <p>
              Different quantiles (for example Q99.9 vs Q99.7) map brightness differently: higher quantiles reveal fainter
              structure but may saturate bright regions.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">What is "zscale" (Qzs)?</h4>
            <p>
              ZScale is an automatic normalization algorithm that estimates sensible display limits from image statistics.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Why unified thresholds?</h4>
            <p>They keep band/model/residual on a common scale for cleaner side-by-side comparison.</p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">What does the residual image show?</h4>
            <p>
              Residual is observed data minus fitted model. Strong coherent patterns indicate structure not captured by the
              current fit.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">How to validate faint features?</h4>
            <p>Cross-check across multiple groups (including APLpy and Lupton) and masked/unmasked variants.</p>
          </div>
        </div>
      </div>
    </>
  );
}
