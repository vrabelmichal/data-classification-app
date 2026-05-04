import { usePageTitle } from "../../../hooks/usePageTitle";
import type { PapersOverviewSettingsPageProps } from "./types";

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
          field in galaxy data.
        </p>

        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {localSettings.availablePapers.map((paper, index) => (
              <div
                key={`${paper}-${index}`}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                <span>{paper === "" ? "(empty string)" : paper}</span>
                <button
                  type="button"
                  onClick={() => {
                    setLocalSettings((prev) => ({
                      ...prev,
                      availablePapers: prev.availablePapers.filter(
                        (_, paperIndex) => paperIndex !== index,
                      ),
                    }));
                  }}
                  className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                >
                  ×
                </button>
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
                {paper === "" ? "(empty - unassigned galaxies)" : paper}
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
          Paper Assignment Default Filter
        </h4>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            Default Paper Filter for Paper Assignment Coverage Tab
          </span>
          <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
            Pre-select a paper in the Paper Assignment Coverage tab when the page is opened without a URL parameter. Users can still switch to any paper or to All.
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
                {paper === "" ? "(empty - unassigned galaxies)" : paper}
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
          Paper Assignment Coverage Cache
        </h4>
        <div className="mt-4 space-y-4">
          <label className="flex items-center justify-between gap-4">
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Enable automatic snapshot refresh
              </span>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Refresh cached snapshots for /statistics/paper-assignment-coverage on a background schedule.
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