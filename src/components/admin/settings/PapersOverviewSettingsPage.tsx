import { Link } from "react-router";
import { usePageTitle } from "../../../hooks/usePageTitle";
import type { PapersOverviewSettingsPageProps } from "./types";
import type { PaperMetadataEntry } from "../../../lib/paperDisplay";

const OVERVIEW_DEFAULT_NONE_SENTINEL = "__overview_default_none__";
const PAPER_ASSIGNMENT_DEFAULT_NONE_SENTINEL = "__paper_assignment_default_none__";

export function PapersOverviewSettingsPage({
  localSettings,
  handleSettingChange,
  setLocalSettings,
  newPaperInput,
  setNewPaperInput,
}: PapersOverviewSettingsPageProps) {
  usePageTitle("Admin – Settings – Papers & Overview");

  const getMetadataForPaper = (paperId: string): PaperMetadataEntry | undefined =>
    localSettings.paperMetadata.find((entry) => entry.id === paperId);

  const upsertPaperMetadata = (
    paperId: string,
    patch: Partial<Pick<PaperMetadataEntry, "label" | "citation">>,
  ) => {
    setLocalSettings((prev) => {
      const existingIndex = prev.paperMetadata.findIndex((entry) => entry.id === paperId);
      const existing = existingIndex >= 0
        ? prev.paperMetadata[existingIndex]
        : { id: paperId };

      const nextLabel = patch.label !== undefined ? patch.label : existing.label;
      const nextCitation = patch.citation !== undefined ? patch.citation : existing.citation;
      const hasLabel = Boolean(nextLabel?.trim());
      const hasCitation = Boolean(nextCitation?.trim());

      const shouldRemove = !hasLabel && !hasCitation;
      if (shouldRemove) {
        return {
          ...prev,
          paperMetadata: prev.paperMetadata.filter((entry) => entry.id !== paperId),
        };
      }

      const normalized: PaperMetadataEntry = {
        id: paperId,
        label: hasLabel ? nextLabel : undefined,
        citation: hasCitation ? nextCitation : undefined,
      };

      if (existingIndex >= 0) {
        const nextMetadata = [...prev.paperMetadata];
        nextMetadata[existingIndex] = normalized;
        return {
          ...prev,
          paperMetadata: nextMetadata,
        };
      }

      return {
        ...prev,
        paperMetadata: [...prev.paperMetadata, normalized],
      };
    });
  };

  const addPaper = (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (
      trimmed === OVERVIEW_DEFAULT_NONE_SENTINEL ||
      trimmed === PAPER_ASSIGNMENT_DEFAULT_NONE_SENTINEL ||
      localSettings.availablePapers.includes(trimmed)
    ) {
      return;
    }

    setLocalSettings((prev) => ({
      ...prev,
      availablePapers: [...prev.availablePapers, trimmed],
    }));
    setNewPaperInput("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Papers & Overview
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Configure which paper identifiers are available and what the overview
          page selects by default.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
          Available Papers
        </h4>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Configure the misc.paper values used when generating balanced
          sequences. These map to the
          <code className="mx-1 rounded bg-gray-100 px-1 dark:bg-gray-700">
            misc.paper
          </code>
          field in galaxy data. Optionally define a display label and citation
          for each paper value.
        </p>

        <div className="mt-4 space-y-3">
          <div className="space-y-3">
            {localSettings.availablePapers.map((paper, index) => (
              <div
                key={`${paper}-${index}`}
                className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Paper identifier
                    </p>
                    <p className="font-mono text-sm text-gray-900 dark:text-white break-all">
                      {paper === "" ? "(empty string)" : paper}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalSettings((prev) => ({
                        ...prev,
                        availablePapers: prev.availablePapers.filter(
                          (_, paperIndex) => paperIndex !== index,
                        ),
                        paperMetadata: prev.paperMetadata.filter(
                          (entry) => entry.id !== paper,
                        ),
                        overviewDefaultPaper:
                          prev.overviewDefaultPaper === paper
                            ? null
                            : prev.overviewDefaultPaper,
                        paperAssignmentCoverageDefaultPaper:
                          prev.paperAssignmentCoverageDefaultPaper === paper
                            ? null
                            : prev.paperAssignmentCoverageDefaultPaper,
                      }));
                    }}
                    className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-800/70 dark:text-red-300 dark:hover:bg-red-950/20"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                      Display label (optional)
                    </span>
                    <input
                      type="text"
                      value={getMetadataForPaper(paper)?.label ?? ""}
                      onChange={(e) =>
                        upsertPaperMetadata(paper, { label: e.target.value })
                      }
                      placeholder={paper === "" ? "e.g. Unassigned" : `e.g. ${paper}`}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
                      Citation popup text (optional)
                    </span>
                    <input
                      type="text"
                      value={getMetadataForPaper(paper)?.citation ?? ""}
                      onChange={(e) =>
                        upsertPaperMetadata(paper, { citation: e.target.value })
                      }
                      placeholder="Full citation shown on hover/click"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={newPaperInput}
              onChange={(e) => setNewPaperInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPaper(newPaperInput);
                }
              }}
              placeholder="Add new paper value..."
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <button
              type="button"
              onClick={() => addPaper(newPaperInput)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                if (localSettings.availablePapers.includes("")) {
                  return;
                }
                setLocalSettings((prev) => ({
                  ...prev,
                  availablePapers: [...prev.availablePapers, ""],
                }));
              }}
              className="rounded-md bg-gray-500 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
              title="Add empty string value"
            >
              Add Empty
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Press Enter to add. Use Add Empty to add an empty string value for
            galaxies without a paper assigned.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
          Overview Default Filter
        </h4>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Default Paper Filter for Overview Tab
          </span>
          <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
            Pre-select a paper in the Overview statistics tab when the page is
            opened without a URL parameter. Users can still switch to any paper
            or to All.
          </p>
          <select
            value={
              localSettings.overviewDefaultPaper === null
                ? OVERVIEW_DEFAULT_NONE_SENTINEL
                : localSettings.overviewDefaultPaper
            }
            onChange={(e) => {
              const value = e.target.value;
              handleSettingChange(
                "overviewDefaultPaper",
                value === OVERVIEW_DEFAULT_NONE_SENTINEL ? null : value,
              );
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value={OVERVIEW_DEFAULT_NONE_SENTINEL}>
              None - show all papers by default
            </option>
            {localSettings.availablePapers.map((paper, index) => (
              <option key={`${paper}-${index}`} value={paper}>
                {(getMetadataForPaper(paper)?.label?.trim() || (paper === "" ? "(empty - unassigned galaxies)" : paper))}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            The reserved token used for the None option cannot be added as a
            paper value.
          </p>
        </label>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
          Classification Coverage Default Filter
        </h4>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Default Paper Filter for Classification Coverage Tab
          </span>
          <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
            Pre-select a paper in the Classification Coverage tab when the page is opened without a URL parameter. Users can still switch to any paper or to All.
          </p>
          <select
            value={
              localSettings.paperAssignmentCoverageDefaultPaper === null
                ? PAPER_ASSIGNMENT_DEFAULT_NONE_SENTINEL
                : localSettings.paperAssignmentCoverageDefaultPaper
            }
            onChange={(e) => {
              const value = e.target.value;
              handleSettingChange(
                "paperAssignmentCoverageDefaultPaper",
                value === PAPER_ASSIGNMENT_DEFAULT_NONE_SENTINEL ? null : value,
              );
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          >
            <option value={PAPER_ASSIGNMENT_DEFAULT_NONE_SENTINEL}>
              None - show all papers by default
            </option>
            {localSettings.availablePapers.map((paper, index) => (
              <option key={`${paper}-${index}`} value={paper}>
                {(getMetadataForPaper(paper)?.label?.trim() || (paper === "" ? "(empty - unassigned galaxies)" : paper))}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            The reserved token used for the None option cannot be added as a paper value.
          </p>
        </label>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
          Overview Cache
        </h4>
        <div className="mt-4 space-y-4">
          <label className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Enable automatic snapshot refresh
              </span>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Refresh cached snapshots for /statistics/overview on a background schedule.
                Disable this to rely only on live overview loads to populate cached data.
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.overviewAutoRefreshEnabled}
              onChange={(e) =>
                handleSettingChange(
                  "overviewAutoRefreshEnabled",
                  e.target.checked,
                )
              }
              className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Refresh interval (minutes)
            </span>
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
              Minimum 5 minutes. The background scheduler checks whether a refresh is due every 5 minutes.
            </p>
            <input
              type="number"
              min={5}
              step={5}
              value={localSettings.overviewAutoRefreshIntervalMinutes}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                handleSettingChange(
                  "overviewAutoRefreshIntervalMinutes",
                  Number.isFinite(parsed) ? Math.max(5, Math.floor(parsed)) : 5,
                );
              }}
              disabled={!localSettings.overviewAutoRefreshEnabled}
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
          Classification Coverage Access & Cache
        </h4>
        <div className="mt-4 space-y-4">
          <div className="rounded-md border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-200">
            Classification Coverage access is now controlled per role on the Permissions page, including separate controls for cached access, live access, and whether a role can receive all user rows.
            <span className="ml-1">
              <Link to="/admin/settings/permissions" className="font-medium underline underline-offset-2 hover:no-underline">
                Open Permissions settings
              </Link>
              .
            </span>
          </div>

          <label className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Enable automatic snapshot refresh
              </span>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Refresh cached Classification Coverage snapshots for /statistics/classification-coverage on a background schedule.
                Disable this to keep only manual live calculations available.
              </p>
            </div>
            <input
              type="checkbox"
              checked={localSettings.paperAssignmentCoverageAutoRefreshEnabled}
              onChange={(e) =>
                handleSettingChange(
                  "paperAssignmentCoverageAutoRefreshEnabled",
                  e.target.checked,
                )
              }
              className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Refresh interval (minutes)
            </span>
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
              Minimum 5 minutes. The background scheduler checks whether a refresh is due every 5 minutes.
            </p>
            <input
              type="number"
              min={5}
              step={5}
              value={localSettings.paperAssignmentCoverageAutoRefreshIntervalMinutes}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                handleSettingChange(
                  "paperAssignmentCoverageAutoRefreshIntervalMinutes",
                  Number.isFinite(parsed) ? Math.max(5, Math.floor(parsed)) : 5,
                );
              }}
              disabled={!localSettings.paperAssignmentCoverageAutoRefreshEnabled}
              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </label>
        </div>
      </div>
    </div>
  );
}