import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { useConvex, useQuery } from "convex/react";
import { toast } from "sonner";

import { api } from "../../../../convex/_generated/api";
import { ImageViewer } from "../../classification/ImageViewer";
import { SMALL_IMAGE_DEFAULT_ZOOM } from "../../classification/GalaxyImages";
import { getPreviewImageName } from "../../../images/displaySettings";
import { getImageUrl } from "../../../images";
import {
  createCsvHeader,
  createCsvRow,
  downloadTextFile,
  formatDateForFilename,
  sanitizeFilenameSegment,
  type CsvColumn,
} from "../../../lib/csv";

const ITEMS_PER_PAGE = 10;
const EXPORT_BATCH_SIZE = 100;

type RemainingGalaxyDetail = {
  id: string;
  numericId: string | null;
  ra: number;
  dec: number;
  reff: number;
  q: number;
  nucleus: boolean;
  mag: number | null;
  meanMue: number | null;
  totalClassifications: number;
  totalAssigned: number;
  paper: string | null;
  thurClsN: number | null;
};

type RemainingGalaxyDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  rowLabel: string;
  scopeLabel: string;
  galaxyExternalIds: string[];
  targetClassifications: number;
  isSpecial: boolean;
};

function buildExportColumns(targetClassifications: number): CsvColumn<RemainingGalaxyDetail>[] {
  return [
    { header: "Galaxy ID", getValue: (row) => row.id },
    { header: "Numeric ID", getValue: (row) => row.numericId ?? "" },
    { header: "Paper", getValue: (row) => row.paper ?? "" },
    { header: "RA", getValue: (row) => row.ra.toFixed(6) },
    { header: "Dec", getValue: (row) => row.dec.toFixed(6) },
    { header: "Reff", getValue: (row) => row.reff.toFixed(3) },
    { header: "q", getValue: (row) => row.q.toFixed(3) },
    { header: "Nucleus", getValue: (row) => (row.nucleus ? "Yes" : "No") },
    { header: "Magnitude", getValue: (row) => (row.mag === null ? "" : row.mag.toFixed(3)) },
    { header: "Mean mue", getValue: (row) => (row.meanMue === null ? "" : row.meanMue.toFixed(3)) },
    { header: "Current classifications", getValue: (row) => row.totalClassifications },
    {
      header: "Still needed to target",
      getValue: (row) => Math.max(targetClassifications - row.totalClassifications, 0),
    },
    { header: "Total assigned", getValue: (row) => row.totalAssigned },
    { header: "Thur CLS N", getValue: (row) => row.thurClsN ?? "" },
  ];
}

function formatScopeLabel(scopeLabel: string) {
  return scopeLabel.trim() || "all-papers";
}

export function RemainingGalaxyDetailsModal({
  isOpen,
  onClose,
  rowLabel,
  scopeLabel,
  galaxyExternalIds,
  targetClassifications,
  isSpecial,
}: RemainingGalaxyDetailsModalProps) {
  const convex = useConvex();
  const previewImageName = useMemo(() => getPreviewImageName(), []);
  const [page, setPage] = useState(1);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [exportedCsvCount, setExportedCsvCount] = useState(0);
  const [expandedGalaxyIds, setExpandedGalaxyIds] = useState<Record<string, boolean>>({});
  const [displayedDetailRows, setDisplayedDetailRows] = useState<RemainingGalaxyDetail[]>([]);

  const pageCount = Math.max(1, Math.ceil(galaxyExternalIds.length / ITEMS_PER_PAGE));
  const pageGalaxyIds = useMemo(() => {
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    return galaxyExternalIds.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [galaxyExternalIds, page]);

  const detailsResult = useQuery(
    api.statistics.paperAssignmentCoverage.cache.getGalaxyDetailsByIds,
    isOpen && pageGalaxyIds.length > 0 ? { galaxyExternalIds: pageGalaxyIds } : "skip",
  );

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
    setPage(1);
  }, [isOpen, rowLabel, scopeLabel, targetClassifications, galaxyExternalIds]);

  useEffect(() => {
    setExpandedGalaxyIds({});
  }, [isOpen, page, galaxyExternalIds]);

  useEffect(() => {
    if (!isOpen) {
      setDisplayedDetailRows([]);
      return;
    }

    if (galaxyExternalIds.length === 0) {
      setDisplayedDetailRows([]);
      return;
    }

    if (detailsResult?.galaxies) {
      setDisplayedDetailRows(detailsResult.galaxies as RemainingGalaxyDetail[]);
    }
  }, [detailsResult, galaxyExternalIds.length, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const scrollY = window.scrollY;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverflowY = document.body.style.overflowY;
    const previousBodyOverflowX = document.body.style.overflowX;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousBodyLeft = document.body.style.left;
    const previousBodyRight = document.body.style.right;
    const previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;

    document.body.style.overflowY = "scroll";
    document.body.style.overflowX = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overscrollBehavior = "contain";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overflowY = previousBodyOverflowY;
      document.body.style.overflowX = previousBodyOverflowX;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      document.body.style.left = previousBodyLeft;
      document.body.style.right = previousBodyRight;
      document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleDownloadIds = () => {
    const fileName = `paper-assignment-remaining-ids-${sanitizeFilenameSegment(rowLabel)}-${sanitizeFilenameSegment(formatScopeLabel(scopeLabel))}-${formatDateForFilename()}.txt`;
    downloadTextFile(`${galaxyExternalIds.join("\n")}\n`, fileName, "text/plain;charset=utf-8");
    toast.success(`Downloaded ${galaxyExternalIds.length.toLocaleString()} galaxy IDs.`);
  };

  const handleDownloadCsv = async () => {
    setIsExportingCsv(true);
    setExportedCsvCount(0);
    try {
      const exportColumns = buildExportColumns(targetClassifications);
      const csvLines = [createCsvHeader(exportColumns)];

      for (let startIndex = 0; startIndex < galaxyExternalIds.length; startIndex += EXPORT_BATCH_SIZE) {
        const batchIds = galaxyExternalIds.slice(startIndex, startIndex + EXPORT_BATCH_SIZE);
        const result = await convex.query(
          api.statistics.paperAssignmentCoverage.cache.getGalaxyDetailsByIds,
          { galaxyExternalIds: batchIds },
        );

        for (const galaxy of result.galaxies as RemainingGalaxyDetail[]) {
          csvLines.push(createCsvRow(galaxy, exportColumns));
        }

        setExportedCsvCount(
          Math.min(startIndex + batchIds.length, galaxyExternalIds.length),
        );
      }

      const fileName = `paper-assignment-remaining-${sanitizeFilenameSegment(rowLabel)}-${sanitizeFilenameSegment(formatScopeLabel(scopeLabel))}-${formatDateForFilename()}.csv`;
      downloadTextFile(`${csvLines.join("\n")}\n`, fileName, "text/csv;charset=utf-8");
      toast.success(`Downloaded ${galaxyExternalIds.length.toLocaleString()} remaining galaxies as CSV.`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to download the remaining-galaxies CSV.");
    } finally {
      setIsExportingCsv(false);
    }
  };

  const detailRows = detailsResult?.galaxies
    ? (detailsResult.galaxies as RemainingGalaxyDetail[])
    : displayedDetailRows;
  const isPageLoading = galaxyExternalIds.length > 0 && pageGalaxyIds.length > 0 && detailsResult === undefined;
  const subtitle = isSpecial
    ? `${galaxyExternalIds.length.toLocaleString()} galaxies below ${targetClassifications} classifications in ${scopeLabel} with no current sequence owner.`
    : `${galaxyExternalIds.length.toLocaleString()} galaxies in ${rowLabel}'s current sequence within ${scopeLabel} still need attention to reach ${targetClassifications} classifications.`;
  const pageStart = galaxyExternalIds.length === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1;
  const pageEnd = Math.min(page * ITEMS_PER_PAGE, galaxyExternalIds.length);
  const exportProgressPercent = galaxyExternalIds.length > 0
    ? Math.round((exportedCsvCount / galaxyExternalIds.length) * 100)
    : 0;

  const toggleExpandedGalaxy = (galaxyId: string) => {
    setExpandedGalaxyIds((current) => ({
      ...current,
      [galaxyId]: !current[galaxyId],
    }));
  };

  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      className="absolute right-4 top-4 rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
      aria-label="Close remaining galaxy details"
    >
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>
  );

  const modalContent = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-gray-950/70 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="remaining-galaxy-details-title"
      >
        <div className="relative border-b border-gray-200 px-4 py-4 pr-14 dark:border-gray-700 sm:px-6">
          {closeButton}

          <div className="space-y-4">
            <h2
              id="remaining-galaxy-details-title"
              className="text-xl font-semibold text-gray-900 dark:text-white"
            >
              Remaining below-target galaxies for {rowLabel}
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
              {subtitle}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={isExportingCsv || galaxyExternalIds.length === 0}
                className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-200"
              >
                {isExportingCsv ? "Preparing CSV…" : "Download CSV"}
              </button>
              <button
                type="button"
                onClick={handleDownloadIds}
                disabled={galaxyExternalIds.length === 0}
                className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-200"
              >
                Download IDs (.txt)
              </button>
            </div>

            {isExportingCsv ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-200">
                <div className="flex items-center justify-between gap-3">
                  <span>Preparing CSV export…</span>
                  <span className="font-medium">{exportedCsvCount.toLocaleString()} / {galaxyExternalIds.length.toLocaleString()}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/40">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-[width] duration-200 dark:bg-blue-400"
                    style={{ width: `${exportProgressPercent}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
            <div>
              Showing page {page.toLocaleString()} of {pageCount.toLocaleString()}.
            </div>
            <div>
              {galaxyExternalIds.length.toLocaleString()} remaining galaxies total.
            </div>
          </div>

          {galaxyExternalIds.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
              No remaining galaxies are available for this row at the selected target.
            </div>
          ) : detailRows.length === 0 && isPageLoading ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
              Loading galaxy details for this page…
            </div>
          ) : detailRows.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
              No galaxy details were returned for the current page.
            </div>
          ) : (
            <div className="relative min-h-[28rem]">
            {isPageLoading ? (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-white/65 text-sm font-medium text-gray-600 backdrop-blur-[1px] dark:bg-gray-900/65 dark:text-gray-200">
                Loading next page…
              </div>
            ) : null}

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[980px] divide-y divide-gray-200 text-left text-sm dark:divide-gray-700">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="px-3 py-3">Preview</th>
                    <th className="px-3 py-3">Galaxy</th>
                    <th className="px-3 py-3 text-right">Current</th>
                    <th className="px-3 py-3 text-right">Still needed</th>
                    <th className="px-3 py-3">Paper</th>
                    <th className="px-3 py-3">RA</th>
                    <th className="px-3 py-3">Dec</th>
                    <th className="px-3 py-3">Reff</th>
                    <th className="px-3 py-3">q</th>
                    <th className="px-3 py-3">Mag</th>
                    <th className="px-3 py-3">Mean mue</th>
                    <th className="px-3 py-3">Nucleus</th>
                    <th className="galaxy-sticky-col galaxy-sticky-col-header px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {detailRows.map((galaxy) => {
                    const remainingToTarget = Math.max(
                      targetClassifications - galaxy.totalClassifications,
                      0,
                    );
                    const stickyCellBackgroundClass = "bg-white dark:bg-gray-900";

                    return (
                      <tr key={galaxy.id} className="align-top text-gray-700 dark:text-gray-200">
                        <td className="px-3 py-3">
                          <div className="h-16 w-16 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                            <ImageViewer
                              imageUrl={getImageUrl(galaxy.id, previewImageName, { quality: "low" })}
                              alt={`Galaxy ${galaxy.id}`}
                              defaultZoomOptions={SMALL_IMAGE_DEFAULT_ZOOM}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-semibold text-gray-900 dark:text-white">{galaxy.id}</div>
                          <div className="mt-1 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {galaxy.numericId ? <div>#{galaxy.numericId}</div> : null}
                            <div>Assigned: {galaxy.totalAssigned.toLocaleString()}</div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-gray-900 dark:text-white">
                          {galaxy.totalClassifications.toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-amber-800 dark:text-amber-200">
                          +{remainingToTarget.toLocaleString()}
                        </td>
                        <td className="px-3 py-3">{galaxy.paper || "Unassigned"}</td>
                        <td className="px-3 py-3">{galaxy.ra.toFixed(4)}°</td>
                        <td className="px-3 py-3">{galaxy.dec.toFixed(4)}°</td>
                        <td className="px-3 py-3">{galaxy.reff.toFixed(2)}</td>
                        <td className="px-3 py-3">{galaxy.q.toFixed(3)}</td>
                        <td className="px-3 py-3">{galaxy.mag === null ? "—" : galaxy.mag.toFixed(2)}</td>
                        <td className="px-3 py-3">{galaxy.meanMue === null ? "—" : galaxy.meanMue.toFixed(2)}</td>
                        <td className="px-3 py-3">{galaxy.nucleus ? "Yes" : "No"}</td>
                        <td className={`galaxy-sticky-col px-3 py-3 text-center whitespace-nowrap ${stickyCellBackgroundClass}`}>
                          <Link
                            to={`/classify/${galaxy.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
                          >
                            Classify
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {detailRows.map((galaxy) => {
                const remainingToTarget = Math.max(
                  targetClassifications - galaxy.totalClassifications,
                  0,
                );
                const isExpanded = expandedGalaxyIds[galaxy.id] === true;

                return (
                  <div
                    key={galaxy.id}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="flex items-start gap-4">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                        <ImageViewer
                          imageUrl={getImageUrl(galaxy.id, previewImageName, { quality: "low" })}
                          alt={`Galaxy ${galaxy.id}`}
                          defaultZoomOptions={SMALL_IMAGE_DEFAULT_ZOOM}
                        />
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="space-y-2">
                          <div className="text-base font-semibold text-gray-900 dark:text-white break-all">
                            {galaxy.id}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            {galaxy.numericId ? (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
                                #{galaxy.numericId}
                              </span>
                            ) : null}
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-200">
                              {galaxy.paper || "Unassigned"}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
                            <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              Current
                            </div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {galaxy.totalClassifications.toLocaleString()}
                            </div>
                          </div>
                          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
                            <div className="text-[11px] uppercase tracking-wide">
                              Still needed
                            </div>
                            <div className="font-semibold">
                              +{remainingToTarget.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/classify/${galaxy.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex flex-1 items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                          >
                            Open classify tab
                          </Link>

                          <button
                            type="button"
                            onClick={() => toggleExpandedGalaxy(galaxy.id)}
                            className="inline-flex items-center justify-center rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-gray-600 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-200"
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? "Hide details" : "Show details"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-gray-200 pt-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">RA</div>
                          <div className="mt-1">{galaxy.ra.toFixed(4)}°</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Dec</div>
                          <div className="mt-1">{galaxy.dec.toFixed(4)}°</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Reff</div>
                          <div className="mt-1">{galaxy.reff.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">q</div>
                          <div className="mt-1">{galaxy.q.toFixed(3)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Mag</div>
                          <div className="mt-1">{galaxy.mag === null ? "—" : galaxy.mag.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Mean mue</div>
                          <div className="mt-1">{galaxy.meanMue === null ? "—" : galaxy.meanMue.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Nucleus</div>
                          <div className="mt-1">{galaxy.nucleus ? "Yes" : "No"}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Assigned</div>
                          <div className="mt-1">{galaxy.totalAssigned.toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Thur CLS N</div>
                          <div className="mt-1">{galaxy.thurClsN ?? "—"}</div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            </div>
          )}
          </div>
        </div>

        <div className="border-t border-gray-200 px-4 py-4 dark:border-gray-700 sm:px-6">
          {galaxyExternalIds.length > ITEMS_PER_PAGE ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
                disabled={page <= 1}
                className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-200"
              >
                Previous page
              </button>

              <div className="text-sm text-gray-600 dark:text-gray-300">
                {pageStart}
                {pageStart > 0 ? "–" : ""}
                {pageEnd} of {galaxyExternalIds.length.toLocaleString()}
              </div>

              <button
                type="button"
                onClick={() => setPage((currentPage) => Math.min(currentPage + 1, pageCount))}
                disabled={page >= pageCount}
                className="rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-200"
              >
                Next page
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {galaxyExternalIds.length.toLocaleString()} galaxies on this list.
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
}