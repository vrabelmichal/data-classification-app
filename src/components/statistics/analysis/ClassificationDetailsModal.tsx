import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  getNormalizedComment,
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

function getCommentPreview(comment: string, previewLength = 180) {
  if (comment.length <= previewLength) {
    return comment;
  }

  return `${comment.slice(0, previewLength).trimEnd()}...`;
}

function ExpandInlineIcon({ expanded }: { expanded: boolean }) {
  return expanded ? (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="10" y1="14" x2="3" y2="21" />
    </svg>
  ) : (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

export function ClassificationDetailsModal({
  isOpen,
  onClose,
  record,
  userDisplayNames,
}: ClassificationDetailsModalProps) {
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    setExpandedComments({});
  }, [record?._id, isOpen]);

  if (!isOpen || !record) {
    return null;
  }

  const modalContent = (
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
                <th className="px-3 py-3">Created</th>
                <th className="px-3 py-3">LSB</th>
                <th className="px-3 py-3">Morphology</th>
                <th className="px-3 py-3">Awesome</th>
                <th className="px-3 py-3">Valid z</th>
                <th className="px-3 py-3">Visible nucleus</th>
                <th className="px-3 py-3">Failed fitting</th>
                <th className="px-3 py-3">Comments</th>
                <th className="px-3 py-3">User ID</th>
                <th className="px-3 py-3">Classification ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {record.votes.map((vote) => {
                const displayName =
                  userDisplayNames[vote.userId] ?? `User ${vote.userId.slice(-6)}`;
                const comment = getNormalizedComment(vote.comments);
                const isCommentExpanded = expandedComments[vote._id] === true;
                const commentPreview = comment ? getCommentPreview(comment) : null;
                const shouldShowToggle = comment !== null;

                return (
                  <Fragment key={vote._id}>
                    <tr className="align-top text-gray-700 dark:text-gray-200">
                      <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">
                        {displayName}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">{formatDate(vote._creationTime)}</td>
                      <td className="px-3 py-3">{getLsbVoteLabel(vote)}</td>
                      <td className="px-3 py-3">{getMorphologyVoteLabel(vote.morphology)}</td>
                      <td className="px-3 py-3">{formatBooleanLabel(vote.awesome_flag)}</td>
                      <td className="px-3 py-3">{formatBooleanLabel(vote.valid_redshift)}</td>
                      <td className="px-3 py-3">{formatBooleanLabel(vote.visible_nucleus)}</td>
                      <td className="px-3 py-3">{formatBooleanLabel(vote.failed_fitting)}</td>
                      <td className="px-3 py-3 min-w-[260px] max-w-[360px]">
                        {commentPreview ? (
                          <div className="flex items-start gap-1.5 text-sm text-gray-700 dark:text-gray-200">
                            <div className="min-w-0 break-words">
                              {commentPreview}
                            </div>
                            {shouldShowToggle ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedComments((current) => ({
                                    ...current,
                                    [vote._id]: !current[vote._id],
                                  }))
                                }
                                aria-label={isCommentExpanded ? "Hide full comment" : "Show full comment"}
                                title={isCommentExpanded ? "Hide full comment" : "Show full comment"}
                                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                              >
                                <ExpandInlineIcon expanded={isCommentExpanded} />
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{vote.userId}</td>
                      <td className="px-3 py-3 font-mono text-xs">{vote._id}</td>
                    </tr>
                    {comment && isCommentExpanded ? (
                      <tr className="bg-amber-50/70 dark:bg-amber-950/10">
                        <td colSpan={11} className="px-3 py-3">
                          <div className="rounded-lg border border-amber-200/80 bg-white/80 px-4 py-3 dark:border-amber-900/60 dark:bg-gray-900/60">
                            <div className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                              Full comment
                            </div>
                            <div className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-200">
                              {comment}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
}