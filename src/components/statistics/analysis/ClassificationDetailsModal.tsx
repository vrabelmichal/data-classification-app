import { useEffect } from "react";

import {
  getLsbVoteLabel,
  getMorphologyVoteLabel,
  type AnalysisRecord,
} from "./helpers";

type ClassificationDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  record: AnalysisRecord | null;
  userDisplayNames: Record<string, string>;
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(timestamp: number) {
  return dateFormatter.format(new Date(timestamp));
}

function formatBooleanLabel(value: boolean | undefined) {
  if (value === undefined) {
    return "-";
  }

  return value ? "Yes" : "No";
}

export function ClassificationDetailsModal({
  isOpen,
  onClose,
  record,
  userDisplayNames,
}: ClassificationDetailsModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !record) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-gray-950/70 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-6xl rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="classification-details-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h2
              id="classification-details-title"
              className="text-xl font-semibold text-gray-900 dark:text-white"
            >
              Individual classifications for {record.galaxy.id}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {record.aggregate.totalClassifications} classifications. Dominant Is-LSB: {record.dominantLsbLabel}. Dominant morphology: {record.dominantMorphologyLabel}.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
            aria-label="Close classification details"
          >
            <span className="block text-lg leading-none">x</span>
          </button>
        </div>

        <div className="overflow-x-auto px-6 py-5">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="px-3 py-3">User</th>
                <th className="px-3 py-3">User ID</th>
                <th className="px-3 py-3">Classification ID</th>
                <th className="px-3 py-3">Created</th>
                <th className="px-3 py-3">LSB</th>
                <th className="px-3 py-3">Morphology</th>
                <th className="px-3 py-3">Awesome</th>
                <th className="px-3 py-3">Valid z</th>
                <th className="px-3 py-3">Visible nucleus</th>
                <th className="px-3 py-3">Failed fitting</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {record.votes.map((vote) => {
                const displayName =
                  userDisplayNames[vote.userId] ?? `User ${vote.userId.slice(-6)}`;

                return (
                  <tr key={vote._id} className="align-top text-gray-700 dark:text-gray-200">
                    <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">
                      {displayName}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{vote.userId}</td>
                    <td className="px-3 py-3 font-mono text-xs">{vote._id}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatDate(vote._creationTime)}</td>
                    <td className="px-3 py-3">{getLsbVoteLabel(vote)}</td>
                    <td className="px-3 py-3">{getMorphologyVoteLabel(vote.morphology)}</td>
                    <td className="px-3 py-3">{formatBooleanLabel(vote.awesome_flag)}</td>
                    <td className="px-3 py-3">{formatBooleanLabel(vote.valid_redshift)}</td>
                    <td className="px-3 py-3">{formatBooleanLabel(vote.visible_nucleus)}</td>
                    <td className="px-3 py-3">{formatBooleanLabel(vote.failed_fitting)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}