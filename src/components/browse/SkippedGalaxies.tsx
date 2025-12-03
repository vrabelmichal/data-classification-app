import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { usePageTitle } from "../../hooks/usePageTitle";
import { toast } from "sonner";
import { Link } from "react-router";
import { ImageViewer } from "../classification/ImageViewer";
import { getImageUrl } from "../../images";
import { getPreviewImageName } from "../../images/displaySettings";
import { useState } from "react";
import {SMALL_IMAGE_DEFAULT_ZOOM} from "../classification/GalaxyImages";

const ITEMS_PER_PAGE = 16;
const CARD_VIEW_THRESHOLD = 1;

export function SkippedGalaxies() {
  usePageTitle("Skipped Galaxies");
  const skippedGalaxies = useQuery(api.galaxies.skipped.getSkippedGalaxies);
  const removeFromSkipped = useMutation(api.galaxies.skipped.removeFromSkipped);
  const userPrefs = useQuery(api.users.getUserPreferences);
  const systemSettings = useQuery(api.system_settings.getPublicSystemSettings);
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpToPage, setJumpToPage] = useState("");

  const previewImageName = getPreviewImageName();
  
  // Compute effective image quality from user prefs or system default
  const defaultImageQuality = (systemSettings?.defaultImageQuality as "high" | "low") || "high";
  const effectiveImageQuality = userPrefs?.imageQuality || defaultImageQuality;

  const handleRemoveFromSkipped = async (skippedId: any) => {
    try {
      await removeFromSkipped({ skippedId });
      toast.success("Galaxy removed from skipped list");
    } catch (error) {
      toast.error("Failed to remove galaxy from skipped list");
      console.error(error);
    }
  };

  if (skippedGalaxies === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const filteredData = skippedGalaxies.filter(
    (item): item is NonNullable<typeof item> & { galaxy: NonNullable<typeof item.galaxy> } => 
      Boolean(item?.galaxy)
  );

  // Calculate pagination
  const totalItems = filteredData.length;
  const needsPagination = totalItems > ITEMS_PER_PAGE;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedData = needsPagination ? filteredData.slice(startIndex, endIndex) : filteredData;

  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage);
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setJumpToPage("");
    }
  };

  const handleJumpKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleJumpToPage();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Skipped Galaxies</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Galaxies you've skipped during classification
        </p>
      </div>

      {totalItems === 0 ? (
        <div className="text-center py-12">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⏭️</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Skipped Galaxies
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              You haven't skipped any galaxies yet. Keep up the great work!
            </p>
          </div>
        </div>
      ) : totalItems < CARD_VIEW_THRESHOLD ? (
        // Card view for small number of items (< 11)
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredData.map((item) => (
            <div
              key={item._id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="w-full max-w-64 mx-auto p-4">
                <ImageViewer
                  imageUrl={getImageUrl(item.galaxy.id, previewImageName, {
                    quality: effectiveImageQuality,
                  })}
                  alt={`Galaxy ${item.galaxy.id}`}
                  preferences={userPrefs}
                  defaultZoomOptions={SMALL_IMAGE_DEFAULT_ZOOM}
                />
              </div>

              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {item.galaxy.id}
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(item._creationTime).toLocaleDateString()}
                  </span>
                </div>

                <div className="text-sm text-gray-600 dark:text-gray-300 mb-3 space-y-1">
                  <div><span className="font-medium">RA:</span> {item.galaxy.ra.toFixed(4)}°</div>
                  <div><span className="font-medium">Dec:</span> {item.galaxy.dec.toFixed(4)}°</div>
                  <div><span className="font-medium">reff:</span> {item.galaxy.reff.toFixed(2)}″</div>
                  <div><span className="font-medium">q:</span> {item.galaxy.q.toFixed(3)}</div>
                  <div><span className="font-medium">PA:</span> {item.galaxy.pa?.toFixed(1) ?? "—"}°</div>
                  <div><span className="font-medium">Nucleus:</span> {item.galaxy.nucleus ? "Yes" : "No"}</div>
                </div>

                {item.comments && (
                  <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium">Comments:</span> {item.comments}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Link
                    to={`/classify/${item.galaxy.id}`}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm text-center"
                  >
                    Classify
                  </Link>
                  <button
                    onClick={() => handleRemoveFromSkipped(item._id)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Mobile card view for larger lists */}
          <div className="block lg:hidden space-y-4">
            {paginatedData.map((item) => (
              <div
                key={item._id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:space-x-4 space-y-4 sm:space-y-0">
                  <div className="flex-shrink-0 w-full sm:w-1/3 max-w-64 mx-auto sm:mx-0">
                    <ImageViewer
                      imageUrl={getImageUrl(item.galaxy.id, previewImageName, { 
                        quality: effectiveImageQuality 
                      })}
                      alt={`Galaxy ${item.galaxy.id}`}
                      preferences={userPrefs}
                      defaultZoomOptions={SMALL_IMAGE_DEFAULT_ZOOM}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {item.galaxy.id}
                      </h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                        {new Date(item._creationTime).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-300 mb-3">
                      <div><span className="font-medium text-gray-800 dark:text-gray-100">RA:</span> {item.galaxy.ra.toFixed(4)}°</div>
                      <div><span className="font-medium text-gray-800 dark:text-gray-100">Dec:</span> {item.galaxy.dec.toFixed(4)}°</div>
                      <div><span className="font-medium text-gray-800 dark:text-gray-100">reff:</span> {item.galaxy.reff.toFixed(2)}″</div>
                      <div><span className="font-medium text-gray-800 dark:text-gray-100">q:</span> {item.galaxy.q.toFixed(3)}</div>
                      <div><span className="font-medium text-gray-800 dark:text-gray-100">PA:</span> {item.galaxy.pa?.toFixed(1) ?? "—"}°</div>
                      <div><span className="font-medium text-gray-800 dark:text-gray-100">Nucleus:</span> {item.galaxy.nucleus ? "Yes" : "No"}</div>
                    </div>

                    {item.comments && (
                      <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          <span className="font-medium">Comments:</span> {item.comments}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link
                    to={`/classify/${item.galaxy.id}`}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                  >
                    Classify
                  </Link>
                  <button
                    onClick={() => handleRemoveFromSkipped(item._id)}
                    className="flex-1 px-3 py-2 rounded-md text-sm font-medium bg-gray-600 hover:bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:focus:ring-offset-gray-800"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table view for larger lists */}
          <div className="hidden lg:block galaxy-table-container relative w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
            <div className="galaxy-table-scroll-wrapper galaxy-table-scroll relative max-w-full overflow-x-auto">
              <table className="galaxy-table w-full min-w-[1000px] border-collapse text-sm text-gray-700 dark:text-gray-200">
                <thead className="bg-gray-100 dark:bg-gray-900/40">
                  <tr>
                    <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Image
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap">
                      Galaxy ID
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap">
                      RA
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap">
                      Dec
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap">
                      Reff
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap">
                      q
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap">
                      PA
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap">
                      Nucleus
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap">
                      Skipped On
                    </th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap">
                      Comments
                    </th>
                    <th className="galaxy-sticky-col galaxy-sticky-col-header border border-gray-300 px-3 py-2 text-left font-semibold whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((item, index) => {
                    const rowBackgroundClass = index % 2 === 0 ? "bg-white dark:bg-gray-900/10" : "bg-gray-50 dark:bg-gray-900/30";
                    const stickyCellBackgroundClass = index % 2 === 0 ? "bg-white dark:bg-gray-900/20" : "bg-gray-50 dark:bg-gray-900/40";

                    return (
                      <tr key={item._id} className={rowBackgroundClass}>
                        <td className="border border-gray-300 px-3 py-2 align-top">
                          <div className="h-16 w-16 overflow-hidden rounded">
                            <ImageViewer
                              imageUrl={getImageUrl(item.galaxy.id, previewImageName, {
                                quality: effectiveImageQuality,
                              })}
                              alt={`Galaxy ${item.galaxy.id}`}
                              preferences={userPrefs}
                              defaultZoomOptions={SMALL_IMAGE_DEFAULT_ZOOM}
                            />
                          </div>
                        </td>
                        <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{item.galaxy.id}</td>
                        <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{item.galaxy.ra.toFixed(4)}°</td>
                        <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{item.galaxy.dec.toFixed(4)}°</td>
                        <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{item.galaxy.reff.toFixed(2)}″</td>
                        <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{item.galaxy.q.toFixed(3)}</td>
                        <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">
                          {item.galaxy.pa !== undefined && item.galaxy.pa !== null ? `${item.galaxy.pa.toFixed(1)}°` : "—"}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 whitespace-nowrap">{item.galaxy.nucleus ? "Yes" : "No"}</td>
                        <td className="border border-gray-300 px-3 py-2 whitespace-nowrap text-xs">
                          {new Date(item._creationTime).toLocaleDateString()}
                        </td>
                        <td className="border border-gray-300 px-3 py-2 max-w-xs">
                          <div className="text-xs text-gray-600 dark:text-gray-300 truncate" title={item.comments || ""}>
                            {item.comments || "—"}
                          </div>
                        </td>
                        <td className={`galaxy-sticky-col border border-gray-300 px-3 py-2 whitespace-nowrap ${stickyCellBackgroundClass}`}>
                          <div className="flex gap-2">
                            <Link
                              to={`/classify/${item.galaxy.id}`}
                              className="inline-flex items-center rounded bg-blue-500 px-2 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500"
                            >
                              Classify
                            </Link>
                            <button
                              onClick={() => handleRemoveFromSkipped(item._id)}
                              className="inline-flex items-center rounded bg-gray-500 px-2 py-1 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500"
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Pagination */}
      {needsPagination && (
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPage > 1
                  ? "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              }`}
            >
              Previous
            </button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? "bg-blue-600 text-white"
                        : "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPage < totalPages
                  ? "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              }`}
            >
              Next
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">Jump to:</span>
              <input
                type="number"
                min="1"
                max={totalPages}
                value={jumpToPage}
                onChange={(e) => setJumpToPage(e.target.value)}
                onKeyPress={handleJumpKeyPress}
                placeholder="Page"
                className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <button
                onClick={handleJumpToPage}
                className="px-3 py-1 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Go
              </button>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-300">
              Page {currentPage} of {totalPages}
            </div>
          </div>
        </div>
      )}

      {/* Summary and link to browser */}
      {totalItems > 0 && (
        <div className="mt-8 space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {needsPagination ? (
                <>Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} skipped {totalItems === 1 ? 'galaxy' : 'galaxies'}</>
              ) : (
                <>Showing {totalItems} skipped {totalItems === 1 ? 'galaxy' : 'galaxies'}</>
              )}
            </p>
          </div>
          <div className="text-center border-t border-gray-200 dark:border-gray-700 pt-4">
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              Want to review these galaxies in more detail?
            </p>
            <Link
              to="/browse"
              className="inline-flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Browse All Galaxies
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
